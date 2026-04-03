from __future__ import annotations

import os
import re
from typing import Any

from core.schemas import GraphPayload
from core.provider_contracts import (
    normalize_provider,
    provider_default_api_key_env,
    provider_is_ui_selectable,
    provider_requires_api_base_url,
    provider_requires_api_key_env,
    provider_unsupported_reason,
)

SQL_FAMILY = {'sql_query', 'sql_list_tables', 'sql_get_schema', 'sql_query_check'}
TAVILY_FAMILY = {'web_search', 'tavily_extract'}
BRAVE_FAMILY = {'brave_search'}
DUCKDUCKGO_FAMILY = {'duckduckgo_search'}
REQUESTS_FAMILY = {'requests_get', 'requests_post'}
FILESYSTEM_FAMILY = {'fs_list_dir', 'fs_read_file', 'fs_glob', 'fs_grep'}
FILESYSTEM_MUTATION_FAMILY = {'fs_write_file', 'fs_edit_file', 'fs_apply_patch'}
SHELL_FAMILY = {'shell_command'}
GITHUB_FAMILY = {'github_get_issue', 'github_get_pull_request', 'github_read_file', 'github_search_issues_prs'}
LLM_NODE_FAMILY = {'llm_chat', 'react_agent'}
LLM_TOOL_FAMILY = {'tool_llm_worker', 'sub_agent_tool'}


def _is_valid_github_repository(value: str) -> bool:
    normalized = (value or '').strip()
    return bool(re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', normalized))


def _iter_tools(payload: GraphPayload) -> list[tuple[str, str, dict[str, Any]]]:
    rows: list[tuple[str, str, dict[str, Any]]] = []
    for tool in payload.tools or []:
        tool_id = getattr(tool, 'id', None)
        tool_type = getattr(tool, 'type', None)
        params = getattr(tool, 'params', None)
        if isinstance(tool, dict):
            tool_id = tool.get('id')
            tool_type = tool.get('type')
            params = tool.get('params', {})
        if hasattr(params, 'model_dump'):
            params = params.model_dump()
        elif not isinstance(params, dict):
            params = {}
        rows.append((str(tool_id or tool_type or ''), str(tool_type or ''), dict(params)))
    return rows


def _issue(entry_id: str, entry_type: str, category: str, code: str, message: str) -> dict[str, str]:
    return {
        'entryId': entry_id,
        'entryType': entry_type,
        'category': category,
        'code': code,
        'message': message,
    }


def _iter_nodes(payload: GraphPayload) -> list[tuple[str, str, dict[str, Any]]]:
    rows: list[tuple[str, str, dict[str, Any]]] = []
    for node in payload.nodes:
        node_id = getattr(node, 'id', None)
        node_type = getattr(node, 'type', None)
        params = getattr(node, 'params', None)
        if hasattr(params, 'model_dump'):
            params = params.model_dump()
        elif not isinstance(params, dict):
            params = {}
        rows.append((str(node_id or node_type or ''), str(node_type or ''), dict(params)))
    return rows


def _llm_surface_provider_issues(entry_id: str, entry_type: str, params: dict[str, Any]) -> list[dict[str, str]]:
    issues: list[dict[str, str]] = []
    provider = normalize_provider(params.get('provider'))
    if not provider:
        return issues
    if not provider_is_ui_selectable(provider):
        reason = provider_unsupported_reason(provider) or 'This provider is not truthfully modeled by the current runtime surface.'
        issues.append(_issue(
            entry_id,
            entry_type,
            'invalid_configuration',
            'provider_surface_not_supported',
            f"Surface '{entry_id}' uses provider '{provider}', but this build does not model it truthfully for in-app runtime. {reason} Switch to a supported provider family or keep this lane editor-first / compile-first.",
        ))
        return issues
    if provider_requires_api_base_url(provider):
        api_base_url = str(params.get('api_base_url') or '').strip()
        if not api_base_url:
            issues.append(_issue(
                entry_id,
                entry_type,
                'missing_provider_config',
                'missing_provider_api_base_url',
                f"Surface '{entry_id}' uses provider '{provider}' and requires api_base_url for runtime execution. Set the provider base URL on the node or tool, then rerun.",
            ))
    if provider_requires_api_key_env(provider):
        env_name = str(params.get('api_key_env') or provider_default_api_key_env(provider)).strip()
        if env_name and not os.getenv(env_name):
            issues.append(_issue(
                entry_id,
                entry_type,
                'missing_provider_config',
                'missing_provider_api_key',
                f"Surface '{entry_id}' uses provider '{provider}' and requires the environment variable '{env_name}'. Add it to the environment that launches LangSuite, then rerun.",
            ))
    return issues

def find_runtime_preflight_issues(payload: GraphPayload) -> list[dict[str, str]]:
    issues: list[dict[str, str]] = []
    runtime_settings = payload.ui_context.runtime_settings if payload.ui_context else None
    shell_enabled = bool(getattr(runtime_settings, 'shellExecutionEnabled', False))

    for entry_id, entry_type, params in _iter_nodes(payload):
        if entry_type in LLM_NODE_FAMILY:
            issues.extend(_llm_surface_provider_issues(entry_id, entry_type, params))

    for entry_id, entry_type, params in _iter_tools(payload):
        if entry_type in LLM_TOOL_FAMILY:
            issues.extend(_llm_surface_provider_issues(entry_id, entry_type, params))
        if entry_type in TAVILY_FAMILY:
            env_name = str(params.get('tavily_api_key') or 'TAVILY_API_KEY').strip() or 'TAVILY_API_KEY'
            if not os.getenv(env_name):
                issues.append(_issue(
                    entry_id,
                    entry_type,
                    'missing_provider_config',
                    'missing_tavily_api_key',
                    f"Tool '{entry_id}' is Tavily-backed and requires the environment variable '{env_name}'. Add it to the environment that launches LangSuite, then rerun.",
                ))

        if entry_type in BRAVE_FAMILY:
            env_name = str(params.get('brave_api_key') or 'BRAVE_SEARCH_API_KEY').strip() or 'BRAVE_SEARCH_API_KEY'
            if not os.getenv(env_name):
                issues.append(_issue(
                    entry_id,
                    entry_type,
                    'missing_provider_config',
                    'missing_brave_api_key',
                    f"Tool '{entry_id}' is Brave-backed and requires the environment variable '{env_name}'. Add it to the environment that launches LangSuite, then rerun.",
                ))

        if entry_type in REQUESTS_FAMILY:
            base_url = str(params.get('base_url') or '').strip()
            allow_full_urls = params.get('allow_full_urls', False)
            if isinstance(allow_full_urls, str):
                allow_full_urls = allow_full_urls.strip().lower() == 'true'
            if not base_url and not allow_full_urls:
                issues.append(_issue(
                    entry_id,
                    entry_type,
                    'invalid_configuration',
                    'requests_target_not_configured',
                    f"Tool '{entry_id}' needs either a base_url or allow_full_urls=true. Configure one of those before rerunning.",
                ))

        if entry_type in FILESYSTEM_FAMILY or entry_type in FILESYSTEM_MUTATION_FAMILY or entry_type in SHELL_FAMILY:
            root_path = str(params.get('root_path') or '.').strip() or '.'
            if not os.path.isdir(root_path):
                issues.append(_issue(
                    entry_id,
                    entry_type,
                    'invalid_configuration',
                    'invalid_filesystem_root',
                    f"Tool '{entry_id}' needs an existing directory root_path; got '{root_path}'. Point it to a real local directory before rerunning.",
                ))

        if entry_type in FILESYSTEM_MUTATION_FAMILY:
            max_bytes = params.get('max_bytes', 200000)
            try:
                if int(max_bytes) <= 0:
                    raise ValueError
            except Exception:
                issues.append(_issue(
                    entry_id,
                    entry_type,
                    'invalid_configuration',
                    'invalid_filesystem_max_bytes',
                    f"Tool '{entry_id}' needs a positive max_bytes value for bounded filesystem mutation.",
                ))
            if entry_type == 'fs_apply_patch':
                max_files = params.get('max_files', 8)
                try:
                    if int(max_files) <= 0:
                        raise ValueError
                except Exception:
                    issues.append(_issue(
                        entry_id,
                        entry_type,
                        'invalid_configuration',
                        'invalid_filesystem_max_files',
                        f"Tool '{entry_id}' needs a positive max_files value for bounded patch application.",
                    ))

        if entry_type in SHELL_FAMILY:
            if not shell_enabled:
                issues.append(_issue(
                    entry_id,
                    entry_type,
                    'gated_runtime_surface',
                    'shell_execution_not_armed',
                    f"Tool '{entry_id}' is a user-armed shell surface and needs the top-toolbar shell toggle enabled for this graph. Arm shell execution explicitly, then rerun.",
                ))
            allowed_commands = params.get('allowed_commands', [])
            if not isinstance(allowed_commands, list) or not [str(item).strip() for item in allowed_commands if str(item).strip()]:
                issues.append(_issue(
                    entry_id,
                    entry_type,
                    'invalid_configuration',
                    'missing_shell_allowlist',
                    f"Tool '{entry_id}' needs one or more allowed_commands entries for bounded shell execution. Add a non-empty allowlist, then rerun.",
                ))

        if entry_type in GITHUB_FAMILY:
            required = ['GITHUB_APP_ID', 'GITHUB_APP_PRIVATE_KEY', 'GITHUB_REPOSITORY']
            missing = [name for name in required if not os.getenv(name)]
            if missing:
                issues.append(_issue(
                    entry_id,
                    entry_type,
                    'missing_provider_config',
                    'missing_github_configuration',
                    f"Tool '{entry_id}' is GitHub-backed and requires: {', '.join(missing)}. Add those environment variables, then rerun.",
                ))
            else:
                repository = str(os.getenv('GITHUB_REPOSITORY') or '').strip()
                if not _is_valid_github_repository(repository):
                    issues.append(_issue(
                        entry_id,
                        entry_type,
                        'invalid_configuration',
                        'invalid_github_repository',
                        f"Tool '{entry_id}' requires GITHUB_REPOSITORY in owner/repo format; got '{repository or '<empty>'}'. Fix that value, then rerun.",
                    ))

        if entry_type in SQL_FAMILY:
            db_path = str(params.get('db_path') or 'data.db').strip()
            if not db_path:
                issues.append(_issue(
                    entry_id,
                    entry_type,
                    'invalid_configuration',
                    'missing_sql_db_path',
                    f"Tool '{entry_id}' needs a SQLite database path or sqlite:/// URI. Configure db_path before rerunning.",
                ))
            if entry_type == 'sql_query':
                read_only = params.get('read_only', True)
                if isinstance(read_only, str):
                    read_only = read_only.strip().lower() != 'false'
                if read_only is False:
                    issues.append(_issue(
                        entry_id,
                        entry_type,
                        'unsafe_sql_mode',
                        'sql_mutation_disabled',
                        f"Tool '{entry_id}' is blocked because this pass only supports read-only SQL execution. Turn read_only back on or remove the mutating SQL step.",
                    ))

    return issues


def format_runtime_preflight_message(issues: list[dict[str, str]]) -> str:
    if not issues:
        return 'All runtime preflight checks passed.'
    return 'Run blocked by runtime preflight. Fix the reported configuration issues, then rerun: ' + '; '.join(issue['message'] for issue in issues)

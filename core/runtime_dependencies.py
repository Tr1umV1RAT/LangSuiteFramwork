from __future__ import annotations

import importlib.util
from typing import Any

from core.schemas import GraphPayload
from core.provider_contracts import normalize_provider, provider_runtime_requirement

BASE_REQUIREMENTS = {
    'langgraph': ('langgraph', 'generated graph runtime'),
    'langchain': ('langchain', 'generated model/runtime helpers'),
    'langchain_core': ('langchain-core', 'generated state/message types'),
}

OPTIONAL_NODE_REQUIREMENTS = {
    'rag_retriever_local': {
        'langchain_huggingface': ('langchain-huggingface', 'local embedding-backed RAG retrieval'),
        'langchain_chroma': ('langchain-chroma', 'local embedding-backed RAG retrieval'),
    },
}

OPTIONAL_TOOL_OR_NODE_REQUIREMENTS = {
    'tool_python_repl': {
        'langchain_experimental': ('langchain-experimental', 'Python REPL tool surface'),
    },
    'python_repl': {
        'langchain_experimental': ('langchain-experimental', 'Python REPL tool surface'),
    },
    'tool_sql_database': {
        'langchain_community': ('langchain-community', 'SQL database tool surface'),
    },
    'tool_sql_query': {
        'langchain_community': ('langchain-community', 'SQL query tool surface'),
    },
    'sql_query': {
        'langchain_community': ('langchain-community', 'SQL query tool surface'),
    },
    'tool_sql_list_tables': {
        'langchain_community': ('langchain-community', 'SQL inspection tool surface'),
    },
    'sql_list_tables': {
        'langchain_community': ('langchain-community', 'SQL inspection tool surface'),
    },
    'tool_sql_get_schema': {
        'langchain_community': ('langchain-community', 'SQL schema inspection tool surface'),
    },
    'sql_get_schema': {
        'langchain_community': ('langchain-community', 'SQL schema inspection tool surface'),
    },
    'tool_sql_query_check': {
        'langchain_community': ('langchain-community', 'SQL read-only validation tool surface'),
    },
    'sql_query_check': {
        'langchain_community': ('langchain-community', 'SQL read-only validation tool surface'),
    },
    'pdf_loader': {
        'langchain_community': ('langchain-community', 'PDF/document loading surface'),
    },
    'tool_web_search': {
        'langchain_tavily': ('langchain-tavily', 'Tavily provider-backed search tool surface'),
    },
    'web_search': {
        'langchain_tavily': ('langchain-tavily', 'Tavily provider-backed search tool surface'),
    },
    'tool_tavily_extract': {
        'langchain_tavily': ('langchain-tavily', 'Tavily provider-backed extraction tool surface'),
    },
    'tavily_extract': {
        'langchain_tavily': ('langchain-tavily', 'Tavily provider-backed extraction tool surface'),
    },
    'tool_brave_search': {
        'requests': ('requests', 'Brave provider-backed search tool surface'),
    },
    'brave_search': {
        'requests': ('requests', 'Brave provider-backed search tool surface'),
    },
    'tool_duckduckgo_search': {
        'duckduckgo_search': ('duckduckgo-search', 'DuckDuckGo search tool surface'),
        'langchain_community': ('langchain-community', 'DuckDuckGo search tool surface'),
    },
    'duckduckgo_search': {
        'duckduckgo_search': ('duckduckgo-search', 'DuckDuckGo search tool surface'),
        'langchain_community': ('langchain-community', 'DuckDuckGo search tool surface'),
    },
    'tool_requests_get': {
        'requests': ('requests', 'Requests toolkit GET surface'),
    },
    'requests_get': {
        'requests': ('requests', 'Requests toolkit GET surface'),
    },
    'tool_requests_post': {
        'requests': ('requests', 'Requests toolkit POST surface'),
    },
    'requests_post': {
        'requests': ('requests', 'Requests toolkit POST surface'),
    },
    'tool_fs_write_file': {},
    'fs_write_file': {},
    'tool_fs_edit_file': {},
    'fs_edit_file': {},
    'tool_fs_apply_patch': {},
    'fs_apply_patch': {},
    'tool_shell_command': {},
    'shell_command': {},
    'tool_pw_navigate': {
        'playwright': ('playwright', 'Playwright browser session toolkit surface'),
    },
    'pw_navigate': {
        'playwright': ('playwright', 'Playwright browser session toolkit surface'),
    },
    'tool_pw_click': {
        'playwright': ('playwright', 'Playwright browser session toolkit surface'),
    },
    'pw_click': {
        'playwright': ('playwright', 'Playwright browser session toolkit surface'),
    },
    'tool_pw_extract_text': {
        'playwright': ('playwright', 'Playwright browser session toolkit surface'),
    },
    'pw_extract_text': {
        'playwright': ('playwright', 'Playwright browser session toolkit surface'),
    },
    'tool_pw_extract_links': {
        'playwright': ('playwright', 'Playwright browser session toolkit surface'),
    },
    'pw_extract_links': {
        'playwright': ('playwright', 'Playwright browser session toolkit surface'),
    },
    'tool_pw_get_elements': {
        'playwright': ('playwright', 'Playwright browser session toolkit surface'),
    },
    'pw_get_elements': {
        'playwright': ('playwright', 'Playwright browser session toolkit surface'),
    },
    'tool_pw_current_page': {
        'playwright': ('playwright', 'Playwright browser session toolkit surface'),
    },
    'pw_current_page': {
        'playwright': ('playwright', 'Playwright browser session toolkit surface'),
    },
    'tool_pw_fill': {
        'playwright': ('playwright', 'Playwright browser session toolkit surface'),
    },
    'pw_fill': {
        'playwright': ('playwright', 'Playwright browser session toolkit surface'),
    },
    'tool_playwright_wait': {
        'playwright': ('playwright', 'Playwright browser session toolkit surface'),
    },
    'playwright_wait': {
        'playwright': ('playwright', 'Playwright browser session toolkit surface'),
    },
    'tool_playwright_scroll': {
        'playwright': ('playwright', 'Playwright browser session toolkit surface'),
    },
    'playwright_scroll': {
        'playwright': ('playwright', 'Playwright browser session toolkit surface'),
    },
    'tool_playwright_extract_links': {
        'playwright': ('playwright', 'Playwright browser session toolkit surface'),
    },
    'playwright_extract_links': {
        'playwright': ('playwright', 'Playwright browser session toolkit surface'),
    },
    'tool_playwright_keypress': {
        'playwright': ('playwright', 'Playwright browser session toolkit surface'),
    },
    'playwright_keypress': {
        'playwright': ('playwright', 'Playwright browser session toolkit surface'),
    },
    'tool_playwright_screenshot': {
        'playwright': ('playwright', 'Playwright browser session toolkit surface'),
    },
    'playwright_screenshot': {
        'playwright': ('playwright', 'Playwright browser session toolkit surface'),
    },
    'tool_github_get_issue': {
        'langchain_community': ('langchain-community', 'GitHub provider-backed read toolkit surface'),
        'github': ('pygithub', 'GitHub provider-backed read toolkit surface'),
    },
    'github_get_issue': {
        'langchain_community': ('langchain-community', 'GitHub provider-backed read toolkit surface'),
        'github': ('pygithub', 'GitHub provider-backed read toolkit surface'),
    },
    'tool_github_get_pull_request': {
        'langchain_community': ('langchain-community', 'GitHub provider-backed read toolkit surface'),
        'github': ('pygithub', 'GitHub provider-backed read toolkit surface'),
    },
    'github_get_pull_request': {
        'langchain_community': ('langchain-community', 'GitHub provider-backed read toolkit surface'),
        'github': ('pygithub', 'GitHub provider-backed read toolkit surface'),
    },
    'tool_github_read_file': {
        'langchain_community': ('langchain-community', 'GitHub provider-backed read toolkit surface'),
        'github': ('pygithub', 'GitHub provider-backed read toolkit surface'),
    },
    'github_read_file': {
        'langchain_community': ('langchain-community', 'GitHub provider-backed read toolkit surface'),
        'github': ('pygithub', 'GitHub provider-backed read toolkit surface'),
    },
    'tool_github_search_issues_prs': {
        'langchain_community': ('langchain-community', 'GitHub provider-backed read toolkit surface'),
        'github': ('pygithub', 'GitHub provider-backed read toolkit surface'),
    },
    'github_search_issues_prs': {
        'langchain_community': ('langchain-community', 'GitHub provider-backed read toolkit surface'),
        'github': ('pygithub', 'GitHub provider-backed read toolkit surface'),
    },
}


def _iter_payload_tool_like_entries(payload: GraphPayload) -> list[tuple[str, dict[str, Any]]]:
    entries: list[tuple[str, dict[str, Any]]] = []
    for node in payload.nodes:
        params = node.params.model_dump() if hasattr(node.params, 'model_dump') else (dict(node.params) if isinstance(node.params, dict) else {})
        entries.append((str(node.type), params))
    for tool in payload.tools or []:
        tool_type = getattr(tool, 'type', None)
        params = getattr(tool, 'params', None)
        if isinstance(tool, dict):
            tool_type = tool.get('type')
            params = tool.get('params', {})
        if hasattr(params, 'model_dump'):
            params = params.model_dump()
        elif not isinstance(params, dict):
            params = {}
        entries.append((str(tool_type or ''), dict(params)))
    return entries


def collect_runtime_dependency_requirements(payload: GraphPayload) -> list[dict[str, str]]:
    requirements: dict[str, dict[str, str]] = {}

    def add(module_name: str, pip_name: str, reason: str) -> None:
        requirements.setdefault(module_name, {'module': module_name, 'package': pip_name, 'reason': reason})

    for module_name, (pip_name, reason) in BASE_REQUIREMENTS.items():
        add(module_name, pip_name, reason)

    entries = _iter_payload_tool_like_entries(payload)
    for entry_type, params in entries:
        for module_name, (pip_name, reason) in OPTIONAL_NODE_REQUIREMENTS.get(entry_type, {}).items():
            add(module_name, pip_name, reason)
        for module_name, (pip_name, reason) in OPTIONAL_TOOL_OR_NODE_REQUIREMENTS.get(entry_type, {}).items():
            add(module_name, pip_name, reason)
        provider = normalize_provider(params.get('provider'))
        requirement = provider_runtime_requirement(provider)
        if requirement is not None:
            module_name, pip_name, reason = requirement
            add(module_name, pip_name, reason)

    return list(requirements.values())


def find_missing_runtime_dependencies(payload: GraphPayload) -> list[dict[str, str]]:
    missing: list[dict[str, str]] = []
    for requirement in collect_runtime_dependency_requirements(payload):
        if importlib.util.find_spec(requirement['module']) is None:
            missing.append(requirement)
    return missing


def format_missing_runtime_dependency_message(missing: list[dict[str, str]]) -> str:
    if not missing:
        return 'All runtime dependencies required by this graph are available.'
    pieces = [f"{item['package']} ({item['reason']})" for item in missing]
    return 'Run blocked before build. Install the missing runtime packages in the Python environment that launches LangSuite, then rerun: ' + '; '.join(pieces)

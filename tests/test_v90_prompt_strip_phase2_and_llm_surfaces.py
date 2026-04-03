from __future__ import annotations

import io
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.compiler import compile_graph
from core.runtime_dependencies import collect_runtime_dependency_requirements
from core.runtime_preflight import find_runtime_preflight_issues
from core.schemas import GraphPayload, RuntimeSettings

WORKSPACE = ROOT / 'client' / 'src' / 'store' / 'workspace.ts'
STATE_PANEL = ROOT / 'client' / 'src' / 'components' / 'StatePanelContent.tsx'
INSPECTOR = ROOT / 'client' / 'src' / 'components' / 'CapabilityInspectorSection.tsx'


def _zip_text(buf: io.BytesIO, graph_id: str, filename: str) -> str:
    with zipfile.ZipFile(io.BytesIO(buf.getvalue()), 'r') as zf:
        return zf.read(f'{graph_id}/{filename}').decode('utf-8')


def test_runtime_settings_backend_accepts_prompt_strip_phase2_fields() -> None:
    settings = RuntimeSettings(
        promptStripLibrary=[
            {
                'id': 'prompt_strip_global',
                'name': 'Global GM Rules',
                'body': 'Stay inside the setting canon.',
                'tags': ['gm', 'canon'],
            }
        ],
        promptStripAssignments=[
            {
                'id': 'prompt_assignment_graph',
                'stripId': 'prompt_strip_global',
                'target': {'kind': 'graph', 'tabId': 'tab_main'},
                'mergeMode': 'prepend',
                'order': 0,
                'enabled': True,
            }
        ],
    )
    assert settings.promptStripLibrary[0].name == 'Global GM Rules'
    assert settings.promptStripAssignments[0].target.kind == 'graph'


def test_prompt_strip_phase2_compile_resolves_graph_node_and_subagent_prompts() -> None:
    payload = GraphPayload(
        graph_id='v90_prompt_compile',
        ui_context={
            'tab_id': 'tab_main',
            'artifact_type': 'graph',
            'execution_profile': 'langgraph_async',
            'project_mode': 'langgraph',
            'runtime_settings': {
                'subagentLibrary': [
                    {
                        'name': 'cast',
                        'agents': [
                            {
                                'name': 'innkeeper',
                                'systemPrompt': '',
                                'tools': [],
                                'description': 'Greets players.',
                            }
                        ],
                    }
                ],
                'promptStripLibrary': [
                    {'id': 'strip_world', 'name': 'World', 'body': 'World law: low fantasy and social consequences.'},
                    {'id': 'strip_llm', 'name': 'Narrator', 'body': 'Narrate like a careful tabletop GM.'},
                    {'id': 'strip_subagent', 'name': 'Innkeeper', 'body': 'Speak warmly, gossip a little, protect the inn.'},
                ],
                'promptStripAssignments': [
                    {
                        'id': 'assign_graph_1',
                        'stripId': 'strip_world',
                        'target': {'kind': 'graph', 'tabId': 'tab_main'},
                        'mergeMode': 'prepend',
                        'order': 0,
                        'enabled': True,
                    },
                    {
                        'id': 'assign_node_1',
                        'stripId': 'strip_llm',
                        'target': {'kind': 'node', 'tabId': 'tab_main', 'nodeId': 'llm_1'},
                        'mergeMode': 'replace_if_empty',
                        'order': 0,
                        'enabled': True,
                    },
                    {
                        'id': 'assign_subagent_1',
                        'stripId': 'strip_subagent',
                        'target': {'kind': 'subagent', 'tabId': 'tab_main', 'groupName': 'cast', 'agentName': 'innkeeper'},
                        'mergeMode': 'replace_if_empty',
                        'order': 0,
                        'enabled': True,
                    },
                ],
            },
        },
        nodes=[
            {
                'id': 'memory_1',
                'type': 'memory_access',
                'params': {
                    'access_mode': 'get',
                    'namespace_prefix': 'campaign',
                    'store_item_key': 'profile',
                    'output_key': 'memory_payload',
                },
            },
            {
                'id': 'llm_1',
                'type': 'llm_chat',
                'inputs': ['messages', 'documents', 'memory_payload'],
                'params': {
                    'provider': 'ollama',
                    'model_name': 'llama3',
                    'system_prompt': '',
                },
            },
        ],
        edges=[
            {'source': 'memory_1', 'target': 'llm_1', 'type': 'direct'},
        ],
        tools=[
            {
                'id': 'delegated_llm',
                'type': 'tool_llm_worker',
                'description': 'Delegated specialist',
                'params': {
                    'provider': 'lm_studio',
                    'model_name': 'qwen2.5',
                    'api_base_url': 'http://127.0.0.1:1234/v1',
                    'system_prompt': '',
                },
            },
            {
                'id': 'innkeeper_tool',
                'type': 'sub_agent_tool',
                'description': 'Call the innkeeper',
                'params': {
                    'target_group': 'cast',
                    'target_agent': 'innkeeper',
                    'provider': 'openai',
                    'model_name': 'gpt-4o-mini',
                    'api_key_env': 'OPENAI_API_KEY',
                },
            },
        ],
        is_async=True,
    )
    buf = compile_graph(payload)
    nodes_py = _zip_text(buf, payload.graph_id, 'nodes.py')
    tools_py = _zip_text(buf, payload.graph_id, 'tools.py')

    assert 'World law: low fantasy and social consequences.' in nodes_py
    assert 'Narrate like a careful tabletop GM.' in nodes_py
    assert 'Mémoire utilisateur' in nodes_py
    assert 'World law: low fantasy and social consequences.' in tools_py
    assert 'Speak warmly, gossip a little, protect the inn.' in tools_py


def test_runtime_preflight_accepts_openai_ollama_and_lm_studio_when_configured(monkeypatch) -> None:
    monkeypatch.setenv('OPENAI_API_KEY', 'test-key')
    langgraph_payload = GraphPayload(
        graph_id='v90_provider_preflight_ok',
        nodes=[
            {'id': 'openai_1', 'type': 'llm_chat', 'params': {'provider': 'openai', 'model_name': 'gpt-4o-mini', 'api_key_env': 'OPENAI_API_KEY'}},
            {'id': 'lmstudio_1', 'type': 'llm_chat', 'params': {'provider': 'lm_studio', 'model_name': 'qwen2.5', 'api_base_url': 'http://127.0.0.1:1234/v1'}},
        ],
        edges=[],
        tools=[
            {'id': 'llm_tool_ok', 'type': 'tool_llm_worker', 'params': {'provider': 'lm_studio', 'model_name': 'qwen2.5', 'api_base_url': 'http://127.0.0.1:1234/v1', 'system_prompt': 'help'}},
        ],
    )
    langchain_payload = GraphPayload(
        graph_id='v90_provider_preflight_ok_langchain',
        ui_context={'artifact_type': 'agent', 'execution_profile': 'langchain_agent', 'project_mode': 'langchain'},
        nodes=[
            {'id': 'ollama_1', 'type': 'react_agent', 'params': {'provider': 'ollama', 'model_name': 'llama3', 'tools_linked': []}},
        ],
        edges=[],
        tools=[],
    )
    issues = find_runtime_preflight_issues(langgraph_payload) + find_runtime_preflight_issues(langchain_payload)
    provider_issue_codes = {issue['code'] for issue in issues if issue['entryType'] in {'llm_chat', 'react_agent', 'tool_llm_worker', 'sub_agent_tool'}}
    assert provider_issue_codes == set()


def test_runtime_dependencies_cover_openai_ollama_lm_studio_and_llm_tool_forms() -> None:
    langgraph_payload = GraphPayload(
        graph_id='v90_provider_deps',
        nodes=[
            {'id': 'openai_1', 'type': 'llm_chat', 'params': {'provider': 'openai', 'model_name': 'gpt-4o-mini'}},
            {'id': 'lmstudio_1', 'type': 'llm_chat', 'params': {'provider': 'lm_studio', 'model_name': 'qwen2.5', 'api_base_url': 'http://127.0.0.1:1234/v1'}},
        ],
        edges=[],
        tools=[
            {'id': 'llm_tool_ok', 'type': 'tool_llm_worker', 'params': {'provider': 'lm_studio', 'model_name': 'qwen2.5', 'api_base_url': 'http://127.0.0.1:1234/v1', 'system_prompt': 'help'}},
            {'id': 'sub_tool', 'type': 'sub_agent_tool', 'params': {'target_group': 'cast', 'target_agent': 'innkeeper', 'provider': 'openai', 'model_name': 'gpt-4o-mini'}},
        ],
    )
    langchain_payload = GraphPayload(
        graph_id='v90_provider_deps_langchain',
        ui_context={'artifact_type': 'agent', 'execution_profile': 'langchain_agent', 'project_mode': 'langchain'},
        nodes=[
            {'id': 'ollama_1', 'type': 'react_agent', 'params': {'provider': 'ollama', 'model_name': 'llama3', 'tools_linked': []}},
        ],
        edges=[],
        tools=[],
    )
    requirements = collect_runtime_dependency_requirements(langgraph_payload) + collect_runtime_dependency_requirements(langchain_payload)
    packages = {item['package'] for item in requirements}
    modules = {item['module'] for item in requirements}
    assert 'langchain-openai' in packages
    assert 'langchain-ollama' in packages
    assert 'langchain_openai' in modules
    assert 'langchain_ollama' in modules


def test_frontend_prompt_strip_phase2_surfaces_reflect_inherited_graph_defaults() -> None:
    workspace_text = WORKSPACE.read_text(encoding='utf-8')
    state_panel_text = STATE_PANEL.read_text(encoding='utf-8')
    inspector_text = INSPECTOR.read_text(encoding='utf-8')

    assert 'resolvePromptStripsForNodeTarget' in workspace_text
    assert 'resolvePromptStripsForSubagentTarget' in workspace_text
    assert 'Inherited graph defaults:' in state_panel_text
    assert 'Inherited graph defaults:' in inspector_text
    assert 'Phase 2 resolves graph defaults plus node-local prompt strips before compile/runtime' in inspector_text

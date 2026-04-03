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
from core.schemas import GraphPayload

STATE_PANEL = ROOT / 'client' / 'src' / 'components' / 'StatePanelContent.tsx'
INSPECTOR = ROOT / 'client' / 'src' / 'components' / 'CapabilityInspectorSection.tsx'


def _zip_text(buf: io.BytesIO, graph_id: str, filename: str) -> str:
    with zipfile.ZipFile(io.BytesIO(buf.getvalue()), 'r') as zf:
        return zf.read(f'{graph_id}/{filename}').decode('utf-8')


def test_phase3_exports_prompt_strip_runtime_metadata_into_state_bootstrap() -> None:
    payload = GraphPayload(
        graph_id='v91_prompt_meta',
        ui_context={
            'tab_id': 'tab_demo',
            'artifact_type': 'graph',
            'execution_profile': 'langgraph_async',
            'project_mode': 'langgraph',
            'runtime_settings': {
                'subagentLibrary': [
                    {
                        'name': 'cast',
                        'agents': [
                            {'name': 'gm', 'systemPrompt': '', 'tools': [], 'description': 'Narrator'},
                        ],
                    }
                ],
                'promptStripLibrary': [
                    {'id': 'world', 'name': 'World', 'body': 'Respect the world canon.'},
                    {'id': 'gm_voice', 'name': 'GM Voice', 'body': 'Act like a careful tabletop GM.'},
                    {'id': 'delegated', 'name': 'Delegate', 'body': 'Answer as a concise specialist.'},
                ],
                'promptStripAssignments': [
                    {'id': 'assign_graph', 'stripId': 'world', 'target': {'kind': 'graph', 'tabId': 'tab_demo'}, 'mergeMode': 'prepend', 'order': 0, 'enabled': True},
                    {'id': 'assign_node', 'stripId': 'gm_voice', 'target': {'kind': 'node', 'tabId': 'tab_demo', 'nodeId': 'llm_1'}, 'mergeMode': 'replace_if_empty', 'order': 0, 'enabled': True},
                    {'id': 'assign_sub', 'stripId': 'delegated', 'target': {'kind': 'subagent', 'tabId': 'tab_demo', 'groupName': 'cast', 'agentName': 'gm'}, 'mergeMode': 'replace_if_empty', 'order': 0, 'enabled': True},
                ],
            },
        },
        nodes=[
            {'id': 'llm_1', 'type': 'llm_chat', 'params': {'provider': 'ollama', 'model_name': 'llama3', 'system_prompt': ''}},
        ],
        edges=[],
        tools=[
            {'id': 'delegate_tool', 'type': 'tool_llm_worker', 'params': {'provider': 'lm_studio', 'model_name': 'qwen2.5', 'api_base_url': 'http://127.0.0.1:1234/v1', 'system_prompt': ''}},
        ],
        is_async=True,
    )
    buf = compile_graph(payload)
    state_py = _zip_text(buf, payload.graph_id, 'state.py')

    assert 'GRAPH_PROMPT_STRIP_METADATA =' in state_py
    assert 'state["__prompt_strip_meta__"] = GRAPH_PROMPT_STRIP_METADATA' in state_py
    assert "'targetKind': 'node'" in state_py
    assert "'toolId': 'delegate_tool'" in state_py
    assert "'groupName': 'cast'" in state_py
    assert "'agentName': 'gm'" in state_py
    assert "'resolvedStripIds': ['world', 'gm_voice']" in state_py


def test_phase3_generated_llm_surfaces_keep_provider_tool_and_memory_contracts_visible() -> None:
    langgraph_payload = GraphPayload(
        graph_id='v91_llm_runtime_contracts',
        ui_context={
            'tab_id': 'tab_main',
            'artifact_type': 'graph',
            'execution_profile': 'langgraph_async',
            'project_mode': 'langgraph',
            'runtime_settings': {
                'promptStripLibrary': [
                    {'id': 'canon', 'name': 'Canon', 'body': 'Keep continuity strict.'},
                    {'id': 'voice', 'name': 'Voice', 'body': 'Narrate with calm dramatic precision.'},
                ],
                'promptStripAssignments': [
                    {'id': 'graph_assign', 'stripId': 'canon', 'target': {'kind': 'graph', 'tabId': 'tab_main'}, 'mergeMode': 'prepend', 'order': 0, 'enabled': True},
                    {'id': 'node_assign', 'stripId': 'voice', 'target': {'kind': 'node', 'tabId': 'tab_main', 'nodeId': 'llm_1'}, 'mergeMode': 'replace_if_empty', 'order': 0, 'enabled': True},
                ],
            },
        },
        nodes=[
            {'id': 'memory_1', 'type': 'memory_access', 'params': {'access_mode': 'get', 'namespace_prefix': 'campaign', 'store_item_key': 'profile', 'output_key': 'memory_payload'}},
            {
                'id': 'llm_1',
                'type': 'llm_chat',
                'inputs': ['messages', 'documents', 'memory_payload'],
                'params': {
                    'provider': 'openai',
                    'model_name': 'gpt-4o-mini',
                    'api_key_env': 'OPENAI_API_KEY',
                    'system_prompt': '',
                    'tools_linked': ['llm_tool'],
                    'max_tokens': 512,
                    'top_p': 0.8,
                    'stop_sequences': ['END_SCENE'],
                },
            },
        ],
        edges=[{'source': 'memory_1', 'target': 'llm_1', 'type': 'direct'}],
        tools=[
            {
                'id': 'llm_tool',
                'type': 'tool_llm_worker',
                'description': 'Secondary model',
                'params': {
                    'provider': 'lm_studio',
                    'model_name': 'qwen2.5',
                    'api_base_url': 'http://127.0.0.1:1234/v1',
                    'system_prompt': 'Summarize the current scene.',
                    'max_tokens': 256,
                    'stop_sequences': ['STOP'],
                },
            },
        ],
        is_async=True,
    )
    langchain_payload = GraphPayload(
        graph_id='v91_react_runtime_contracts',
        ui_context={'artifact_type': 'agent', 'execution_profile': 'langchain_agent', 'project_mode': 'langchain'},
        nodes=[
            {
                'id': 'react_1',
                'type': 'react_agent',
                'params': {
                    'provider': 'ollama',
                    'model_name': 'llama3',
                    'system_prompt': 'Act as a tactical GM assistant.',
                    'tools_linked': ['llm_tool'],
                    'max_tokens': 384,
                    'stop_sequences': ['END_SCENE'],
                },
            },
        ],
        edges=[],
        tools=[
            {
                'id': 'llm_tool',
                'type': 'tool_llm_worker',
                'description': 'Secondary model',
                'params': {
                    'provider': 'lm_studio',
                    'model_name': 'qwen2.5',
                    'api_base_url': 'http://127.0.0.1:1234/v1',
                    'system_prompt': 'Summarize the current scene.',
                    'max_tokens': 256,
                    'stop_sequences': ['STOP'],
                },
            },
        ],
        is_async=True,
    )
    langgraph_buf = compile_graph(langgraph_payload)
    langchain_buf = compile_graph(langchain_payload)
    nodes_py = _zip_text(langgraph_buf, langgraph_payload.graph_id, 'nodes.py')
    react_nodes_py = _zip_text(langchain_buf, langchain_payload.graph_id, 'nodes.py')
    tools_py = _zip_text(langgraph_buf, langgraph_payload.graph_id, 'tools.py')

    assert 'Narrate with calm dramatic precision.' in nodes_py
    assert 'Keep continuity strict.' in nodes_py
    assert 'tools_to_bind = [ACTIVE_TOOLS_BY_ID[tool_id]' in nodes_py
    assert 'Mémoire utilisateur' in nodes_py
    assert '_memory_meta_update(state, node_id="llm_1"' in nodes_py
    assert 'provider="openai"' in nodes_py
    assert 'max_tokens=512' in nodes_py
    assert 'stop_sequences=["END_SCENE"]' in nodes_py

    assert 'llm_with_tools = llm.bind_tools(tools)' in react_nodes_py
    assert 'provider="ollama"' in react_nodes_py
    assert 'Act as a tactical GM assistant.' in react_nodes_py

    assert "provider='lm_studio'" in tools_py or 'provider="lm_studio"' in tools_py
    assert 'api_base_url=' in tools_py
    assert 'max_tokens=256' in tools_py
    assert 'stop_sequences=["STOP"]' in tools_py


def test_provider_preflight_and_dependency_collection_cover_openai_lm_studio_ollama_and_subagent_tool(monkeypatch) -> None:
    monkeypatch.setenv('OPENAI_API_KEY', 'test-key')
    langgraph_payload = GraphPayload(
        graph_id='v91_provider_matrix',
        nodes=[
            {'id': 'openai_1', 'type': 'llm_chat', 'params': {'provider': 'openai', 'model_name': 'gpt-4o-mini', 'api_key_env': 'OPENAI_API_KEY'}},
        ],
        edges=[],
        tools=[
            {'id': 'lm_tool', 'type': 'tool_llm_worker', 'params': {'provider': 'lm_studio', 'model_name': 'qwen2.5', 'api_base_url': 'http://127.0.0.1:1234/v1', 'system_prompt': 'help'}},
            {'id': 'sub_tool', 'type': 'sub_agent_tool', 'params': {'target_group': 'cast', 'target_agent': 'gm', 'provider': 'openai', 'model_name': 'gpt-4o-mini', 'api_key_env': 'OPENAI_API_KEY'}},
        ],
        ui_context={'artifact_type': 'graph', 'execution_profile': 'langgraph_async', 'project_mode': 'langgraph'},
    )
    langchain_payload = GraphPayload(
        graph_id='v91_provider_matrix_langchain',
        nodes=[
            {'id': 'ollama_1', 'type': 'react_agent', 'params': {'provider': 'ollama', 'model_name': 'llama3', 'tools_linked': []}},
        ],
        edges=[],
        tools=[],
        ui_context={'artifact_type': 'agent', 'execution_profile': 'langchain_agent', 'project_mode': 'langchain'},
    )
    issues = find_runtime_preflight_issues(langgraph_payload) + find_runtime_preflight_issues(langchain_payload)
    provider_issue_codes = {issue['code'] for issue in issues if issue['entryType'] in {'llm_chat', 'react_agent', 'tool_llm_worker', 'sub_agent_tool'}}
    assert provider_issue_codes == set()

    requirements = collect_runtime_dependency_requirements(langgraph_payload) + collect_runtime_dependency_requirements(langchain_payload)
    packages = {item['package'] for item in requirements}
    modules = {item['module'] for item in requirements}
    assert {'langchain-openai', 'langchain-ollama'} <= packages
    assert {'langchain_openai', 'langchain_ollama'} <= modules


def test_frontend_phase3_surfaces_reference_runtime_prompt_provenance() -> None:
    state_panel_text = STATE_PANEL.read_text(encoding='utf-8')
    inspector_text = INSPECTOR.read_text(encoding='utf-8')

    assert '__prompt_strip_meta__' in state_panel_text
    assert 'Compiled/runtime provenance:' in state_panel_text
    assert '__prompt_strip_meta__' in inspector_text
    assert 'Runtime provenance available via' in inspector_text

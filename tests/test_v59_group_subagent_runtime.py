from __future__ import annotations

import io
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from core.compiler import compile_graph
from core.schemas import GraphNode, GraphPayload, GraphTool, NodeParams, ToolParams, UIContext, RuntimeSettings, SubagentDefinition, SubagentGroup

NODE_CONFIG = ROOT / 'client' / 'src' / 'nodeConfig.ts'
CUSTOM_NODE = ROOT / 'client' / 'src' / 'components' / 'CustomNode.tsx'
STATE_PANEL = ROOT / 'client' / 'src' / 'components' / 'StatePanelContent.tsx'
CAP_INSPECTOR = ROOT / 'client' / 'src' / 'components' / 'CapabilityInspectorSection.tsx'


def _base_payload(tool: GraphTool) -> GraphPayload:
    return GraphPayload(
        graph_id='v59_subagent_runtime_graph',
        ui_context=UIContext(
            artifact_type='agent',
            execution_profile='langchain_agent',
            project_mode='langchain',
            runtime_settings=RuntimeSettings(
                subagentLibrary=[
                    SubagentGroup(
                        name='default',
                        agents=[
                            SubagentDefinition(name='research', systemPrompt='You are the research specialist.', tools=['tool_rpg_dice_roller_1'], description='Research specialist'),
                            SubagentDefinition(name='writer', systemPrompt='You are the writer specialist.', tools=[], description='Writing specialist'),
                        ],
                    )
                ]
            ),
        ),
        nodes=[
            GraphNode(id='react_agent_1', type='react_agent', params=NodeParams(tools_linked=[tool.id], provider='openai', model_name='gpt-4o-mini')),
        ],
        edges=[],
        tools=[GraphTool(id='tool_rpg_dice_roller_1', type='rpg_dice_roller', description='dice'), tool],
        is_async=True,
    )


def test_ui_surfaces_support_library_backed_group_or_agent_subagent_selection() -> None:
    node_text = NODE_CONFIG.read_text(encoding='utf-8')
    custom_node_text = CUSTOM_NODE.read_text(encoding='utf-8')
    state_text = STATE_PANEL.read_text(encoding='utf-8')
    inspector_text = CAP_INSPECTOR.read_text(encoding='utf-8')

    assert "placeholder: 'research_agent (optionnel)'" in node_text
    assert 'SubagentLibrarySelectorField' in custom_node_text
    assert 'Dispatch par groupe' in custom_node_text
    assert 'dispatch borné sur le groupe' in state_text
    assert 'Leaving the subagent empty enables bounded group dispatch' in inspector_text


def test_compile_direct_subagent_tool_wrapper_still_works() -> None:
    payload = _base_payload(
        GraphTool(
            id='tool_sub_agent_1',
            type='sub_agent_tool',
            description='delegate to one subagent',
            params=ToolParams(target_group='default', target_agent='research', provider='openai', model_name='gpt-4o-mini'),
        )
    )
    zip_buffer = compile_graph(payload)
    with zipfile.ZipFile(io.BytesIO(zip_buffer.getvalue()), 'r') as zf:
        tools_py = zf.read('v59_subagent_runtime_graph/tools.py').decode('utf-8')
        nodes_py = zf.read('v59_subagent_runtime_graph/nodes.py').decode('utf-8')

    assert 'async def tool_sub_agent_1(query: str) -> str' in tools_py
    assert 'target_agent = "research"' in tools_py
    assert 'SUBAGENT_TOOL_HINTS' in nodes_py
    assert 'research' in tools_py


def test_compile_group_dispatch_subagent_tool_wrapper_is_generated() -> None:
    payload = _base_payload(
        GraphTool(
            id='tool_sub_agent_1',
            type='sub_agent_tool',
            description='dispatch to one agent from the group',
            params=ToolParams(target_group='default', target_agent='', provider='openai', model_name='gpt-4o-mini', max_invocations=2),
        )
    )
    zip_buffer = compile_graph(payload)
    with zipfile.ZipFile(io.BytesIO(zip_buffer.getvalue()), 'r') as zf:
        tools_py = zf.read('v59_subagent_runtime_graph/tools.py').decode('utf-8')
        nodes_py = zf.read('v59_subagent_runtime_graph/nodes.py').decode('utf-8')

    assert 'async def tool_sub_agent_1(agent_name: str, description: str) -> str' in tools_py
    assert 'Available agents are injected from the selected subagent group at compile time.' in tools_py
    assert "writer" in tools_py and "research" in tools_py
    assert 'max_invocations=2' in tools_py

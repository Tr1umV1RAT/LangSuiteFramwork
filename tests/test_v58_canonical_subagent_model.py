from __future__ import annotations

import io
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from core.compiler import compile_graph
from core.schemas import GraphNode, GraphPayload, GraphTool, NodeParams, ToolParams, UIContext, RuntimeSettings, SubagentGroup, SubagentDefinition

NODE_CONFIG = ROOT / 'client' / 'src' / 'nodeConfig.ts'
STATE_PANEL = ROOT / 'client' / 'src' / 'components' / 'StatePanelContent.tsx'
CAP_MATRIX = ROOT / 'client' / 'src' / 'capabilityMatrix.json'


def test_ui_surfaces_promote_tool_sub_agent_as_canonical_subagent() -> None:
    node_text = NODE_CONFIG.read_text(encoding='utf-8')
    state_text = STATE_PANEL.read_text(encoding='utf-8')
    matrix_text = CAP_MATRIX.read_text(encoding='utf-8')

    assert "label: 'Agent Artifact'" in node_text
    assert "label: 'Subagent'" in node_text
    assert 'Bibliothèque de sous-agents' in state_text
    assert 'Usage canonique' in state_text
    assert 'Canonical subagent surface' in matrix_text
    assert 'bibliothèque' in state_text.lower()


def test_subagent_library_runtime_settings_are_embedded_in_compiled_tools() -> None:
    payload = GraphPayload(
        graph_id='v58_subagent_library_graph',
        ui_context=UIContext(
            artifact_type='agent',
            execution_profile='langchain_agent',
            project_mode='langchain',
            runtime_settings=RuntimeSettings(
                subagentLibrary=[
                    SubagentGroup(
                        name='default',
                        agents=[
                            SubagentDefinition(
                                name='research_agent',
                                systemPrompt='You are a research subagent.',
                                tools=['tool_rpg_dice_roller_1'],
                                description='Research helper',
                            )
                        ],
                    )
                ]
            ),
        ),
        nodes=[
            GraphNode(id='react_agent_1', type='react_agent', params=NodeParams(tools_linked=['tool_sub_agent_1'], provider='openai', model_name='gpt-4o-mini')),
        ],
        edges=[],
        tools=[
            GraphTool(
                id='tool_rpg_dice_roller_1',
                type='rpg_dice_roller',
                description='dice',
            ),
            GraphTool(
                id='tool_sub_agent_1',
                type='sub_agent_tool',
                description='subagent tool',
                params=ToolParams(target_group='default', target_agent='research_agent', provider='openai', model_name='gpt-4o-mini'),
            ),
        ],
        is_async=True,
    )
    zip_buffer = compile_graph(payload)
    with zipfile.ZipFile(io.BytesIO(zip_buffer.getvalue()), 'r') as zf:
        tools_py = zf.read('v58_subagent_library_graph/tools.py').decode('utf-8')
    assert 'SUBAGENT_LIBRARY' in tools_py
    assert 'research_agent' in tools_py
    assert 'You are a research subagent.' in tools_py
    assert 'target_group = "default"' in tools_py
    assert 'target_agent = "research_agent"' in tools_py

from __future__ import annotations

import json
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.compiler import compile_graph
from core.schemas import GraphNode, GraphPayload, GraphTool, NodeParams

CAP_MATRIX = ROOT / "client" / "src" / "capabilityMatrix.json"
CUSTOM_NODE = ROOT / "client" / "src" / "components" / "CustomNode.tsx"
BLOCKS_PANEL = ROOT / "client" / "src" / "components" / "BlocksPanelContent.tsx"
INSPECTOR = ROOT / "client" / "src" / "components" / "CapabilityInspectorSection.tsx"


def test_capability_matrix_exposes_authored_tool_semantics() -> None:
    matrix = json.loads(CAP_MATRIX.read_text(encoding="utf-8"))["nodeTypes"]

    assert matrix["llm_chat"]["toolProvisioningModel"] == "author_linked"
    assert matrix["llm_chat"]["toolSelectionAuthority"] == "bounded_model_choice"
    assert matrix["llm_chat"]["toolAccessScope"] == "linked_tools_only"
    assert matrix["llm_chat"]["toolResultModel"] == "tool_observation_loop"

    assert matrix["react_agent"]["toolProvisioningModel"] == "author_linked"
    assert matrix["tool_executor"]["toolProvisioningModel"] == "explicit_step"
    assert matrix["tool_executor"]["toolSelectionAuthority"] == "runtime_step"

    assert matrix["tool_web_search"]["toolProvisioningModel"] == "tool_surface"
    assert matrix["tool_web_search"]["toolResultModel"] == "returned_tool_payload"


def test_generated_llm_node_prompt_binds_only_author_linked_tools() -> None:
    payload = GraphPayload(
        graph_id="v65_authored_tool_contract",
        nodes=[
            GraphNode(
                id="chat_1",
                type="llm_chat",
                position={"x": 0, "y": 0},
                params=NodeParams(
                    provider="openai",
                    model_name="gpt-4o-mini",
                    system_prompt="Use tools carefully.",
                    tools_linked=["search_tool"],
                ),
            )
        ],
        edges=[],
        tools=[GraphTool(id="search_tool", type="web_search", params={"tavily_api_key": "TAVILY_API_KEY"})],
    )
    buf = compile_graph(payload)
    with zipfile.ZipFile(buf) as zf:
        nodes_py = zf.read("v65_authored_tool_contract/nodes.py").decode("utf-8")

    assert "Tool contract: only the tools explicitly linked by the workflow author are available to this node." in nodes_py
    assert "Do not assume access to any unlinked provider, hidden system tool, or global toolbox." in nodes_py


def test_ui_surfaces_show_author_wired_and_bounded_choice_semantics() -> None:
    custom_text = CUSTOM_NODE.read_text(encoding="utf-8")
    blocks_text = BLOCKS_PANEL.read_text(encoding="utf-8")
    inspector_text = INSPECTOR.read_text(encoding="utf-8")

    assert "author-wired" in custom_text
    assert "bounded-choice" in custom_text
    assert "author-wired" in blocks_text
    assert "bounded-choice" in blocks_text
    assert "Tool provisioning" in inspector_text
    assert "Tool selection authority" in inspector_text
    assert "Tool access scope" in inspector_text
    assert "Tool result delivery" in inspector_text
    assert "only the linked subset is exposed to this node at runtime" in custom_text

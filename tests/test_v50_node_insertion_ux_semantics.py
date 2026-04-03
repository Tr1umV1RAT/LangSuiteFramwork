from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NODE_CONFIG = ROOT / "client" / "src" / "nodeConfig.ts"
CATALOG = ROOT / "client" / "src" / "catalog.ts"
CAP_MATRIX = ROOT / "client" / "src" / "capabilityMatrix.json"
CUSTOM_NODE = ROOT / "client" / "src" / "components" / "CustomNode.tsx"
INSPECTOR = ROOT / "client" / "src" / "components" / "CapabilityInspectorSection.tsx"
STORE = ROOT / "client" / "src" / "store.ts"
SCHEMAS = ROOT / "core" / "schemas.py"


def test_subgraph_and_subagent_surfaces_are_distinct_in_ui_and_catalog() -> None:
    node_text = NODE_CONFIG.read_text(encoding="utf-8")
    catalog_text = CATALOG.read_text(encoding="utf-8")
    matrix = json.loads(CAP_MATRIX.read_text(encoding="utf-8"))

    assert "subgraph_node" in node_text
    assert "label: 'Subgraph'" in node_text
    assert "label: 'Subagent'" in node_text
    assert "if (kind === 'graph' || kind === 'subgraph') return 'subgraph_node';" in catalog_text
    assert matrix['nodeTypes']['subgraph_node']['compileAliasType'] == 'sub_agent'
    assert matrix['nodeTypes']['sub_agent']['origin'] == 'langchain'
    assert matrix['nodeTypes']['subgraph_node']['origin'] == 'langgraph'


def test_store_and_schemas_enforce_subgraph_vs_subagent_reference_story() -> None:
    store_text = STORE.read_text(encoding="utf-8")
    schemas_text = SCHEMAS.read_text(encoding="utf-8")
    assert 'wrong_reference_family' in store_text
    assert 'Use subgraph_node for child subgraphs.' in store_text
    assert 'subgraph_node' in schemas_text


def test_ui_surfaces_explain_that_handles_are_authoring_affordances() -> None:
    custom_text = CUSTOM_NODE.read_text(encoding="utf-8")
    inspector_text = INSPECTOR.read_text(encoding="utf-8")
    assert 'The tools handle marks a capability on the authored block, not a guarantee that tool-calling is active.' in custom_text
    assert 'Handles in the editor are ergonomic attachment points.' in inspector_text
    assert 'subgraph_node' in custom_text

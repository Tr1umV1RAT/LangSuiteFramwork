from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NODE_CONFIG = ROOT / 'client' / 'src' / 'nodeConfig.ts'
CAP_MATRIX = ROOT / 'client' / 'src' / 'capabilityMatrix.json'


def _node_types_from_config() -> list[str]:
    text = NODE_CONFIG.read_text(encoding='utf-8')
    seen: list[str] = []
    for name in re.findall(r"\n\s{2}([A-Za-z0-9_]+): \{", text):
        if name not in seen:
            seen.append(name)
    return seen


def test_every_ui_node_has_explicit_runtime_metadata() -> None:
    node_types = _node_types_from_config()
    matrix = json.loads(CAP_MATRIX.read_text(encoding='utf-8'))
    overrides = matrix['nodeTypes']
    missing = [name for name in node_types if name not in overrides]
    assert missing == []


def test_overloaded_and_advanced_surfaces_have_clearer_metadata() -> None:
    matrix = json.loads(CAP_MATRIX.read_text(encoding='utf-8'))['nodeTypes']

    assert matrix['sub_agent']['wrapperBacked'] is True
    assert 'bridge' in matrix['sub_agent']['quickProps']
    assert 'embedded' in matrix['sub_agent']['quickProps']

    assert matrix['deep_agent_suite']['adapterBacked'] is True
    assert matrix['deep_agent_suite']['surfaceLevel'] == 'advanced'
    assert matrix['tool_executor']['executionPlacement'] == 'tool'
    assert matrix['tool_executor']['executionFlavor'] == 'tool-call'


def test_code_and_tool_surfaces_are_explicitly_described() -> None:
    matrix = json.loads(CAP_MATRIX.read_text(encoding='utf-8'))['nodeTypes']

    assert matrix['python_executor_node']['executionPlacement'] == 'runtime'
    assert matrix['python_executor_node']['surfaceLevel'] == 'advanced'
    assert 'code' in matrix['python_executor_node']['quickProps']

    assert matrix['tool_python_repl']['executionPlacement'] == 'tool'
    assert matrix['tool_python_function']['executionPlacement'] == 'tool'
    assert matrix['tool_sql_query']['executionPlacement'] == 'tool'

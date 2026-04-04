from __future__ import annotations

import io
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.artifact_registry import get_artifact
from core.compiler import compile_graph
from core.runtime_dependencies import (
    collect_runtime_dependency_requirements,
    collect_runtime_requirement_specs,
)
from core.schemas import GraphPayload
from tests.jdr_test_helpers import build_graph_payload

REQUIREMENTS_TXT = ROOT / 'requirements.txt'


def _zip_text(buf: io.BytesIO, graph_id: str, filename: str) -> str:
    with zipfile.ZipFile(io.BytesIO(buf.getvalue()), 'r') as zf:
        return zf.read(f'{graph_id}/{filename}').decode('utf-8')


def test_runtime_dependency_collector_tracks_checkpoint_and_requests_for_async_user_input_graph() -> None:
    payload = GraphPayload(
        graph_id='v96_checkpoint_deps',
        nodes=[
            {'id': 'input_1', 'type': 'user_input_node', 'params': {}},
            {'id': 'llm_1', 'type': 'llm_chat', 'params': {}},
        ],
        edges=[{'source': 'input_1', 'target': 'llm_1', 'type': 'direct'}],
        tools=[],
        is_async=True,
    )

    requirements = collect_runtime_dependency_requirements(payload)
    packages = {item['package'] for item in requirements}

    assert 'requests' in packages
    assert 'langgraph-checkpoint' in packages


def test_runtime_dependency_collector_tracks_sqlite_checkpoint_runtime() -> None:
    payload = GraphPayload(
        graph_id='v96_sqlite_checkpoint_deps',
        nodes=[
            {'id': 'interrupt_1', 'type': 'human_interrupt', 'params': {}},
        ],
        edges=[],
        tools=[],
        is_async=True,
        config={'persistence_type': 'sqlite'},
    )

    requirements = collect_runtime_dependency_requirements(payload)
    packages = {item['package'] for item in requirements}

    assert 'langgraph-checkpoint' in packages
    assert 'langgraph-checkpoint-sqlite' in packages
    assert 'aiosqlite' in packages


def test_generated_jdr_requirements_match_runtime_dependency_collector() -> None:
    manifest = get_artifact('graph', 'jdr_solo_session_starter')
    assert manifest is not None
    artifact = manifest['artifact']

    payload = build_graph_payload(artifact, artifact['runtimeSettings'], graph_id='v96_jdr_requirements')
    expected_specs = collect_runtime_requirement_specs(payload)

    buf = compile_graph(payload)
    requirements_txt = _zip_text(buf, payload.graph_id, 'requirements.txt').splitlines()
    generated_specs = [line.strip() for line in requirements_txt if line.strip()]
    graph_py = _zip_text(buf, payload.graph_id, 'graph.py')

    assert 'from langgraph.checkpoint.memory import MemorySaver' in graph_py
    assert 'langgraph-checkpoint>=2.0.0' in generated_specs
    assert generated_specs == expected_specs
    assert 'langchain-community>=0.3.0' not in generated_specs
    assert 'langchain-experimental>=0.3.0' not in generated_specs


def test_root_requirements_cover_core_runtime_and_selectable_provider_packages() -> None:
    text = REQUIREMENTS_TXT.read_text(encoding='utf-8')

    assert 'langgraph-checkpoint>=2.0.0' in text
    assert 'requests>=2.31.0' in text
    assert 'langchain-ollama>=0.2.0' in text
    assert 'langchain-google-genai>=2.0.0' in text
    assert 'langchain-google-vertexai>=2.0.0' in text
    assert 'langchain-mistralai>=0.2.0' in text

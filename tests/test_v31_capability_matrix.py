import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient

from core.capability_matrix import (
    artifact_directory_map,
    known_artifact_kinds,
    known_execution_profiles,
    visible_artifact_kinds,
    visible_execution_profiles,
)
from core.artifact_registry import list_artifacts
from main import app


MATRIX_PATH = ROOT / 'client' / 'src' / 'capabilityMatrix.json'


def test_backend_capability_loader_matches_shared_matrix_json():
    matrix = json.loads(MATRIX_PATH.read_text(encoding='utf-8'))

    assert tuple(matrix['artifactKinds'].keys()) == known_artifact_kinds()
    assert tuple(matrix['executionProfiles'].keys()) == known_execution_profiles()
    assert tuple(kind for kind, meta in matrix['artifactKinds'].items() if meta.get('visible')) == visible_artifact_kinds()
    assert tuple(profile for profile, meta in matrix['executionProfiles'].items() if meta.get('visible')) == visible_execution_profiles()
    assert artifact_directory_map()['graph'] == matrix['artifactKinds']['graph']['artifactDirectory']
    assert artifact_directory_map()['subgraph'] == matrix['artifactKinds']['subgraph']['artifactDirectory']


def test_artifact_registry_visibility_and_hidden_expansion_follow_matrix_truth():
    visible = list_artifacts()
    assert {item['kind'] for item in visible} <= {'graph', 'subgraph'}

    expanded = list_artifacts(include_hidden=True)
    assert {'graph', 'subgraph', 'agent', 'deep_agent'} <= {item['kind'] for item in expanded}


def test_artifact_api_preserves_visible_default_and_hidden_expansion():
    client = TestClient(app)

    visible_response = client.get('/api/artifacts')
    assert visible_response.status_code == 200
    visible_payload = visible_response.json()
    assert all(item['kind'] in {'graph', 'subgraph'} for item in visible_payload)

    expanded_response = client.get('/api/artifacts?include_hidden=true')
    assert expanded_response.status_code == 200
    expanded_payload = expanded_response.json()
    assert {'graph', 'subgraph', 'agent', 'deep_agent'} <= {item['kind'] for item in expanded_payload}

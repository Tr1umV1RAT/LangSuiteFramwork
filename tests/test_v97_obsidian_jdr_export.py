from __future__ import annotations

import io
import json
import sys
import zipfile
from pathlib import Path

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.artifact_registry import get_artifact
from main import app
from tests.jdr_test_helpers import node_payload


def _starter_payload() -> dict:
    manifest = get_artifact('graph', 'jdr_solo_session_starter')
    assert manifest is not None
    artifact = manifest['artifact']
    return {
        'graph_id': 'jdr_obsidian_export',
        'ui_context': {
            'tab_id': 'active_tab',
            'artifact_type': 'graph',
            'execution_profile': 'langgraph_async',
            'project_mode': 'langgraph',
            'runtime_settings': artifact['runtimeSettings'],
        },
        'nodes': [node_payload(node) for node in artifact['nodes']],
        'edges': artifact['edges'],
        'tools': artifact['tools'],
        'is_async': artifact.get('isAsync', True),
    }


def test_obsidian_vault_export_endpoint_returns_zip_with_expected_notes() -> None:
    client = TestClient(app)
    response = client.post('/api/obsidian/vault', json=_starter_payload())
    assert response.status_code == 200
    assert response.headers['content-type'].startswith('application/zip')
    assert 'jdr_obsidian_export-obsidian-gm-vault.zip' in response.headers['content-disposition']

    with zipfile.ZipFile(io.BytesIO(response.content), 'r') as zf:
        names = set(zf.namelist())
        root_prefix = 'jdr_obsidian_export Obsidian Vault/'
        assert f'{root_prefix}00 Session Hub.md' in names
        assert f'{root_prefix}Graphs/Graph Runtime.md' in names
        assert f'{root_prefix}Scenes/Current Scene.md' in names
        assert f'{root_prefix}Scenes/Scene Index.md' in names
        assert f'{root_prefix}Scenes/opening_arrival - Opening Arrival.md' in names
        assert f'{root_prefix}Sessions/Current Session.md' in names
        assert f'{root_prefix}Encounters/Encounter Index.md' in names
        assert f'{root_prefix}Encounters/opening_arrival - Opening Arrival Encounter.md' in names
        assert f'{root_prefix}Locations/Location Index.md' in names
        assert f'{root_prefix}Locations/roadside_inn - Roadside Inn.md' in names
        assert f'{root_prefix}Dashboards/GM Dashboard.md' in names
        assert f'{root_prefix}Modules/Loaded Modules.md' in names
        assert f'{root_prefix}Prompts/Active Prompt Strips.md' in names
        assert f'{root_prefix}_langsuite/graph_payload.json' in names
        assert f'{root_prefix}_langsuite/export_manifest.json' in names
        assert f'{root_prefix}Party/Roadside Cast.md' in names
        assert f'{root_prefix}Cast/NPC Index.md' in names
        assert f'{root_prefix}Cast/Roadside Cast/Index.md' in names

        home = zf.read(f'{root_prefix}00 Session Hub.md').decode('utf-8')
        runtime = zf.read(f'{root_prefix}Graphs/Graph Runtime.md').decode('utf-8')
        modules = zf.read(f'{root_prefix}Modules/Loaded Modules.md').decode('utf-8')
        scene = zf.read(f'{root_prefix}Scenes/opening_arrival - Opening Arrival.md').decode('utf-8')
        encounter = zf.read(f'{root_prefix}Encounters/opening_arrival - Opening Arrival Encounter.md').decode('utf-8')
        location = zf.read(f'{root_prefix}Locations/roadside_inn - Roadside Inn.md').decode('utf-8')
        dashboard = zf.read(f'{root_prefix}Dashboards/GM Dashboard.md').decode('utf-8')
        payload_json = json.loads(zf.read(f'{root_prefix}_langsuite/graph_payload.json').decode('utf-8'))
        manifest_json = json.loads(zf.read(f'{root_prefix}_langsuite/export_manifest.json').decode('utf-8'))

    assert 'Obsidian companion for a tabletop session powered by LangSuite graphs' in home
    assert '[[Dashboards/GM Dashboard]]' in home
    assert 'The graph remains the runtime source of truth.' in home
    assert 'powered by the LangSuite graph' in runtime
    assert '[[Party/Roadside Cast]]' in modules
    assert 'Secure shelter, read the room' in scene
    assert '## Participants' in encounter
    assert '## Site notes' in location
    assert '```dataview' in dashboard
    assert payload_json['graph_id'] == 'jdr_obsidian_export'
    assert manifest_json['schema_version'] == 'obsidian_gm_v1'


def test_obsidian_vault_export_contains_prompt_and_cast_notes() -> None:
    client = TestClient(app)
    response = client.post('/api/obsidian/vault', json=_starter_payload())
    assert response.status_code == 200

    with zipfile.ZipFile(io.BytesIO(response.content), 'r') as zf:
        names = set(zf.namelist())
        assert any(name.endswith('Prompts/Fair GM conduct.md') for name in names)
        assert any(name.endswith('Cast/Roadside Cast/Innkeeper.md') for name in names)
        prompt_note_name = next(name for name in names if name.endswith('Prompts/Fair GM conduct.md'))
        agent_note_name = next(name for name in names if name.endswith('Cast/Roadside Cast/Innkeeper.md'))
        prompt_note = zf.read(prompt_note_name).decode('utf-8')
        agent_note = zf.read(agent_note_name).decode('utf-8')

    assert 'Applied to' in prompt_note
    assert '## Body' in prompt_note
    assert '## System prompt' in agent_note
    assert 'note_type: "npc"' in agent_note

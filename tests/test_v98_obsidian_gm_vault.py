from __future__ import annotations

import io
import json
import sys
import zipfile
from pathlib import Path

from core.artifact_registry import get_artifact
from core.obsidian_export import build_obsidian_vault
from core.schemas import GraphPayload
from tests.jdr_test_helpers import node_payload

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def _payload_model() -> GraphPayload:
    manifest = get_artifact('graph', 'jdr_solo_session_starter')
    assert manifest is not None
    artifact = manifest['artifact']
    return GraphPayload(
        graph_id='jdr_obsidian_export',
        ui_context={
            'tab_id': 'active_tab',
            'artifact_type': 'graph',
            'execution_profile': 'langgraph_async',
            'project_mode': 'langgraph',
            'runtime_settings': artifact['runtimeSettings'],
        },
        nodes=[node_payload(node) for node in artifact['nodes']],
        edges=artifact['edges'],
        tools=artifact['tools'],
        is_async=artifact.get('isAsync', True),
    )


def test_obsidian_gm_vault_manifest_and_frontmatter_are_consistent() -> None:
    payload = _payload_model()
    buffer = build_obsidian_vault(payload)

    with zipfile.ZipFile(io.BytesIO(buffer.getvalue()), 'r') as zf:
        names = set(zf.namelist())
        root_prefix = 'jdr_obsidian_export Obsidian Vault/'
        manifest = json.loads(zf.read(f'{root_prefix}_langsuite/export_manifest.json').decode('utf-8'))
        session = zf.read(f'{root_prefix}Sessions/Current Session.md').decode('utf-8')
        scene = zf.read(f'{root_prefix}Scenes/opening_arrival - Opening Arrival.md').decode('utf-8')
        encounter = zf.read(f'{root_prefix}Encounters/opening_arrival - Opening Arrival Encounter.md').decode('utf-8')
        location = zf.read(f'{root_prefix}Locations/roadside_inn - Roadside Inn.md').decode('utf-8')
        npc_index = zf.read(f'{root_prefix}Cast/NPC Index.md').decode('utf-8')

    assert f'{root_prefix}Dashboards/GM Dashboard.md' in names
    assert f'{root_prefix}Sessions/Session Log.md' in names
    assert f'{root_prefix}Cast/Roadside Cast/Guard.md' in names

    for content in [session, scene, encounter, location]:
        assert 'langsuite_export_version: "obsidian_gm_v1"' in content
        assert 'source_entity_id:' in content
        assert 'note_type:' in content

    assert 'Roadside Arrival' in session
    assert 'objective: "Secure shelter, read the room, and learn what happened on the road"' in scene
    assert 'participants:' in encounter
    assert 'location_id: "roadside_inn"' in location
    assert '## Roadside Cast' in npc_index

    manifest_paths = {entry['path'] for entry in manifest['notes']}
    assert 'Scenes/opening_arrival - Opening Arrival.md' in manifest_paths
    assert 'Encounters/opening_arrival - Opening Arrival Encounter.md' in manifest_paths
    assert 'Locations/roadside_inn - Roadside Inn.md' in manifest_paths
    assert 'Sessions/Current Session.md' in manifest_paths

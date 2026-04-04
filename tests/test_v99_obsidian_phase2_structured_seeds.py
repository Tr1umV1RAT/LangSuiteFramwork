from __future__ import annotations

import io
import sys
import zipfile
from copy import deepcopy
from pathlib import Path

from core.artifact_registry import get_artifact
from core.obsidian_export import build_obsidian_vault
from core.schemas import GraphPayload
from tests.jdr_test_helpers import node_payload

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def _payload_with_phase2_seeds() -> GraphPayload:
    manifest = get_artifact('graph', 'jdr_solo_session_starter')
    assert manifest is not None
    artifact = manifest['artifact']
    runtime = deepcopy(artifact['runtimeSettings'])

    runtime['clockSeeds'] = [
        {
            'id': 'clock_storm_arrival',
            'title': 'Storm Front Arrival',
            'status': 'active',
            'segments': 6,
            'progress': 2,
            'trigger': 'When the clock is filled',
            'consequence': 'The storm hits the inn and travel routes collapse',
            'factionIds': ['faction_road_wardens'],
            'linkedSceneIds': ['opening_arrival'],
            'linkedEncounterIds': ['opening_arrival'],
            'publicVisible': False,
        }
    ]
    runtime['factionSeeds'] = [
        {
            'id': 'faction_road_wardens',
            'title': 'Road Wardens',
            'tier': 'local',
            'factionType': 'military',
            'agenda': 'Keep the road open while maintaining order in settlements.',
            'resources': ['Mounted patrols', 'Road beacons'],
            'sceneIds': ['opening_arrival'],
            'clockIds': ['clock_storm_arrival'],
        }
    ]
    runtime['hookSeeds'] = [
        {
            'id': 'hook_missing_messenger',
            'title': 'Missing Messenger',
            'hookKind': 'mystery',
            'triggerCondition': 'After first rest at the inn',
            'content': 'A courier vanished before reaching the wardens outpost.',
            'targets': [
                {'targetType': 'scene', 'targetId': 'opening_arrival', 'weight': 1.0},
                {'targetType': 'faction', 'targetId': 'faction_road_wardens', 'weight': 0.8},
            ],
            'hidden': True,
            'used': False,
        }
    ]

    return GraphPayload(
        graph_id='jdr_phase2_obsidian_export',
        ui_context={
            'tab_id': 'active_tab',
            'artifact_type': 'graph',
            'execution_profile': 'langgraph_async',
            'project_mode': 'langgraph',
            'runtime_settings': runtime,
        },
        nodes=[node_payload(node) for node in artifact['nodes']],
        edges=artifact['edges'],
        tools=artifact['tools'],
        is_async=artifact.get('isAsync', True),
    )


def test_obsidian_export_includes_phase2_pressure_entities() -> None:
    payload = _payload_with_phase2_seeds()
    buffer = build_obsidian_vault(payload)

    with zipfile.ZipFile(io.BytesIO(buffer.getvalue()), 'r') as zf:
        names = set(zf.namelist())
        root_prefix = 'jdr_phase2_obsidian_export Obsidian Vault/'

        assert f'{root_prefix}Dashboards/Pressure Dashboard.md' in names
        assert f'{root_prefix}Clocks/Clock Index.md' in names
        assert f'{root_prefix}Factions/Faction Index.md' in names
        assert f'{root_prefix}Hooks/Hook Index.md' in names

        assert f'{root_prefix}Clocks/clock_storm_arrival - Storm Front Arrival.md' in names
        assert f'{root_prefix}Factions/faction_road_wardens - Road Wardens.md' in names
        assert f'{root_prefix}Hooks/hook_missing_messenger - Missing Messenger.md' in names

        pressure_dashboard = zf.read(f'{root_prefix}Dashboards/Pressure Dashboard.md').decode('utf-8')
        clock_note = zf.read(f'{root_prefix}Clocks/clock_storm_arrival - Storm Front Arrival.md').decode('utf-8')
        faction_note = zf.read(f'{root_prefix}Factions/faction_road_wardens - Road Wardens.md').decode('utf-8')
        hook_note = zf.read(f'{root_prefix}Hooks/hook_missing_messenger - Missing Messenger.md').decode('utf-8')

    assert 'FROM "Clocks"' in pressure_dashboard
    assert 'FROM "Factions"' in pressure_dashboard
    assert 'FROM "Hooks"' in pressure_dashboard

    assert 'Track: `' in clock_note
    assert '## Linked factions' in clock_note
    assert '## Agenda' in faction_note
    assert '## Targets' in hook_note

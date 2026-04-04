from __future__ import annotations

import sys
from copy import deepcopy
from pathlib import Path

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.artifact_registry import get_artifact
from main import app
from tests.jdr_test_helpers import node_payload


def _sync_payload_dict() -> dict:
    manifest = get_artifact('graph', 'jdr_solo_session_starter')
    assert manifest is not None
    artifact = manifest['artifact']
    runtime = deepcopy(artifact['runtimeSettings'])

    # Ensure phase-2 entities are present for recap patching.
    runtime['sceneSeeds'] = [
        {
            'id': 'opening_arrival',
            'title': 'Opening Arrival',
            'kind': 'opening',
            'status': 'active',
            'objective': 'Secure shelter, read the room, and learn what happened on the road',
            'situation': 'The weather worsens and rumors circulate in the common room.',
            'castGroupNames': ['roadside_cast'],
            'encounterIds': ['opening_arrival'],
            'clockIds': ['clock_storm_arrival'],
        }
    ]

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
            'gmNotes': 'Start as rumor only.',
        }
    ]

    return {
        'graph_id': 'jdr_obsidian_recap_sync',
        'ui_context': {
            'tab_id': 'active_tab',
            'artifact_type': 'graph',
            'execution_profile': 'langgraph_async',
            'project_mode': 'langgraph',
            'runtime_settings': runtime,
        },
        'nodes': [node_payload(node) for node in artifact['nodes']],
        'edges': artifact['edges'],
        'tools': artifact['tools'],
        'is_async': artifact.get('isAsync', True),
    }


def test_obsidian_recap_apply_updates_runtime_settings_with_replace_policy() -> None:
    client = TestClient(app)
    graph_payload = _sync_payload_dict()

    response = client.post(
        '/api/obsidian/recap/apply',
        json={
            'graphPayload': graph_payload,
            'recap': {
                'graphId': 'jdr_obsidian_recap_sync',
                'sessionId': 'session_current',
                'recap': 'The inn was secured and the wardens accepted temporary cooperation.',
                'validatedDecisions': ['Offer shelter to travelers', 'Delay immediate departure due to storm risk'],
                'runtimeContextUpdates': [
                    {'key': 'gm_focus', 'value': 'wardens_and_storm', 'mergePolicy': 'replace'},
                ],
                'scenePatches': [
                    {
                        'sceneId': 'opening_arrival',
                        'status': 'resolved',
                        'objective': 'Shelter secured, alliance path opened',
                        'mergePolicy': 'replace',
                    }
                ],
                'encounterPatches': [
                    {
                        'encounterId': 'opening_arrival',
                        'status': 'active',
                        'pressure': 'high',
                        'stakes': 'The wardens decide whether the party is an asset or liability.',
                        'mergePolicy': 'replace',
                    }
                ],
                'locationPatches': [
                    {
                        'locationId': 'roadside_inn',
                        'summary': 'The inn becomes a temporary alliance point under worsening weather.',
                        'mergePolicy': 'replace',
                    }
                ],
                'clockPatches': [
                    {
                        'clockId': 'clock_storm_arrival',
                        'progress': 4,
                        'status': 'active',
                        'mergePolicy': 'replace',
                    }
                ],
                'factionPatches': [
                    {
                        'factionId': 'faction_road_wardens',
                        'agenda': 'Secure road while preparing evacuation contingencies.',
                        'mergePolicy': 'replace',
                    }
                ],
                'hookPatches': [
                    {
                        'hookId': 'hook_missing_messenger',
                        'used': True,
                        'gmNotes': 'The clue is now public; transition toward investigation scene.',
                        'mergePolicy': 'replace',
                    }
                ],
            },
            'failOnConflict': False,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body['graph_id'] == 'jdr_obsidian_recap_sync'
    assert body['conflictsPresent'] is False
    assert body['report']['applied_count'] >= 4

    runtime = body['runtimeSettings']
    scene = next(item for item in runtime['sceneSeeds'] if item['id'] == 'opening_arrival')
    clock = next(item for item in runtime['clockSeeds'] if item['id'] == 'clock_storm_arrival')
    faction = next(item for item in runtime['factionSeeds'] if item['id'] == 'faction_road_wardens')
    hook = next(item for item in runtime['hookSeeds'] if item['id'] == 'hook_missing_messenger')

    assert scene['status'] == 'resolved'
    assert scene['objective'] == 'Shelter secured, alliance path opened'
    assert clock['progress'] == 4
    assert faction['agenda'] == 'Secure road while preparing evacuation contingencies.'
    assert hook['used'] is True

    context_map = {entry['key']: entry['value'] for entry in runtime['runtimeContext']}
    assert context_map['gm_focus'] == 'wardens_and_storm'
    assert context_map['obsidian_last_recap_session'] == 'session_current'


def test_obsidian_recap_apply_returns_conflict_on_error_policy_when_strict() -> None:
    client = TestClient(app)
    graph_payload = _sync_payload_dict()

    # Force a conflict: opening scene already has an objective in starter runtime.
    response = client.post(
        '/api/obsidian/recap/apply',
        json={
            'graphPayload': graph_payload,
            'recap': {
                'graphId': 'jdr_obsidian_recap_sync',
                'sessionId': 'session_current',
                'scenePatches': [
                    {
                        'sceneId': 'opening_arrival',
                        'objective': 'Contradictory objective from note import',
                        'mergePolicy': 'error',
                    }
                ],
            },
            'failOnConflict': True,
        },
    )

    assert response.status_code == 409
    body = response.json()
    assert body['stage'] == 'recap_conflict'
    assert body['report']['conflict_count'] >= 1
    assert any('scene.opening_arrival.objective' in item for item in body['report']['conflicts'])

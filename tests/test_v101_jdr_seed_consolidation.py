from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.artifact_registry import get_artifact
from tests.jdr_test_helpers import build_guided_runtime_settings


def test_starter_runtime_contains_default_structured_core_seeds() -> None:
    manifest = get_artifact('graph', 'jdr_solo_session_starter')
    assert manifest is not None
    runtime = manifest['artifact']['runtimeSettings']

    assert runtime['sceneSeeds']
    assert runtime['encounterSeeds']
    assert runtime['locationSeeds']
    assert runtime['slotBindings']

    assert runtime['sceneSeeds'][0]['id'] == 'opening_arrival'
    assert runtime['encounterSeeds'][0]['id'] == 'opening_arrival'
    assert runtime['locationSeeds'][0]['id'] == 'roadside_inn'
    assert {entry['slot'] for entry in runtime['slotBindings']} >= {'opening_scene', 'starter_encounter', 'default_location', 'primary_cast'}


def test_guided_runtime_rebuilds_structured_seeds_from_selected_modules() -> None:
    manifest = get_artifact('graph', 'jdr_solo_session_starter')
    assert manifest is not None
    runtime = manifest['artifact']['runtimeSettings']

    guided = build_guided_runtime_settings(runtime, [
        'module_jdr_world_corporate_arcology',
        'module_jdr_rules_hard_choice_clocks',
        'module_jdr_persona_gm_fair_guide',
        'module_jdr_tone_paranoid_intrigue',
        'module_jdr_party_response_team',
        'module_jdr_utility_structured_referee',
    ])

    assert guided['sceneSeeds']
    assert guided['encounterSeeds']
    assert guided['locationSeeds']
    assert guided['sceneSeeds'][0]['id'] == 'breach_alarm'
    assert guided['encounterSeeds'][0]['id'] == 'breach_alarm'
    assert guided['locationSeeds'][0]['id'] == 'service_spine'
    assert {entry['slot'] for entry in guided['slotBindings']} >= {'opening_scene', 'starter_encounter', 'default_location', 'primary_cast'}

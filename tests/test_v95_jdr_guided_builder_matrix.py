from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.artifact_registry import get_artifact
from tests.jdr_test_helpers import PROMPT_ASSIGNMENT_ID_RE, build_graph_payload, build_guided_runtime_settings, runtime_context_value

APP = ROOT / 'client' / 'src' / 'App.tsx'
RUN_PANEL = ROOT / 'client' / 'src' / 'components' / 'RunPanel.tsx'
TABLETOP_DIALOG = ROOT / 'client' / 'src' / 'components' / 'TabletopStarterDialog.tsx'
TABLETOP_HELPER = ROOT / 'client' / 'src' / 'store' / 'tabletopStarter.ts'
WORKSPACE_STORE = ROOT / 'client' / 'src' / 'store.ts'

GUIDED_CASES = [
    {
        'name': 'frontier-default',
        'module_ids': [
            'module_jdr_world_frontier_fantasy',
            'module_jdr_rules_light_narrative',
            'module_jdr_persona_gm_fair_guide',
            'module_jdr_tone_adventure_with_consequence',
            'module_jdr_party_roadside_cast',
            'module_jdr_utility_structured_referee',
        ],
        'setting_id': 'frontier_fantasy',
        'scene_key': 'opening_arrival',
    },
    {
        'name': 'occult-investigation',
        'module_ids': [
            'module_jdr_world_occult_city',
            'module_jdr_rules_dice_forward',
            'module_jdr_persona_gm_fair_guide',
            'module_jdr_tone_mystery_pressure',
            'module_jdr_party_investigator_contacts',
            'module_jdr_utility_structured_referee',
        ],
        'setting_id': 'occult_city',
        'scene_key': 'case_opening',
    },
    {
        'name': 'space-grim',
        'module_ids': [
            'module_jdr_world_space_outpost',
            'module_jdr_rules_dice_forward',
            'module_jdr_persona_gm_fair_guide',
            'module_jdr_tone_grim_consequences',
            'module_jdr_party_station_crew',
            'module_jdr_utility_structured_referee',
        ],
        'setting_id': 'space_outpost',
        'scene_key': 'docking_briefing',
    },
    {
        'name': 'coast-expedition',
        'module_ids': [
            'module_jdr_world_ruined_coast',
            'module_jdr_rules_fiction_first_pressure',
            'module_jdr_persona_gm_fair_guide',
            'module_jdr_tone_hopeful_resistance',
            'module_jdr_party_relic_hunters',
            'module_jdr_utility_structured_referee',
        ],
        'setting_id': 'ruined_coast',
        'scene_key': 'salvage_briefing',
    },
    {
        'name': 'arcology-breach',
        'module_ids': [
            'module_jdr_world_corporate_arcology',
            'module_jdr_rules_hard_choice_clocks',
            'module_jdr_persona_gm_fair_guide',
            'module_jdr_tone_paranoid_intrigue',
            'module_jdr_party_response_team',
            'module_jdr_utility_structured_referee',
        ],
        'setting_id': 'corporate_arcology',
        'scene_key': 'breach_alarm',
    },
]


def test_guided_builder_matrix_runtime_settings_export_cleanly() -> None:
    manifest = get_artifact('graph', 'jdr_solo_session_starter')
    assert manifest is not None
    artifact = manifest['artifact']

    for case in GUIDED_CASES:
        guided_runtime = build_guided_runtime_settings(artifact['runtimeSettings'], case['module_ids'])
        assignment_ids = [entry['id'] for entry in guided_runtime['promptStripAssignments']]
        assert assignment_ids, case['name']
        assert all(':' not in entry_id for entry_id in assignment_ids), case['name']
        assert all(PROMPT_ASSIGNMENT_ID_RE.fullmatch(entry_id) for entry_id in assignment_ids), case['name']
        assert guided_runtime['loadedModuleIds'] == case['module_ids'], case['name']
        assert runtime_context_value(guided_runtime, 'setting_id') == case['setting_id'], case['name']
        assert runtime_context_value(guided_runtime, 'rules_helper') == 'structured_referee', case['name']
        assert runtime_context_value(guided_runtime, 'current_scene') == case['scene_key'], case['name']
        payload = build_graph_payload(artifact, guided_runtime, graph_id=f"jdr_matrix_{case['name']}")
        exported_runtime = payload.ui_context.runtime_settings.model_dump() if payload.ui_context.runtime_settings else {}
        assert exported_runtime['loadedModuleIds'] == case['module_ids'], case['name']
        assert [entry['id'] for entry in exported_runtime['promptStripAssignments']] == assignment_ids, case['name']


def test_guided_builder_source_surfaces_now_treat_runtime_config_as_separate() -> None:
    dialog_text = TABLETOP_DIALOG.read_text(encoding='utf-8')
    helper_text = TABLETOP_HELPER.read_text(encoding='utf-8')
    app_text = APP.read_text(encoding='utf-8')
    store_text = WORKSPACE_STORE.read_text(encoding='utf-8')
    run_panel_text = RUN_PANEL.read_text(encoding='utf-8')

    assert 'Runtime setup comes later' in dialog_text
    assert 'Create session' in dialog_text
    assert 'module_jdr_world_ruined_coast' in helper_text
    assert 'module_jdr_world_corporate_arcology' in helper_text
    assert 'module_jdr_party_relic_hunters' in helper_text
    assert 'module_jdr_party_response_team' in helper_text
    assert 'module_jdr_rules_fiction_first_pressure' in helper_text
    assert 'module_jdr_rules_hard_choice_clocks' in helper_text
    assert 'module_jdr_tone_hopeful_resistance' in helper_text
    assert 'module_jdr_tone_paranoid_intrigue' in helper_text
    assert 'stripRuntimeProviderConfig(clonedNodes)' in helper_text
    assert 'function applyRuntimeProviderConfig' in helper_text
    assert 'isTabletopRuntimeConfigNeeded' in helper_text
    assert "code: 'missing_provider_config'" in store_text
    assert "validationCodes.includes('missing_provider_config')" in run_panel_text
    assert 'Runtime setup needed' in app_text

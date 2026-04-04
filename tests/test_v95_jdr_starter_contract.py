from __future__ import annotations

import io
import re
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.artifact_registry import get_artifact, list_artifacts
from core.compiler import compile_graph
from core.schemas import GraphPayload

APP = ROOT / 'client' / 'src' / 'App.tsx'
SETTINGS = ROOT / 'client' / 'src' / 'components' / 'SettingsShell.tsx'
TYPES = ROOT / 'client' / 'src' / 'store' / 'types.ts'
PREFERENCES = ROOT / 'client' / 'src' / 'store' / 'preferences.ts'
WORKSPACE_STORE = ROOT / 'client' / 'src' / 'store.ts'
ARTIFACT_LIBRARY = ROOT / 'client' / 'src' / 'components' / 'artifacts' / 'ArtifactLibrarySection.tsx'
STATE_PANEL = ROOT / 'client' / 'src' / 'components' / 'StatePanelContent.tsx'
TABLETOP_DIALOG = ROOT / 'client' / 'src' / 'components' / 'TabletopStarterDialog.tsx'
TABLETOP_HELPER = ROOT / 'client' / 'src' / 'store' / 'tabletopStarter.ts'
THEME = ROOT / 'client' / 'src' / 'jdr' / 'theme.ts'
WORKSPACE_HELPERS = ROOT / 'client' / 'src' / 'store' / 'workspace.ts'


def _node_payload(node: dict) -> dict:
    data = node.get('data', {}) if isinstance(node, dict) else {}
    return {
        'id': node.get('id'),
        'type': data.get('nodeType'),
        'params': data.get('params', {}),
    }


def _zip_text(buf: io.BytesIO, graph_id: str, filename: str) -> str:
    with zipfile.ZipFile(io.BytesIO(buf.getvalue()), 'r') as zf:
        return zf.read(f'{graph_id}/{filename}').decode('utf-8')


def test_jdr_starter_is_registered_on_langgraph_surface() -> None:
    items = [item for item in list_artifacts(kind='graph') if item['id'] == 'jdr_solo_session_starter']
    assert len(items) == 1
    item = items[0]
    assert item['projectMode'] == 'langgraph'
    assert item['executionProfile'] == 'langgraph_async'
    assert item['compileSafe'] is True
    assert item['runtimeEnabled'] is True
    assert item['editorOnly'] is False


def test_jdr_starter_manifest_contains_seeded_domain_assets() -> None:
    manifest = get_artifact('graph', 'jdr_solo_session_starter')
    assert manifest is not None
    artifact = manifest['artifact']
    runtime = artifact['runtimeSettings']
    tool_types = {tool['type'] for tool in artifact.get('tools', [])}
    module_ids = set(runtime.get('loadedModuleIds', []))
    module_library_ids = {entry['id'] for entry in runtime.get('moduleLibrary', [])}
    categories = {entry['category'] for entry in runtime.get('moduleLibrary', [])}

    assert artifact['artifactType'] == 'graph'
    assert artifact['executionProfile'] == 'langgraph_async'
    assert artifact['projectMode'] == 'langgraph'
    assert tool_types >= {'rpg_dice_roller', 'sub_agent_tool', 'tool_llm_worker'}
    assert runtime.get('moduleLibrary')
    assert runtime.get('promptStripLibrary')
    assert runtime.get('promptStripAssignments')
    assert runtime.get('subagentLibrary')
    assert runtime.get('runtimeContext')
    assert module_ids == {
        'module_jdr_world_frontier_fantasy',
        'module_jdr_rules_light_narrative',
        'module_jdr_persona_gm_fair_guide',
        'module_jdr_tone_adventure_with_consequence',
        'module_jdr_party_roadside_cast',
        'module_jdr_utility_structured_referee',
    }
    assert {
        'module_jdr_world_ruined_coast',
        'module_jdr_world_corporate_arcology',
        'module_jdr_rules_fiction_first_pressure',
        'module_jdr_rules_hard_choice_clocks',
        'module_jdr_tone_hopeful_resistance',
        'module_jdr_tone_paranoid_intrigue',
        'module_jdr_party_relic_hunters',
        'module_jdr_party_response_team',
        'module_jdr_utility_faction_clock_brief',
        'module_jdr_utility_scene_zero_guardrails',
    } <= module_library_ids
    assert categories >= {'world', 'rules', 'persona', 'party', 'utility'}
    assert runtime['moduleLibrary'][0]['recommendedProfile'] == 'tabletop_demo'
    assert all(entry.get('starterArtifacts') for entry in runtime['moduleLibrary'])
    assert all(any(ref.get('artifactId') == 'jdr_solo_session_starter' for ref in entry.get('starterArtifacts', [])) for entry in runtime['moduleLibrary'])


def test_jdr_starter_is_provider_neutral_at_rest() -> None:
    manifest = get_artifact('graph', 'jdr_solo_session_starter')
    assert manifest is not None
    artifact = manifest['artifact']
    for node in artifact['nodes']:
        params = (node.get('data') or {}).get('params') or {}
        node_type = (node.get('data') or {}).get('nodeType') or ''
        if node_type in {'llm_chat', 'tool_sub_agent', 'tool_llm_worker', 'react_agent'}:
            assert not params.get('provider')
            assert not params.get('model_name')
            assert not params.get('api_key_env')
    for tool in artifact['tools']:
        params = tool.get('params') or {}
        if tool.get('type') in {'sub_agent_tool', 'tool_llm_worker'}:
            assert not params.get('provider')
            assert not params.get('model_name')
            assert not params.get('api_key_env')


def test_jdr_starter_compiles_with_prompt_and_subagent_content() -> None:
    manifest = get_artifact('graph', 'jdr_solo_session_starter')
    assert manifest is not None
    artifact = manifest['artifact']
    tool_ids = {tool['id'] for tool in artifact['tools']}
    assert all(edge.get('source') not in tool_ids and edge.get('target') not in tool_ids for edge in artifact['edges'])

    payload = GraphPayload(
        graph_id='v95_jdr_compile',
        ui_context={
            'tab_id': 'active_tab',
            'artifact_type': 'graph',
            'execution_profile': 'langgraph_async',
            'project_mode': 'langgraph',
            'runtime_settings': artifact['runtimeSettings'],
        },
        nodes=[_node_payload(node) for node in artifact['nodes']],
        edges=artifact['edges'],
        tools=artifact['tools'],
        is_async=artifact.get('isAsync', True),
    )
    buf = compile_graph(payload)
    nodes_py = _zip_text(buf, payload.graph_id, 'nodes.py')
    tools_py = _zip_text(buf, payload.graph_id, 'tools.py')

    assert 'frontier fantasy setting' in nodes_py
    assert 'fair game master' in nodes_py
    assert 'light narrative tabletop loop' in nodes_py
    assert 'Speak as an innkeeper' in tools_py
    assert 'def tool_rpg_dice_roller_1' in tools_py
    assert 'Roll standard tabletop notation such as 1d20, 2d6+1, or 4dF.' in tools_py
    assert 'Speak as an innkeeper' in tools_py
    assert 'Speak as a practical scout' in tools_py
    assert 'Speak as a town guard' in tools_py
    assert 'structured tabletop rules referee' in tools_py
    assert 'roadside_cast' in tools_py




PROMPT_ASSIGNMENT_ID_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def _sanitize_prompt_assignment_identifier(raw: str | None, fallback: str) -> str:
    source = raw.strip() if isinstance(raw, str) and raw.strip() else fallback
    normalized = re.sub(r"[^A-Za-z0-9_]+", "_", source)
    normalized = re.sub(r"_+", "_", normalized).strip("_")
    if not normalized:
        return fallback
    return normalized if re.match(r"^[A-Za-z_]", normalized) else f"prompt_{normalized}"


def _build_prompt_assignment_target_id_part(target: dict) -> str:
    kind = target.get('kind')
    if kind == 'graph':
        return f"graph_{target['tabId']}"
    if kind == 'node':
        return f"node_{target['tabId']}_{target['nodeId']}"
    return f"subagent_{target['tabId']}_{target['groupName']}_{target['agentName']}"


def _build_prompt_assignment_target_key(target: dict) -> str:
    kind = target.get('kind')
    if kind == 'graph':
        return f"graph:{target['tabId']}"
    if kind == 'node':
        return f"node:{target['tabId']}:{target['nodeId']}"
    return f"subagent:{target['tabId']}:{target['groupName']}:{target['agentName']}"


def _sanitize_assignments(assignments: list[dict]) -> list[dict]:
    seen: set[str] = set()
    cleaned: list[dict] = []
    for index, item in enumerate(assignments):
        base_id = _sanitize_prompt_assignment_identifier(item.get('id'), f'prompt_assignment_{index + 1}')
        candidate = base_id
        suffix = 2
        while candidate in seen:
            candidate = f"{base_id}_{suffix}"
            suffix += 1
        seen.add(candidate)
        cleaned.append({**item, 'id': candidate})
    return cleaned


def _merge_prompt_assignments_from_module(base: list[dict], module_entry: dict, tab_id: str) -> list[dict]:
    next_assignments = [dict(item) for item in base]
    existing_keys = {
        f"{item['stripId']}:{_build_prompt_assignment_target_key(item['target'])}:{item['mergeMode']}"
        for item in next_assignments
    }
    max_order_by_target: dict[str, int] = {}
    for item in next_assignments:
        key = _build_prompt_assignment_target_key(item['target'])
        max_order_by_target[key] = max(max_order_by_target.get(key, -1), int(item['order']))
    for index, preset in enumerate(module_entry.get('promptAssignments', [])):
        if preset.get('enabled', True) is False:
            continue
        if preset.get('targetKind') == 'graph':
            target = {'kind': 'graph', 'tabId': tab_id}
        elif preset.get('targetKind') == 'subagent' and preset.get('groupName') and preset.get('agentName'):
            target = {
                'kind': 'subagent',
                'tabId': tab_id,
                'groupName': preset['groupName'],
                'agentName': preset['agentName'],
            }
        else:
            continue
        target_key = _build_prompt_assignment_target_key(target)
        dedupe_key = f"{preset['stripId']}:{target_key}:{preset.get('mergeMode', 'prepend')}"
        if dedupe_key in existing_keys:
            continue
        next_order_base = max_order_by_target.get(target_key, -1) + 1
        order = min(999, max(next_order_base, int(preset.get('order', index))))
        next_assignments.append({
            'id': _sanitize_prompt_assignment_identifier(
                f"{module_entry['id']}__{preset.get('id') or f' preset_{index + 1}'.strip()}__{_build_prompt_assignment_target_id_part(target)}",
                f"prompt_assignment_{len(next_assignments) + 1}",
            ),
            'stripId': preset['stripId'],
            'target': target,
            'mergeMode': preset.get('mergeMode', 'prepend'),
            'order': order,
            'enabled': True,
        })
        existing_keys.add(dedupe_key)
        max_order_by_target[target_key] = order
    return _sanitize_assignments(next_assignments)


def _build_guided_runtime_settings(runtime: dict) -> dict:
    selected_module_ids = [
        'module_jdr_world_occult_city',
        'module_jdr_rules_dice_forward',
        'module_jdr_persona_gm_fair_guide',
        'module_jdr_tone_grim_consequences',
        'module_jdr_party_roadside_cast',
        'module_jdr_utility_structured_referee',
    ]
    module_library = runtime['moduleLibrary']
    module_index = {entry['id']: entry for entry in module_library}
    tab_id = 'starter_tab'
    guided = {
        **runtime,
        'loadedModuleIds': [],
        'promptStripAssignments': [],
        'subagentLibrary': [],
        'runtimeContext': [entry for entry in runtime.get('runtimeContext', []) if entry.get('key') == 'session_kind'],
        'sceneSeeds': [],
        'encounterSeeds': [],
        'locationSeeds': [],
        'clockSeeds': [],
        'factionSeeds': [],
        'hookSeeds': [],
        'slotBindings': [],
    }
    for module_id in selected_module_ids:
        module_entry = module_index[module_id]
        guided['loadedModuleIds'] = [*guided['loadedModuleIds'], module_id]
        guided['promptStripAssignments'] = _merge_prompt_assignments_from_module(guided['promptStripAssignments'], module_entry, tab_id)
        if module_entry.get('subagentGroups'):
            guided['subagentLibrary'] = [*guided['subagentLibrary'], *module_entry['subagentGroups']]
        if module_entry.get('runtimeContext'):
            existing = {entry['key']: entry for entry in guided['runtimeContext']}
            for entry in module_entry['runtimeContext']:
                existing[entry['key']] = entry
            guided['runtimeContext'] = list(existing.values())
        for field in ('sceneSeeds', 'encounterSeeds', 'locationSeeds', 'clockSeeds', 'factionSeeds', 'hookSeeds'):
            if module_entry.get(field):
                existing_by_id = {entry['id']: entry for entry in guided.get(field, []) if isinstance(entry, dict) and entry.get('id')}
                for entry in module_entry.get(field, []):
                    if isinstance(entry, dict) and entry.get('id'):
                        existing_by_id[entry['id']] = entry
                guided[field] = list(existing_by_id.values())
        if module_entry.get('providesSlots'):
            existing_slots = {
                (entry.get('slot'), entry.get('entityType'), entry.get('entityId')): entry
                for entry in guided.get('slotBindings', [])
                if isinstance(entry, dict)
            }
            for provision in module_entry.get('providesSlots', []):
                key = (provision.get('slot'), provision.get('entityType'), provision.get('entityId'))
                existing_slots[key] = {
                    'slot': provision.get('slot'),
                    'entityType': provision.get('entityType'),
                    'entityId': provision.get('entityId'),
                    'providerModuleId': module_id,
                }
            guided['slotBindings'] = list(existing_slots.values())
    return guided


def test_guided_runtime_settings_export_prompt_assignment_ids_are_backend_safe() -> None:
    manifest = get_artifact('graph', 'jdr_solo_session_starter')
    assert manifest is not None
    artifact = manifest['artifact']
    guided_runtime = _build_guided_runtime_settings(artifact['runtimeSettings'])

    assignment_ids = [entry['id'] for entry in guided_runtime['promptStripAssignments']]
    assert assignment_ids, 'guided runtime settings should produce prompt assignments'
    assert all(':' not in entry_id for entry_id in assignment_ids)
    assert all(PROMPT_ASSIGNMENT_ID_RE.fullmatch(entry_id) for entry_id in assignment_ids)

    payload = GraphPayload(
        graph_id='v95_jdr_guided_export',
        ui_context={
            'tab_id': 'starter_tab',
            'artifact_type': 'graph',
            'execution_profile': 'langgraph_async',
            'project_mode': 'langgraph',
            'runtime_settings': guided_runtime,
        },
        nodes=[_node_payload(node) for node in artifact['nodes']],
        edges=artifact['edges'],
        tools=artifact['tools'],
        is_async=artifact.get('isAsync', True),
    )

    exported_runtime = payload.ui_context.runtime_settings.model_dump() if payload.ui_context.runtime_settings else {}
    assert exported_runtime['loadedModuleIds'] == [
        'module_jdr_world_occult_city',
        'module_jdr_rules_dice_forward',
        'module_jdr_persona_gm_fair_guide',
        'module_jdr_tone_grim_consequences',
        'module_jdr_party_roadside_cast',
        'module_jdr_utility_structured_referee',
    ]
    assert [entry['id'] for entry in exported_runtime['promptStripAssignments']] == assignment_ids


def test_v95_frontend_surfaces_expose_guided_tabletop_flow_theme_and_prompt_rebinding() -> None:
    app_text = APP.read_text(encoding='utf-8')
    settings_text = SETTINGS.read_text(encoding='utf-8')
    types_text = TYPES.read_text(encoding='utf-8')
    preferences_text = PREFERENCES.read_text(encoding='utf-8')
    store_text = WORKSPACE_STORE.read_text(encoding='utf-8')
    library_text = ARTIFACT_LIBRARY.read_text(encoding='utf-8')
    state_panel_text = STATE_PANEL.read_text(encoding='utf-8')
    dialog_text = TABLETOP_DIALOG.read_text(encoding='utf-8')
    helper_text = TABLETOP_HELPER.read_text(encoding='utf-8')
    theme_text = THEME.read_text(encoding='utf-8')
    workspace_text = WORKSPACE_HELPERS.read_text(encoding='utf-8')

    assert 'Build guided session' in app_text
    assert 'Open tabletop starter' in app_text
    assert "openBuiltinStarter('jdr_solo_session_starter', { preset: 'tabletop_demo' })" in app_text
    assert 'openGuidedTabletopStarter' in app_text
    assert "'tabletop_demo'" in types_text
    assert "case 'tabletop_demo':" in preferences_text
    assert 'Tabletop Demo' in settings_text
    assert 'remapPromptAssignmentsToTabId' in store_text
    assert 'promptStripAssignments: remapPromptAssignmentsToTabId' in store_text
    assert '.filter((e: Edge) => apiNodeIds.has(String(e.source)) && apiNodeIds.has(String(e.target)))' in store_text
    assert 'Guided setup' in library_text
    assert 'openStarterArtifactRef' in state_panel_text
    assert 'Guided session setup' in dialog_text
    assert 'Runtime setup comes later' in dialog_text
    assert 'Create session' in dialog_text
    assert 'buildGuidedTabletopStarter' in helper_text
    assert 'stripRuntimeProviderConfig(clonedNodes)' in helper_text
    assert 'isTabletopRuntimeConfigNeeded' in helper_text
    assert 'module_jdr_utility_structured_referee' in helper_text
    assert 'getTabletopVisualProfile' in theme_text
    assert 'Runtime setup needed' in app_text
    assert "code: 'missing_provider_config'" in store_text
    assert 'function sanitizePromptAssignmentIdentifier' in workspace_text
    assert 'function buildPromptAssignmentTargetIdPart' in workspace_text
    assert 'sanitizePromptStripAssignments(assignments.map((assignment)' in workspace_text

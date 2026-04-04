from __future__ import annotations

import io
import json
import re
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Iterable

from core.schemas import (
    GraphPayload,
    ModuleLibraryEntry,
    PromptStripAssignment,
    PromptStripDefinition,
    RuntimeSettings,
    SubagentGroup,
)


EXPORT_SCHEMA_VERSION = 'obsidian_gm_v1'


def _slug(value: str, fallback: str = 'note') -> str:
    cleaned = re.sub(r"[^A-Za-z0-9 _-]+", "", str(value or "")).strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned[:96] or fallback


def _filename(value: str, fallback: str = 'note') -> str:
    return _slug(value, fallback).replace('/', ' ').replace('\\', ' ').strip() or fallback


def _pretty_label(value: str) -> str:
    raw = str(value or '').replace('_', ' ').replace('-', ' ').strip()
    if not raw:
        return ''
    return raw.title() if raw.lower() == raw else raw


def _runtime_context_map(runtime_settings: RuntimeSettings | None) -> dict[str, str]:
    if not runtime_settings:
        return {}
    return {str(item['key']): str(item['value']) for item in runtime_settings.runtimeContext}


def _module_index(runtime_settings: RuntimeSettings | None) -> dict[str, ModuleLibraryEntry]:
    if not runtime_settings:
        return {}
    return {entry.id: entry for entry in runtime_settings.moduleLibrary}


def _loaded_modules(runtime_settings: RuntimeSettings | None) -> list[ModuleLibraryEntry]:
    if not runtime_settings:
        return []
    index = _module_index(runtime_settings)
    ordered: list[ModuleLibraryEntry] = []
    seen: set[str] = set()
    for module_id in runtime_settings.loadedModuleIds:
        if module_id in index and module_id not in seen:
            ordered.append(index[module_id])
            seen.add(module_id)
    return ordered


def _category_folder(category: str) -> str:
    return {
        'world': 'Worlds',
        'rules': 'Rules',
        'persona': 'Personas',
        'party': 'Party',
        'utility': 'Utilities',
        'mixed': 'Modules',
    }.get(category, 'Modules')


def _target_label(assignment: PromptStripAssignment) -> str:
    target = assignment.target
    if target.kind == 'graph':
        return 'Graph'
    if target.kind == 'node':
        return f"Node `{target.nodeId}`"
    return f"Subagent `{target.groupName} / {target.agentName}`"


def _yaml_scalar(value: object) -> str:
    return str(value).replace('"', "'")


def _format_frontmatter(fields: dict[str, object]) -> str:
    lines = ['---']
    for key, value in fields.items():
        if value is None:
            continue
        if isinstance(value, list):
            lines.append(f'{key}:')
            for item in value:
                lines.append(f'  - "{_yaml_scalar(item)}"')
        else:
            lines.append(f'{key}: "{_yaml_scalar(value)}"')
    lines.append('---')
    return '\n'.join(lines)


def _collect_prompt_strip_index(
    runtime_settings: RuntimeSettings | None,
    loaded_modules: Iterable[ModuleLibraryEntry],
) -> dict[str, PromptStripDefinition]:
    index: dict[str, PromptStripDefinition] = {}
    if runtime_settings:
        for strip in runtime_settings.promptStripLibrary:
            index[strip.id] = strip
    for module in loaded_modules:
        for strip in module.promptStrips:
            index[strip.id] = strip
    return index


def _collect_groups(runtime_settings: RuntimeSettings | None, loaded_modules: list[ModuleLibraryEntry]) -> dict[str, SubagentGroup]:
    groups: dict[str, SubagentGroup] = {}
    for module in loaded_modules:
        for group in module.subagentGroups:
            groups.setdefault(group.name, group)
    if runtime_settings:
        for group in runtime_settings.subagentLibrary:
            groups.setdefault(group.name, group)
    return groups


def _tool_params(tool: Any) -> dict[str, Any]:
    params = getattr(tool, 'params', None)
    if params is None:
        return {}
    if hasattr(params, 'model_dump'):
        return params.model_dump(mode='json', exclude_none=True)
    if isinstance(params, dict):
        return dict(params)
    return {}


def _note_stub(path: str) -> str:
    return path[:-3] if path.endswith('.md') else path


def _scene_title(scene_id: str) -> str:
    return _pretty_label(scene_id or 'Current Scene')


def _location_title(location_id: str) -> str:
    return _pretty_label(location_id or 'Current Location')


def _scene_detail_filename(scene_id: str) -> str:
    title = _scene_title(scene_id)
    return f'{_filename(scene_id or title)} - {_filename(title)}.md'


def _location_detail_filename(location_id: str) -> str:
    title = _location_title(location_id)
    return f'{_filename(location_id or title)} - {_filename(title)}.md'


def _encounter_title(scene_id: str) -> str:
    return f'{_scene_title(scene_id)} Encounter'


def _encounter_detail_filename(scene_id: str) -> str:
    title = _encounter_title(scene_id)
    return f'{_filename(scene_id or title)} - {_filename(title)}.md'


def _current_timestamp() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _slot_bound_entity_id(runtime_settings: RuntimeSettings | None, slot: str, entity_type: str | None = None) -> str | None:
    if not runtime_settings:
        return None
    for binding in list(getattr(runtime_settings, 'slotBindings', []) or []):
        if binding.slot != slot:
            continue
        if entity_type and binding.entityType != entity_type:
            continue
        return binding.entityId
    return None


def _pick_runtime_seed(runtime_settings: RuntimeSettings | None, attr: str, *, preferred_id: str | None = None) -> Any | None:
    if not runtime_settings:
        return None
    seeds = list(getattr(runtime_settings, attr, []) or [])
    if not seeds:
        return None
    if preferred_id:
        for seed in seeds:
            if getattr(seed, 'id', None) == preferred_id:
                return seed
    for status in ('active', 'seeded'):
        for seed in seeds:
            if getattr(seed, 'status', None) == status:
                return seed
    return seeds[0]


def _pick_scene_seed_model(runtime_settings: RuntimeSettings | None) -> Any | None:
    context = _runtime_context_map(runtime_settings)
    preferred_id = _slot_bound_entity_id(runtime_settings, 'opening_scene', 'scene') or context.get('current_scene')
    return _pick_runtime_seed(runtime_settings, 'sceneSeeds', preferred_id=preferred_id)


def _pick_location_seed_model(runtime_settings: RuntimeSettings | None, scene_seed: Any | None = None) -> Any | None:
    context = _runtime_context_map(runtime_settings)
    preferred_id = (
        _slot_bound_entity_id(runtime_settings, 'default_location', 'location')
        or getattr(scene_seed, 'locationId', None)
        or context.get('opening_location')
    )
    return _pick_runtime_seed(runtime_settings, 'locationSeeds', preferred_id=preferred_id)


def _pick_encounter_seed_model(runtime_settings: RuntimeSettings | None, scene_seed: Any | None = None) -> Any | None:
    context = _runtime_context_map(runtime_settings)
    preferred_id = _slot_bound_entity_id(runtime_settings, 'starter_encounter', 'encounter')
    if not preferred_id and scene_seed is not None:
        encounter_ids = list(getattr(scene_seed, 'encounterIds', []) or [])
        preferred_id = encounter_ids[0] if encounter_ids else None
    preferred_id = preferred_id or context.get('current_scene')
    return _pick_runtime_seed(runtime_settings, 'encounterSeeds', preferred_id=preferred_id)


def _derive_session_seed(
    payload: GraphPayload,
    runtime_settings: RuntimeSettings | None,
    loaded_modules: list[ModuleLibraryEntry],
    exported_at: str,
) -> dict[str, Any]:
    context = _runtime_context_map(runtime_settings)
    scene_seed = _pick_scene_seed_model(runtime_settings)
    location_seed = _pick_location_seed_model(runtime_settings, scene_seed)
    return {
        'title': context.get('session_title') or getattr(scene_seed, 'title', None) or _scene_title(context.get('current_scene', 'current_session')),
        'note_type': 'session',
        'vault_role': 'gm',
        'gm_only': 'true',
        'source_graph_id': payload.graph_id,
        'source_entity_id': 'session:current',
        'session_id': 'session_current',
        'session_kind': context.get('session_kind', ''),
        'setting_id': context.get('setting_id', ''),
        'rules_mode': context.get('rules_mode', ''),
        'tone_mode': context.get('tone_mode', ''),
        'current_scene_id': getattr(scene_seed, 'id', None) or context.get('current_scene', ''),
        'opening_location_id': getattr(location_seed, 'id', None) or context.get('opening_location', ''),
        'rules_helper': context.get('rules_helper', ''),
        'status': context.get('session_status', 'active'),
        'loaded_modules': [module.id for module in loaded_modules],
        'langsuite_export_version': EXPORT_SCHEMA_VERSION,
        'langsuite_exported_at': exported_at,
        'tags': ['session', 'gm', 'active'],
    }


def _derive_scene_seed(
    payload: GraphPayload,
    runtime_settings: RuntimeSettings | None,
    exported_at: str,
) -> dict[str, Any]:
    context = _runtime_context_map(runtime_settings)
    scene_seed = _pick_scene_seed_model(runtime_settings)
    if scene_seed is None:
        scene_id = context.get('current_scene', 'current_scene')
        location_id = context.get('opening_location', '')
        return {
            'title': _scene_title(scene_id),
            'note_type': 'scene',
            'vault_role': 'gm',
            'gm_only': 'true',
            'source_graph_id': payload.graph_id,
            'source_entity_id': f'scene:{scene_id}',
            'scene_id': scene_id,
            'session_id': 'session_current',
            'location_id': location_id,
            'status': context.get('scene_status', 'active'),
            'setting_id': context.get('setting_id', ''),
            'rules_mode': context.get('rules_mode', ''),
            'tone_mode': context.get('tone_mode', ''),
            'objective': context.get('objective', ''),
            'situation': context.get('situation', ''),
            'encounter_ids': [f'encounter:{scene_id}'],
            'cast_groups': sorted({str(_tool_params(tool).get('target_group') or '').strip() for tool in payload.tools if tool.type == 'sub_agent_tool' and str(_tool_params(tool).get('target_group') or '').strip()}),
            'langsuite_export_version': EXPORT_SCHEMA_VERSION,
            'langsuite_exported_at': exported_at,
            'tags': ['scene', context.get('scene_status', 'active')],
        }
    location_seed = _pick_location_seed_model(runtime_settings, scene_seed)
    return {
        'title': getattr(scene_seed, 'title', None) or _scene_title(scene_seed.id),
        'note_type': 'scene',
        'vault_role': 'gm',
        'gm_only': 'true',
        'source_graph_id': payload.graph_id,
        'source_entity_id': f'scene:{scene_seed.id}',
        'scene_id': scene_seed.id,
        'session_id': 'session_current',
        'location_id': getattr(scene_seed, 'locationId', None) or (getattr(location_seed, 'id', None) if location_seed else '') or context.get('opening_location', ''),
        'status': getattr(scene_seed, 'status', None) or context.get('scene_status', 'active'),
        'setting_id': context.get('setting_id', ''),
        'rules_mode': context.get('rules_mode', ''),
        'tone_mode': context.get('tone_mode', ''),
        'objective': getattr(scene_seed, 'objective', None) or context.get('objective', ''),
        'situation': getattr(scene_seed, 'situation', None) or context.get('situation', ''),
        'encounter_ids': [f'encounter:{item}' for item in list(getattr(scene_seed, 'encounterIds', []) or [])] or [f'encounter:{scene_seed.id}'],
        'cast_groups': list(getattr(scene_seed, 'castGroupNames', []) or []),
        'langsuite_export_version': EXPORT_SCHEMA_VERSION,
        'langsuite_exported_at': exported_at,
        'tags': list(dict.fromkeys(['scene', getattr(scene_seed, 'status', None) or context.get('scene_status', 'active'), *list(getattr(scene_seed, 'tags', []) or [])])),
    }


def _derive_location_seed(
    payload: GraphPayload,
    runtime_settings: RuntimeSettings | None,
    exported_at: str,
) -> dict[str, Any]:
    context = _runtime_context_map(runtime_settings)
    scene_seed = _pick_scene_seed_model(runtime_settings)
    location_seed = _pick_location_seed_model(runtime_settings, scene_seed)
    if location_seed is None:
        location_id = context.get('opening_location', 'current_location')
        scene_id = context.get('current_scene', '')
        return {
            'title': _location_title(location_id),
            'note_type': 'location',
            'vault_role': 'gm',
            'gm_only': 'true',
            'source_graph_id': payload.graph_id,
            'source_entity_id': f'location:{location_id}',
            'location_id': location_id,
            'session_id': 'session_current',
            'scene_ids': [scene_id] if scene_id else [],
            'status': 'active',
            'setting_id': context.get('setting_id', ''),
            'langsuite_export_version': EXPORT_SCHEMA_VERSION,
            'langsuite_exported_at': exported_at,
            'tags': ['location', 'active'],
        }
    scene_ids = list(getattr(location_seed, 'sceneIds', []) or [])
    if scene_seed is not None and scene_seed.id not in scene_ids:
        scene_ids.append(scene_seed.id)
    return {
        'title': getattr(location_seed, 'title', None) or _location_title(location_seed.id),
        'note_type': 'location',
        'vault_role': 'gm',
        'gm_only': 'true',
        'source_graph_id': payload.graph_id,
        'source_entity_id': f'location:{location_seed.id}',
        'location_id': location_seed.id,
        'session_id': 'session_current',
        'scene_ids': scene_ids,
        'status': getattr(location_seed, 'status', None) or 'active',
        'setting_id': context.get('setting_id', ''),
        'summary': getattr(location_seed, 'summary', None) or '',
        'region': getattr(location_seed, 'region', None) or '',
        'langsuite_export_version': EXPORT_SCHEMA_VERSION,
        'langsuite_exported_at': exported_at,
        'tags': list(dict.fromkeys(['location', getattr(location_seed, 'status', None) or 'active', *list(getattr(location_seed, 'tags', []) or [])])),
    }


def _derive_encounter_seed(
    payload: GraphPayload,
    runtime_settings: RuntimeSettings | None,
    groups: dict[str, SubagentGroup],
    exported_at: str,
) -> dict[str, Any]:
    context = _runtime_context_map(runtime_settings)
    scene_seed = _pick_scene_seed_model(runtime_settings)
    location_seed = _pick_location_seed_model(runtime_settings, scene_seed)
    encounter_seed = _pick_encounter_seed_model(runtime_settings, scene_seed)
    participant_names: list[str] = []
    group_names: set[str] = set()
    linked_tools: list[str] = []
    for tool in payload.tools:
        params = _tool_params(tool)
        if tool.type == 'sub_agent_tool':
            linked_tools.append(tool.id)
            group_name = str(params.get('target_group') or '').strip()
            agent_name = str(params.get('target_agent') or '').strip()
            if group_name:
                group_names.add(group_name)
            if agent_name:
                participant_names.append(agent_name)
        elif tool.type in {'rpg_dice_roller', 'tool_llm_worker'}:
            linked_tools.append(tool.id)
    if encounter_seed is None:
        scene_id = getattr(scene_seed, 'id', None) or context.get('current_scene', 'current_scene')
        location_id = getattr(location_seed, 'id', None) or context.get('opening_location', '')
        if not participant_names:
            for group_name in sorted(group_names):
                group = groups.get(group_name)
                if not group:
                    continue
                participant_names.extend(agent.name for agent in group.agents)
        pressure_vectors = [
            context.get('pressure_vector_1', 'Hospitality vs suspicion'),
            context.get('pressure_vector_2', 'Rumors vs withheld information'),
            context.get('pressure_vector_3', 'Safety vs local control'),
        ]
        return {
            'title': _encounter_title(scene_id),
            'note_type': 'encounter',
            'vault_role': 'gm',
            'gm_only': 'true',
            'source_graph_id': payload.graph_id,
            'source_entity_id': f'encounter:{scene_id}',
            'encounter_id': scene_id,
            'session_id': 'session_current',
            'scene_id': scene_id,
            'location_id': location_id,
            'encounter_kind': context.get('encounter_kind', 'social_pressure'),
            'status': context.get('encounter_status', 'seeded'),
            'pressure': context.get('encounter_pressure', 'medium'),
            'participants': participant_names,
            'cast_groups': sorted(group_names),
            'linked_tools': linked_tools,
            'pressure_vectors': pressure_vectors,
            'objective': context.get('objective', ''),
            'situation': context.get('situation', ''),
            'langsuite_export_version': EXPORT_SCHEMA_VERSION,
            'langsuite_exported_at': exported_at,
            'tags': ['encounter', 'gm', context.get('encounter_status', 'seeded')],
        }
    participant_names = [ref.agentName for ref in list(getattr(encounter_seed, 'participantRefs', []) or []) if getattr(ref, 'agentName', None)] or participant_names
    group_names = set(ref.groupName for ref in list(getattr(encounter_seed, 'participantRefs', []) or []) if getattr(ref, 'groupName', None)) or group_names
    if not participant_names:
        for group_name in sorted(group_names):
            group = groups.get(group_name)
            if not group:
                continue
            participant_names.extend(agent.name for agent in group.agents)
    linked_tools = list(getattr(encounter_seed, 'suggestedToolIds', []) or []) or linked_tools
    pressure_vectors = [
        context.get('pressure_vector_1', 'Hospitality vs suspicion'),
        context.get('pressure_vector_2', 'Rumors vs withheld information'),
        context.get('pressure_vector_3', 'Safety vs local control'),
    ]
    return {
        'title': getattr(encounter_seed, 'title', None) or _encounter_title(encounter_seed.id),
        'note_type': 'encounter',
        'vault_role': 'gm',
        'gm_only': 'true',
        'source_graph_id': payload.graph_id,
        'source_entity_id': f'encounter:{encounter_seed.id}',
        'encounter_id': encounter_seed.id,
        'session_id': 'session_current',
        'scene_id': getattr(encounter_seed, 'sceneId', None) or (getattr(scene_seed, 'id', None) if scene_seed else '') or context.get('current_scene', ''),
        'location_id': getattr(encounter_seed, 'locationId', None) or (getattr(location_seed, 'id', None) if location_seed else '') or context.get('opening_location', ''),
        'encounter_kind': getattr(encounter_seed, 'kind', None) or context.get('encounter_kind', 'social_pressure'),
        'status': getattr(encounter_seed, 'status', None) or context.get('encounter_status', 'seeded'),
        'pressure': getattr(encounter_seed, 'pressure', None) or context.get('encounter_pressure', 'medium'),
        'participants': participant_names,
        'cast_groups': sorted(group_names),
        'linked_tools': linked_tools,
        'pressure_vectors': pressure_vectors,
        'objective': getattr(scene_seed, 'objective', None) if scene_seed else context.get('objective', ''),
        'situation': getattr(scene_seed, 'situation', None) if scene_seed else context.get('situation', ''),
        'stakes': getattr(encounter_seed, 'stakes', None) or '',
        'success_at_cost': getattr(encounter_seed, 'successAtCost', None) or '',
        'fallout_on_fail': getattr(encounter_seed, 'falloutOnFail', None) or '',
        'langsuite_export_version': EXPORT_SCHEMA_VERSION,
        'langsuite_exported_at': exported_at,
        'tags': list(dict.fromkeys(['encounter', 'gm', getattr(encounter_seed, 'status', None) or context.get('encounter_status', 'seeded'), *list(getattr(encounter_seed, 'tags', []) or [])])),
    }


def _render_module_note(module: ModuleLibraryEntry) -> str:
    frontmatter = _format_frontmatter({
        'title': module.name,
        'note_type': 'module',
        'module_id': module.id,
        'category': module.category,
        'lineage': module.lineage,
        'branch_targets': module.branchTargets,
        'theme_hints': module.themeHints,
        'recommended_profile': module.recommendedProfile or '',
        'tags': ['module', module.category],
    })
    lines = [frontmatter, '', f'# {module.name}', '']
    if module.description:
        lines.extend([module.description, ''])
    lines.extend([
        '## Role in the session',
        f'- Category: `{module.category}`',
        f'- Lineage: `{module.lineage}`',
        f'- Branch targets: {", ".join(module.branchTargets) if module.branchTargets else "none"}',
        f'- Theme hints: {", ".join(module.themeHints) if module.themeHints else "none"}',
        '',
    ])
    if module.runtimeContext:
        lines.append('## Runtime context seeded by this module')
        for entry in module.runtimeContext:
            lines.append(f"- `{entry['key']}` = {entry['value']}")
        lines.append('')
    if module.promptStrips:
        lines.append('## Prompt strips bundled here')
        for strip in module.promptStrips:
            lines.append(f'- [[Prompts/{_filename(strip.name)}]]')
        lines.append('')
    if module.subagentGroups:
        lines.append('## Subagent groups')
        for group in module.subagentGroups:
            lines.append(f'- [[Cast/{_filename(_pretty_label(group.name))}/Index|{_pretty_label(group.name)}]]')
        lines.append('')
    if module.starterArtifacts:
        lines.append('## Starter references')
        for ref in module.starterArtifacts:
            label = ref.label or ref.artifactId
            description = f" — {ref.description}" if ref.description else ''
            lines.append(f'- `{ref.artifactKind}:{ref.artifactId}` · {label}{description}')
        lines.append('')
    if module.compatibilityNotes:
        lines.extend(['## Compatibility notes', module.compatibilityNotes, ''])
    return '\n'.join(lines).strip() + '\n'


def _render_strip_note(strip: PromptStripDefinition, assignments: list[PromptStripAssignment]) -> str:
    frontmatter = _format_frontmatter({
        'title': strip.name,
        'note_type': 'prompt',
        'strip_id': strip.id,
        'tags': list(dict.fromkeys(['prompt', *strip.tags])),
        'origin': strip.origin,
    })
    lines = [frontmatter, '', f'# {strip.name}', '']
    if strip.description:
        lines.extend([strip.description, ''])
    if assignments:
        lines.append('## Applied to')
        for assignment in assignments:
            lines.append(f'- {_target_label(assignment)} · merge `{assignment.mergeMode}` · order `{assignment.order}`')
        lines.append('')
    if strip.variables:
        lines.append('## Variables')
        for variable in strip.variables:
            default = f" (default: {variable.defaultValue})" if variable.defaultValue else ''
            lines.append(f'- `{variable.name}` · {"required" if variable.required else "optional"}{default}')
        lines.append('')
    lines.extend(['## Body', '```text', strip.body, '```', ''])
    return '\n'.join(lines).strip() + '\n'


def _render_group_index(group: SubagentGroup) -> str:
    display_name = _pretty_label(group.name)
    frontmatter = _format_frontmatter({
        'title': display_name,
        'note_type': 'cast_group',
        'group_name': group.name,
        'tags': ['cast', 'group'],
    })
    lines = [frontmatter, '', f'# {display_name}', '', '## Agents']
    for agent in group.agents:
        lines.append(f'- [[Cast/{_filename(_pretty_label(group.name))}/{_filename(_pretty_label(agent.name))}]]')
    lines.append('')
    return '\n'.join(lines)


def _render_agent_note(payload: GraphPayload, runtime_settings: RuntimeSettings | None, group_name: str, agent: dict[str, Any], exported_at: str) -> str:
    context = _runtime_context_map(runtime_settings)
    display_name = _pretty_label(agent['name'])
    location_id = context.get('opening_location', '')
    scene_id = context.get('current_scene', '')
    frontmatter = _format_frontmatter({
        'title': display_name,
        'note_type': 'npc',
        'vault_role': 'gm',
        'gm_only': 'true',
        'source_graph_id': payload.graph_id,
        'source_entity_id': f"npc:{group_name}:{agent['name']}",
        'npc_id': agent['name'],
        'group_name': group_name,
        'session_id': 'session_current',
        'scene_ids': [scene_id] if scene_id else [],
        'location_id': location_id,
        'status': 'present',
        'langsuite_export_version': EXPORT_SCHEMA_VERSION,
        'langsuite_exported_at': exported_at,
        'tags': ['npc', 'cast'],
    })
    lines = [frontmatter, '', f"# {display_name}", '']
    if agent.get('description'):
        lines.extend([agent['description'], ''])
    if scene_id:
        lines.extend([
            '## Active frame',
            f'- Current scene: [[Scenes/{_note_stub(_scene_detail_filename(scene_id))}|{_scene_title(scene_id)}]]',
            f'- Current location: [[Locations/{_note_stub(_location_detail_filename(location_id))}|{_location_title(location_id)}]]' if location_id else '- Current location: unresolved',
            '',
        ])
    lines.extend(['## System prompt', '```text', agent.get('systemPrompt', ''), '```', ''])
    tools = agent.get('tools') or []
    if tools:
        lines.append('## Tools')
        for tool in tools:
            lines.append(f'- `{tool}`')
        lines.append('')
    lines.extend(['## GM notes', '- Leverage:', '- Reveal threshold:', '- What this NPC wants right now:', ''])
    return '\n'.join(lines).strip() + '\n'


def _render_runtime_note(payload: GraphPayload, runtime_settings: RuntimeSettings | None) -> str:
    context = _runtime_context_map(runtime_settings)
    node_lines = [f"- `{node.id}` · `{node.type}`" for node in payload.nodes]
    tool_lines = [f"- `{tool.id}` · `{tool.type}`" for tool in payload.tools]
    frontmatter = _format_frontmatter({
        'title': 'Graph Runtime',
        'note_type': 'runtime',
        'graph_id': payload.graph_id,
        'project_mode': payload.ui_context.project_mode if payload.ui_context else '',
        'execution_profile': payload.ui_context.execution_profile if payload.ui_context else '',
    })
    lines = [
        frontmatter,
        '',
        '# Graph Runtime',
        '',
        'This tabletop experience is powered by the LangSuite graph. Obsidian is a companion vault for worldbuilding, scene prep, and play notes.',
        '',
        '## Runtime truth',
        f'- Graph id: `{payload.graph_id}`',
        f'- Project mode: `{payload.ui_context.project_mode if payload.ui_context else "langgraph"}`',
        f'- Execution profile: `{payload.ui_context.execution_profile if payload.ui_context else ("langgraph_async" if payload.is_async else "langgraph_sync")}`',
        f'- Checkpoint enabled: `{payload.use_checkpoint}`',
        '',
    ]
    if context:
        lines.append('## Runtime context')
        for key, value in context.items():
            lines.append(f'- `{key}` = {value}')
        lines.append('')
    lines.extend(['## Nodes', *node_lines, '', '## Tools', *tool_lines, ''])
    return '\n'.join(lines).strip() + '\n'


def _render_scene_note(runtime_settings: RuntimeSettings | None) -> str:
    context = _runtime_context_map(runtime_settings)
    scene_id = context.get('current_scene', '')
    location_id = context.get('opening_location', '')
    frontmatter = _format_frontmatter({
        'title': context.get('current_scene', 'Current Scene').replace('_', ' ').title(),
        'note_type': 'scene_pointer',
        'scene_id': scene_id,
        'location': location_id,
    })
    lines = [frontmatter, '', '# Current Scene', '']
    if scene_id:
        lines.append(f'- Detailed note: [[Scenes/{_note_stub(_scene_detail_filename(scene_id))}|{_scene_title(scene_id)}]]')
    if location_id:
        lines.append(f'- Primary location: [[Locations/{_note_stub(_location_detail_filename(location_id))}|{_location_title(location_id)}]]')
    if scene_id:
        lines.append(f'- Encounter seed: [[Encounters/{_note_stub(_encounter_detail_filename(scene_id))}|{_encounter_title(scene_id)}]]')
    lines.append('')
    if context:
        for key in ['setting_id', 'rules_mode', 'tone_mode', 'opening_location', 'current_scene', 'objective', 'situation']:
            if context.get(key):
                lines.append(f'- `{key}`: {context[key]}')
        lines.append('')
    lines.extend([
        '## Session use',
        '- Add live notes, clues, NPC reactions, and consequences here during play.',
        '- Keep the graph as the execution source of truth; use this note for human-facing continuity.',
        '',
    ])
    return '\n'.join(lines)


def _render_home_note(
    payload: GraphPayload,
    runtime_settings: RuntimeSettings | None,
    loaded_modules: list[ModuleLibraryEntry],
) -> str:
    context = _runtime_context_map(runtime_settings)
    setting = _pretty_label(context.get('setting_id', 'tabletop session'))
    rules = _pretty_label(context.get('rules_mode', 'runtime rules'))
    tone = _pretty_label(context.get('tone_mode', 'tabletop tone'))
    scene_id = context.get('current_scene', '')
    location_id = context.get('opening_location', '')
    frontmatter = _format_frontmatter({
        'title': 'Session Hub',
        'note_type': 'session_hub',
        'graph_id': payload.graph_id,
        'project_mode': payload.ui_context.project_mode if payload.ui_context else '',
        'execution_profile': payload.ui_context.execution_profile if payload.ui_context else '',
        'tags': ['hub', 'gm'],
    })
    lines = [
        frontmatter,
        '',
        '# Session Hub',
        '',
        'Obsidian companion for a tabletop session powered by LangSuite graphs.',
        '',
        '## Core links',
        '- [[Dashboards/GM Dashboard]]',
        '- [[Dashboards/Session Dashboard]]',
        '- [[Dashboards/Prep Dashboard]]',
        '- [[Graphs/Graph Runtime]]',
        '- [[Sessions/Current Session]]',
        '- [[Sessions/Session Log]]',
        '- [[Scenes/Current Scene]]',
        '- [[Scenes/Scene Index]]',
        '- [[Encounters/Encounter Index]]',
        '- [[Locations/Location Index]]',
        '- [[Cast/NPC Index]]',
        '- [[Modules/Loaded Modules]]',
        '- [[Prompts/Active Prompt Strips]]',
        '',
    ]
    if scene_id or location_id:
        lines.append('## Active frame')
        if scene_id:
            lines.append(f'- Scene: [[Scenes/{_note_stub(_scene_detail_filename(scene_id))}|{_scene_title(scene_id)}]]')
            lines.append(f'- Encounter: [[Encounters/{_note_stub(_encounter_detail_filename(scene_id))}|{_encounter_title(scene_id)}]]')
        if location_id:
            lines.append(f'- Location: [[Locations/{_note_stub(_location_detail_filename(location_id))}|{_location_title(location_id)}]]')
        lines.append('')
    if loaded_modules:
        lines.append('## Loaded packs')
        for module in loaded_modules:
            folder = _category_folder(module.category)
            lines.append(f'- [[{folder}/{_filename(module.name)}]]')
        lines.append('')
    lines.extend([
        '## Current session frame',
        f'- Setting: `{setting}`',
        f'- Rules: `{rules}`',
        f'- Tone: `{tone}`',
    ])
    if context.get('opening_location'):
        lines.append(f"- Opening location: `{context['opening_location']}`")
    if context.get('current_scene'):
        lines.append(f"- Current scene: `{context['current_scene']}`")
    lines.append('')
    lines.extend([
        '## Truth boundary',
        '- The graph remains the runtime source of truth.',
        '- These notes are for prep, recap, scene tracking, and campaign continuity inside Obsidian.',
        '',
    ])
    return '\n'.join(lines)


def _render_loaded_modules_index(loaded_modules: list[ModuleLibraryEntry]) -> str:
    frontmatter = _format_frontmatter({'title': 'Loaded Modules', 'note_type': 'module_index'})
    lines = [frontmatter, '', '# Loaded Modules', '']
    grouped: dict[str, list[ModuleLibraryEntry]] = defaultdict(list)
    for module in loaded_modules:
        grouped[module.category].append(module)
    for category in ['world', 'rules', 'persona', 'party', 'utility', 'mixed']:
        if not grouped.get(category):
            continue
        lines.append(f'## {category.title()}')
        for module in grouped[category]:
            lines.append(f'- [[{_category_folder(module.category)}/{_filename(module.name)}]]')
        lines.append('')
    return '\n'.join(lines)


def _render_active_prompts_index(runtime_settings: RuntimeSettings | None, loaded_modules: list[ModuleLibraryEntry]) -> tuple[str, dict[str, str]]:
    assignments = list((runtime_settings.promptStripAssignments if runtime_settings else []) or [])
    strip_index = _collect_prompt_strip_index(runtime_settings, loaded_modules)
    strip_assignments: dict[str, list[PromptStripAssignment]] = defaultdict(list)
    for assignment in assignments:
        strip_assignments[assignment.stripId].append(assignment)
    frontmatter = _format_frontmatter({'title': 'Active Prompt Strips', 'note_type': 'prompt_index'})
    lines = [frontmatter, '', '# Active Prompt Strips', '']
    prompt_notes: dict[str, str] = {}
    for strip_id, strip in sorted(strip_index.items(), key=lambda item: item[1].name.lower()):
        lines.append(f'- [[Prompts/{_filename(strip.name)}]]')
        prompt_notes[f'Prompts/{_filename(strip.name)}.md'] = _render_strip_note(strip, strip_assignments.get(strip_id, []))
    lines.append('')
    return '\n'.join(lines), prompt_notes


def _render_current_session_note(session_seed: dict[str, Any], scene_seed: dict[str, Any], location_seed: dict[str, Any], loaded_modules: list[ModuleLibraryEntry]) -> str:
    frontmatter = _format_frontmatter(session_seed)
    lines = [frontmatter, '', f"# {session_seed['title']}", '']
    lines.extend([
        '## Active frame',
        f"- Scene: [[Scenes/{_note_stub(_scene_detail_filename(scene_seed['scene_id']))}|{scene_seed['title']}]]",
        f"- Location: [[Locations/{_note_stub(_location_detail_filename(location_seed['location_id']))}|{location_seed['title']}]]",
        f"- Encounter: [[Encounters/{_note_stub(_encounter_detail_filename(scene_seed['scene_id']))}|{_encounter_title(scene_seed['scene_id'])}]]",
        '',
        '## Session profile',
        f"- Session kind: `{session_seed['session_kind']}`",
        f"- Setting: `{session_seed['setting_id']}`",
        f"- Rules mode: `{session_seed['rules_mode']}`",
        f"- Tone mode: `{session_seed['tone_mode']}`",
        f"- Rules helper: `{session_seed['rules_helper']}`" if session_seed.get('rules_helper') else '- Rules helper: unresolved',
        '',
    ])
    if scene_seed.get('objective') or scene_seed.get('situation'):
        lines.append('## Current pressure')
        if scene_seed.get('objective'):
            lines.append(f"- Objective: {scene_seed['objective']}")
        if scene_seed.get('situation'):
            lines.append(f"- Situation: {scene_seed['situation']}")
        lines.append('')
    if loaded_modules:
        lines.append('## Loaded packs')
        for module in loaded_modules:
            lines.append(f"- [[{_category_folder(module.category)}/{_filename(module.name)}|{module.name}]]")
        lines.append('')
    lines.extend([
        '## Use during play',
        '- Treat this note as the session spine for recaps, current pressure, and next hooks.',
        '- Record only human-facing continuity here; keep runtime execution changes in the graph.',
        '',
    ])
    return '\n'.join(lines).strip() + '\n'


def _render_session_log_note(session_seed: dict[str, Any]) -> str:
    frontmatter = _format_frontmatter({
        'title': 'Session Log',
        'note_type': 'session_log',
        'session_id': session_seed['session_id'],
        'vault_role': 'gm',
        'gm_only': 'true',
        'tags': ['session', 'log'],
    })
    lines = [
        frontmatter,
        '',
        '# Session Log',
        '',
        '## Recap',
        '- Opening image:',
        '- Major turn:',
        '- New information:',
        '',
        '## Consequences',
        '- Cost paid:',
        '- New threat:',
        '- New leverage:',
        '',
        '## Next session hooks',
        '- ',
        '',
    ]
    return '\n'.join(lines)


def _render_scene_detail(scene_seed: dict[str, Any], encounter_seed: dict[str, Any], location_seed: dict[str, Any]) -> str:
    frontmatter = _format_frontmatter(scene_seed)
    lines = [frontmatter, '', f"# {scene_seed['title']}", '']
    lines.extend([
        '## Frame',
        f"- Session: [[Sessions/Current Session|{scene_seed['session_id']}]]",
        f"- Location: [[Locations/{_note_stub(_location_detail_filename(location_seed['location_id']))}|{location_seed['title']}]]",
        f"- Encounter seed: [[Encounters/{_note_stub(_encounter_detail_filename(scene_seed['scene_id']))}|{encounter_seed['title']}]]",
        f"- Status: `{scene_seed['status']}`",
        '',
    ])
    if scene_seed.get('objective') or scene_seed.get('situation'):
        lines.append('## Framing')
        if scene_seed.get('objective'):
            lines.append(f"- Objective: {scene_seed['objective']}")
        if scene_seed.get('situation'):
            lines.append(f"- Situation: {scene_seed['situation']}")
        lines.append('')
    if scene_seed.get('cast_groups'):
        lines.append('## Cast groups in play')
        for group_name in scene_seed['cast_groups']:
            lines.append(f'- [[Cast/{_filename(_pretty_label(group_name))}/Index|{_pretty_label(group_name)}]]')
        lines.append('')
    lines.extend([
        '## Beats',
        '### Beat 1',
        '### Beat 2',
        '### Beat 3',
        '',
        '## Clues and consequences',
        '- Visible clue:',
        '- Hidden clue:',
        '- Consequence on delay:',
        '',
    ])
    return '\n'.join(lines).strip() + '\n'


def _render_scene_index(scene_seed: dict[str, Any]) -> str:
    frontmatter = _format_frontmatter({'title': 'Scene Index', 'note_type': 'scene_index', 'tags': ['scene', 'index']})
    scene_link = f"[[Scenes/{_note_stub(_scene_detail_filename(scene_seed['scene_id']))}|{scene_seed['title']}]]"
    lines = [
        frontmatter,
        '',
        '# Scene Index',
        '',
        f'- {scene_link} · `{scene_seed["status"]}`',
        '',
    ]
    return '\n'.join(lines)


def _render_encounter_note(encounter_seed: dict[str, Any], scene_seed: dict[str, Any], location_seed: dict[str, Any]) -> str:
    frontmatter = _format_frontmatter(encounter_seed)
    lines = [frontmatter, '', f"# {encounter_seed['title']}", '']
    lines.extend([
        '## Frame',
        f"- Scene: [[Scenes/{_note_stub(_scene_detail_filename(scene_seed['scene_id']))}|{scene_seed['title']}]]",
        f"- Location: [[Locations/{_note_stub(_location_detail_filename(location_seed['location_id']))}|{location_seed['title']}]]",
        f"- Kind: `{encounter_seed['encounter_kind']}`",
        f"- Pressure: `{encounter_seed['pressure']}`",
        f"- Status: `{encounter_seed['status']}`",
        '',
        '## Participants',
    ])
    for participant in encounter_seed.get('participants', []):
        lines.append(f'- [[Cast/{_filename(_pretty_label(next(iter(encounter_seed.get("cast_groups", [])), "")))}/{_filename(_pretty_label(participant))}|{_pretty_label(participant)}]]' if encounter_seed.get('cast_groups') else f'- `{participant}`')
    if not encounter_seed.get('participants'):
        lines.append('- No explicit participants were derived from the runtime payload.')
    lines.append('')
    lines.append('## Pressure vectors')
    for vector in encounter_seed.get('pressure_vectors', []):
        lines.append(f'- {vector}')
    lines.append('')
    if encounter_seed.get('objective') or encounter_seed.get('situation') or encounter_seed.get('stakes'):
        lines.append('## Situation brief')
        if encounter_seed.get('objective'):
            lines.append(f"- Objective: {encounter_seed['objective']}")
        if encounter_seed.get('situation'):
            lines.append(f"- Situation: {encounter_seed['situation']}")
        if encounter_seed.get('stakes'):
            lines.append(f"- Stakes: {encounter_seed['stakes']}")
        lines.append('')
    lines.extend([
        '## Adjudication',
        '- Likely check:',
        '- Difficulty:',
        f"- Consequence on failure: {encounter_seed.get('fallout_on_fail', '')}",
        f"- Success at a cost: {encounter_seed.get('success_at_cost', '')}",
        '',
        '## Beats',
        '### Beat 1',
        '### Beat 2',
        '### Beat 3',
        '',
        '## Fallout',
        '- New clues:',
        '- NPC attitude shifts:',
        '- New hooks:',
        '',
    ])
    if encounter_seed.get('linked_tools'):
        lines.append('## Linked tools')
        for tool_id in encounter_seed['linked_tools']:
            lines.append(f'- `{tool_id}`')
        lines.append('')
    return '\n'.join(lines).strip() + '\n'


def _render_encounter_index(encounter_seed: dict[str, Any]) -> str:
    frontmatter = _format_frontmatter({'title': 'Encounter Index', 'note_type': 'encounter_index', 'tags': ['encounter', 'index']})
    encounter_link = f"[[Encounters/{_note_stub(_encounter_detail_filename(encounter_seed['scene_id']))}|{encounter_seed['title']}]]"
    lines = [
        frontmatter,
        '',
        '# Encounter Index',
        '',
        f'- {encounter_link} · `{encounter_seed["status"]}` · pressure `{encounter_seed["pressure"]}`',
        '',
    ]
    return '\n'.join(lines)


def _render_location_note(location_seed: dict[str, Any], scene_seed: dict[str, Any]) -> str:
    frontmatter = _format_frontmatter(location_seed)
    lines = [frontmatter, '', f"# {location_seed['title']}", '']
    lines.extend([
        '## Frame',
        f"- Current scene: [[Scenes/{_note_stub(_scene_detail_filename(scene_seed['scene_id']))}|{scene_seed['title']}]]",
        f"- Setting: `{location_seed['setting_id']}`",
        '',
    ])
    if location_seed.get('summary') or location_seed.get('region'):
        lines.append('## Summary')
        if location_seed.get('summary'):
            lines.append(location_seed['summary'])
        if location_seed.get('region'):
            lines.append(f"- Region: `{location_seed['region']}`")
        lines.append('')
    lines.extend([
        '## Site notes',
        '- First impression:',
        '- Hidden pressure:',
        '- Useful detail:',
        '',
        '## Hooks',
        '- Who controls this place?',
        '- What happened here recently?',
        '- What does the location want from the characters?',
        '',
    ])
    return '\n'.join(lines).strip() + '\n'


def _render_location_index(location_seed: dict[str, Any]) -> str:
    frontmatter = _format_frontmatter({'title': 'Location Index', 'note_type': 'location_index', 'tags': ['location', 'index']})
    lines = [
        frontmatter,
        '',
        '# Location Index',
        '',
        f"- [[Locations/{_note_stub(_location_detail_filename(location_seed['location_id']))}|{location_seed['title']}]]",
        '',
    ]
    return '\n'.join(lines)


def _render_npc_index(groups: dict[str, SubagentGroup]) -> str:
    frontmatter = _format_frontmatter({'title': 'NPC Index', 'note_type': 'npc_index', 'tags': ['npc', 'index']})
    lines = [frontmatter, '', '# NPC Index', '']
    for group_name, group in sorted(groups.items()):
        lines.append(f'## {_pretty_label(group_name)}')
        lines.append(f'- [[Cast/{_filename(_pretty_label(group_name))}/Index|Group hub]]')
        for agent in group.agents:
            lines.append(f'- [[Cast/{_filename(_pretty_label(group_name))}/{_filename(_pretty_label(agent.name))}|{_pretty_label(agent.name)}]]')
        lines.append('')
    return '\n'.join(lines)


def _clock_track(segments: int, progress: int) -> str:
    total = max(1, int(segments or 1))
    done = max(0, min(total, int(progress or 0)))
    return ''.join(['●' if idx < done else '○' for idx in range(total)])


def _render_clock_note(clock: Any, exported_at: str) -> str:
    frontmatter = _format_frontmatter({
        'title': clock.title,
        'note_type': 'clock',
        'source_entity_id': f'clock:{clock.id}',
        'clock_id': clock.id,
        'status': clock.status,
        'segments': clock.segments,
        'progress': clock.progress,
        'scene_id': clock.sceneId,
        'location_id': clock.locationId,
        'langsuite_export_version': EXPORT_SCHEMA_VERSION,
        'langsuite_exported_at': exported_at,
        'tags': ['clock', clock.status],
    })
    lines = [
        frontmatter,
        '',
        f'# {clock.title}',
        '',
        f'- Status: `{clock.status}`',
        f'- Progress: `{clock.progress}/{clock.segments}`',
        f'- Track: `{_clock_track(clock.segments, clock.progress)}`',
        '',
        '## Trigger',
        clock.trigger or '- ',
        '',
        '## Consequence',
        clock.consequence or '- ',
        '',
    ]
    if getattr(clock, 'factionIds', None):
        lines.append('## Linked factions')
        for faction_id in clock.factionIds:
            lines.append(f'- [[Factions/{_filename(faction_id)} - {_filename(_pretty_label(faction_id))}|{_pretty_label(faction_id)}]]')
        lines.append('')
    return '\n'.join(lines).strip() + '\n'


def _render_clock_index(clocks: list[Any]) -> str:
    frontmatter = _format_frontmatter({'title': 'Clock Index', 'note_type': 'clock_index', 'tags': ['clock', 'index']})
    lines = [frontmatter, '', '# Clock Index', '']
    for clock in clocks:
        lines.append(f'- [[Clocks/{_filename(clock.id)} - {_filename(clock.title)}|{clock.title}]] · `{clock.progress}/{clock.segments}` · `{clock.status}`')
    lines.append('')
    return '\n'.join(lines)


def _render_faction_note(faction: Any, exported_at: str) -> str:
    frontmatter = _format_frontmatter({
        'title': faction.title,
        'note_type': 'faction',
        'source_entity_id': f'faction:{faction.id}',
        'faction_id': faction.id,
        'status': 'active',
        'tier': getattr(faction, 'tier', 'local'),
        'faction_type': getattr(faction, 'factionType', 'political'),
        'langsuite_export_version': EXPORT_SCHEMA_VERSION,
        'langsuite_exported_at': exported_at,
        'tags': ['faction', getattr(faction, 'tier', 'local')],
    })
    lines = [frontmatter, '', f'# {faction.title}', '']
    if getattr(faction, 'agenda', ''):
        lines.extend(['## Agenda', faction.agenda, ''])
    if getattr(faction, 'leaderName', None):
        lines.append(f"- Leader: `{faction.leaderName}`")
    if getattr(faction, 'headquartersLocationId', None):
        lines.append(f"- HQ: [[Locations/{_filename(faction.headquartersLocationId)} - {_filename(_pretty_label(faction.headquartersLocationId))}|{_pretty_label(faction.headquartersLocationId)}]]")
    if getattr(faction, 'presence', None):
        lines.extend(['', '## Presence'])
        for presence in faction.presence:
            lines.append(f"- `{presence.locationId}` · `{presence.strength}`" + (f" · {presence.details}" if getattr(presence, 'details', '') else ''))
    if getattr(faction, 'resources', None):
        lines.extend(['', '## Resources'])
        for resource in faction.resources:
            lines.append(f'- {resource}')
    lines.append('')
    return '\n'.join(lines).strip() + '\n'


def _render_faction_index(factions: list[Any]) -> str:
    frontmatter = _format_frontmatter({'title': 'Faction Index', 'note_type': 'faction_index', 'tags': ['faction', 'index']})
    lines = [frontmatter, '', '# Faction Index', '']
    for faction in factions:
        lines.append(f'- [[Factions/{_filename(faction.id)} - {_filename(faction.title)}|{faction.title}]] · `{getattr(faction, "tier", "local")}`')
    lines.append('')
    return '\n'.join(lines)


def _render_hook_note(hook: Any, exported_at: str) -> str:
    frontmatter = _format_frontmatter({
        'title': hook.title,
        'note_type': 'hook',
        'source_entity_id': f'hook:{hook.id}',
        'hook_id': hook.id,
        'hook_kind': getattr(hook, 'hookKind', 'rumor'),
        'status': 'used' if getattr(hook, 'used', False) else 'active',
        'hidden': 'true' if getattr(hook, 'hidden', True) else 'false',
        'langsuite_export_version': EXPORT_SCHEMA_VERSION,
        'langsuite_exported_at': exported_at,
        'tags': ['hook', getattr(hook, 'hookKind', 'rumor')],
    })
    lines = [
        frontmatter,
        '',
        f'# {hook.title}',
        '',
        f"- Kind: `{getattr(hook, 'hookKind', 'rumor')}`",
        f"- Trigger: `{getattr(hook, 'triggerCondition', 'always')}`",
        f"- Status: `{'used' if getattr(hook, 'used', False) else 'active'}`",
        '',
        '## Content',
        getattr(hook, 'content', '') or '- ',
        '',
    ]
    targets = getattr(hook, 'targets', []) or []
    if targets:
        lines.append('## Targets')
        for target in targets:
            lines.append(f"- `{target.targetType}` · `{target.targetId}` · weight `{target.weight}`")
        lines.append('')
    if getattr(hook, 'gmNotes', ''):
        lines.extend(['## GM Notes', hook.gmNotes, ''])
    return '\n'.join(lines).strip() + '\n'


def _render_hook_index(hooks: list[Any]) -> str:
    frontmatter = _format_frontmatter({'title': 'Hook Index', 'note_type': 'hook_index', 'tags': ['hook', 'index']})
    lines = [frontmatter, '', '# Hook Index', '']
    for hook in hooks:
        status = 'used' if getattr(hook, 'used', False) else 'active'
        lines.append(f'- [[Hooks/{_filename(hook.id)} - {_filename(hook.title)}|{hook.title}]] · `{getattr(hook, "hookKind", "rumor")}` · `{status}`')
    lines.append('')
    return '\n'.join(lines)


def _render_pressure_dashboard() -> str:
    frontmatter = _format_frontmatter({'title': 'Pressure Dashboard', 'note_type': 'dashboard', 'tags': ['dashboard', 'pressure']})
    return (
        f"{frontmatter}\n\n"
        '# Pressure Dashboard\n\n'
        '## Active clocks\n'
        '```dataview\n'
        'TABLE progress, segments, status, scene_id, location_id\n'
        'FROM "Clocks"\n'
        'WHERE note_type = "clock" AND status != "resolved"\n'
        'SORT progress DESC\n'
        '```\n\n'
        '## Active hooks\n'
        '```dataview\n'
        'TABLE hook_kind, status, hidden\n'
        'FROM "Hooks"\n'
        'WHERE note_type = "hook"\n'
        'SORT file.name ASC\n'
        '```\n\n'
        '## Factions\n'
        '```dataview\n'
        'TABLE tier, faction_type\n'
        'FROM "Factions"\n'
        'WHERE note_type = "faction"\n'
        'SORT tier ASC, file.name ASC\n'
        '```\n'
    )


def _render_gm_dashboard() -> str:
    frontmatter = _format_frontmatter({'title': 'GM Dashboard', 'note_type': 'dashboard', 'tags': ['dashboard', 'gm']})
    return (
        f"{frontmatter}\n\n"
        '# GM Dashboard\n\n'
        '## Active scene\n'
        '```dataview\n'
        'TABLE scene_id, location_id, status, objective, situation\n'
        'FROM "Scenes"\n'
        'WHERE note_type = "scene" AND status = "active"\n'
        'SORT file.name ASC\n'
        '```\n\n'
        '## Active encounters\n'
        '```dataview\n'
        'TABLE encounter_kind, scene_id, location_id, pressure, status\n'
        'FROM "Encounters"\n'
        'WHERE note_type = "encounter" AND status != "resolved"\n'
        'SORT file.name ASC\n'
        '```\n\n'
        '## Cast\n'
        '```dataview\n'
        'TABLE group_name, location_id, status\n'
        'FROM "Cast"\n'
        'WHERE note_type = "npc"\n'
        'SORT group_name ASC, file.name ASC\n'
        '```\n'
    )


def _render_session_dashboard() -> str:
    frontmatter = _format_frontmatter({'title': 'Session Dashboard', 'note_type': 'dashboard', 'tags': ['dashboard', 'session']})
    return (
        f"{frontmatter}\n\n"
        '# Session Dashboard\n\n'
        '```dataview\n'
        'TABLE session_kind, setting_id, rules_mode, tone_mode, status\n'
        'FROM "Sessions"\n'
        'WHERE note_type = "session"\n'
        'SORT file.name DESC\n'
        '```\n\n'
        '## Scenes\n'
        '```dataview\n'
        'TABLE location_id, status, encounter_ids\n'
        'FROM "Scenes"\n'
        'WHERE note_type = "scene"\n'
        'SORT file.name ASC\n'
        '```\n'
    )


def _render_prep_dashboard() -> str:
    frontmatter = _format_frontmatter({'title': 'Prep Dashboard', 'note_type': 'dashboard', 'tags': ['dashboard', 'prep']})
    return (
        f"{frontmatter}\n\n"
        '# Prep Dashboard\n\n'
        '## Loaded modules\n'
        '```dataview\n'
        'TABLE category, lineage, recommended_profile\n'
        'FROM "Worlds" OR "Rules" OR "Personas" OR "Party" OR "Utilities" OR "Modules"\n'
        'WHERE note_type = "module"\n'
        'SORT category ASC, file.name ASC\n'
        '```\n\n'
        '## Active prompts\n'
        '```dataview\n'
        'TABLE origin, strip_id\n'
        'FROM "Prompts"\n'
        'WHERE note_type = "prompt"\n'
        'SORT file.name ASC\n'
        '```\n'
    )


def _build_export_manifest(payload: GraphPayload, files: dict[str, str], exported_at: str) -> str:
    notes: list[dict[str, str]] = []
    for path, content in sorted(files.items()):
        note_type_match = re.search(r'^note_type: "([^"]+)"$', content, flags=re.MULTILINE)
        source_match = re.search(r'^source_entity_id: "([^"]+)"$', content, flags=re.MULTILINE)
        notes.append({
            'path': path,
            'note_type': note_type_match.group(1) if note_type_match else '',
            'source_entity_id': source_match.group(1) if source_match else '',
        })
    manifest = {
        'schema_version': EXPORT_SCHEMA_VERSION,
        'graph_id': payload.graph_id,
        'generated_at': exported_at,
        'notes': notes,
    }
    return json.dumps(manifest, indent=2, ensure_ascii=False) + '\n'


def build_obsidian_vault(payload: GraphPayload) -> io.BytesIO:
    runtime_settings = payload.ui_context.runtime_settings if payload.ui_context else None
    loaded_modules = _loaded_modules(runtime_settings)
    groups = _collect_groups(runtime_settings, loaded_modules)
    exported_at = _current_timestamp()

    session_seed = _derive_session_seed(payload, runtime_settings, loaded_modules, exported_at)
    scene_seed = _derive_scene_seed(payload, runtime_settings, exported_at)
    location_seed = _derive_location_seed(payload, runtime_settings, exported_at)
    encounter_seed = _derive_encounter_seed(payload, runtime_settings, groups, exported_at)

    files: dict[str, str] = {}
    files['00 Session Hub.md'] = _render_home_note(payload, runtime_settings, loaded_modules)
    files['Graphs/Graph Runtime.md'] = _render_runtime_note(payload, runtime_settings)
    files['Scenes/Current Scene.md'] = _render_scene_note(runtime_settings)
    files['Scenes/Scene Index.md'] = _render_scene_index(scene_seed)
    files[f"Scenes/{_scene_detail_filename(scene_seed['scene_id'])}"] = _render_scene_detail(scene_seed, encounter_seed, location_seed)
    files['Sessions/Current Session.md'] = _render_current_session_note(session_seed, scene_seed, location_seed, loaded_modules)
    files['Sessions/Session Log.md'] = _render_session_log_note(session_seed)
    files['Encounters/Encounter Index.md'] = _render_encounter_index(encounter_seed)
    files[f"Encounters/{_encounter_detail_filename(scene_seed['scene_id'])}"] = _render_encounter_note(encounter_seed, scene_seed, location_seed)
    files['Locations/Location Index.md'] = _render_location_index(location_seed)
    files[f"Locations/{_location_detail_filename(location_seed['location_id'])}"] = _render_location_note(location_seed, scene_seed)
    files['Cast/NPC Index.md'] = _render_npc_index(groups)
    files['Dashboards/GM Dashboard.md'] = _render_gm_dashboard()
    files['Dashboards/Session Dashboard.md'] = _render_session_dashboard()
    files['Dashboards/Prep Dashboard.md'] = _render_prep_dashboard()
    files['Dashboards/Pressure Dashboard.md'] = _render_pressure_dashboard()
    files['Modules/Loaded Modules.md'] = _render_loaded_modules_index(loaded_modules)
    prompts_index, prompt_notes = _render_active_prompts_index(runtime_settings, loaded_modules)
    files['Prompts/Active Prompt Strips.md'] = prompts_index
    files.update(prompt_notes)

    runtime_clock_seeds = list(getattr(runtime_settings, 'clockSeeds', []) or []) if runtime_settings else []
    runtime_faction_seeds = list(getattr(runtime_settings, 'factionSeeds', []) or []) if runtime_settings else []
    runtime_hook_seeds = list(getattr(runtime_settings, 'hookSeeds', []) or []) if runtime_settings else []

    if runtime_clock_seeds:
        files['Clocks/Clock Index.md'] = _render_clock_index(runtime_clock_seeds)
        for clock in runtime_clock_seeds:
            files[f'Clocks/{_filename(clock.id)} - {_filename(clock.title)}.md'] = _render_clock_note(clock, exported_at)

    if runtime_faction_seeds:
        files['Factions/Faction Index.md'] = _render_faction_index(runtime_faction_seeds)
        for faction in runtime_faction_seeds:
            files[f'Factions/{_filename(faction.id)} - {_filename(faction.title)}.md'] = _render_faction_note(faction, exported_at)

    if runtime_hook_seeds:
        files['Hooks/Hook Index.md'] = _render_hook_index(runtime_hook_seeds)
        for hook in runtime_hook_seeds:
            files[f'Hooks/{_filename(hook.id)} - {_filename(hook.title)}.md'] = _render_hook_note(hook, exported_at)

    for module in loaded_modules:
        folder = _category_folder(module.category)
        files[f'{folder}/{_filename(module.name)}.md'] = _render_module_note(module)
        for group in module.subagentGroups:
            files[f'Cast/{_filename(_pretty_label(group.name))}/Index.md'] = _render_group_index(group)
            for agent in group.agents:
                files[f'Cast/{_filename(_pretty_label(group.name))}/{_filename(_pretty_label(agent.name))}.md'] = _render_agent_note(
                    payload,
                    runtime_settings,
                    _pretty_label(group.name),
                    agent.model_dump(mode='json'),
                    exported_at,
                )

    if runtime_settings:
        for group_name, group in {group.name: group for group in runtime_settings.subagentLibrary}.items():
            files.setdefault(f'Cast/{_filename(_pretty_label(group.name))}/Index.md', _render_group_index(group))
            for agent in group.agents:
                files.setdefault(
                    f'Cast/{_filename(_pretty_label(group.name))}/{_filename(_pretty_label(agent.name))}.md',
                    _render_agent_note(payload, runtime_settings, _pretty_label(group_name), agent.model_dump(mode='json'), exported_at),
                )

    payload_json = json.dumps(payload.model_dump(mode='json'), indent=2, ensure_ascii=False)
    runtime_json = json.dumps(runtime_settings.model_dump(mode='json') if runtime_settings else {}, indent=2, ensure_ascii=False)
    files['_langsuite/graph_payload.json'] = payload_json + '\n'
    files['_langsuite/runtime_settings.json'] = runtime_json + '\n'
    files['_langsuite/README.md'] = (
        '# LangSuite companion data\n\n'
        'These files are exported for traceability. The graph remains the executable source of truth; '
        'the markdown notes are the Obsidian-facing campaign surface.\n'
    )
    files['_langsuite/export_manifest.json'] = _build_export_manifest(payload, files, exported_at)

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
        root = _filename(f'{payload.graph_id} Obsidian Vault', fallback='langsuite_obsidian_vault')
        for path, content in sorted(files.items()):
            zf.writestr(f'{root}/{path}', content)
    buffer.seek(0)
    return buffer

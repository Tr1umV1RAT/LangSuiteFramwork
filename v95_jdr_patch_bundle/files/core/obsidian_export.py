from __future__ import annotations

import io
import json
import re
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from typing import Iterable

from core.schemas import GraphPayload, ModuleLibraryEntry, PromptStripAssignment, PromptStripDefinition, RuntimeSettings, SubagentGroup


def _slug(value: str, fallback: str = 'note') -> str:
    cleaned = re.sub(r"[^A-Za-z0-9 _-]+", "", str(value or "")).strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned[:96] or fallback


def _filename(value: str, fallback: str = 'note') -> str:
    return _slug(value, fallback).replace('/', ' ').replace('\\', ' ').strip() or fallback


def _pretty_label(value: str) -> str:
    raw = str(value or '').replace('_', ' ').strip()
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
    ordered = []
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


def _format_frontmatter(fields: dict[str, object]) -> str:
    lines = ['---']
    for key, value in fields.items():
        if value is None:
            continue
        if isinstance(value, list):
            lines.append(f'{key}:')
            for item in value:
                lines.append(f'  - "{str(item).replace(chr(34), chr(39))}"')
        else:
            lines.append(f'{key}: "{str(value).replace(chr(34), chr(39))}"')
    lines.append('---')
    return '\n'.join(lines)


def _collect_prompt_strip_index(runtime_settings: RuntimeSettings | None, loaded_modules: Iterable[ModuleLibraryEntry]) -> dict[str, PromptStripDefinition]:
    index: dict[str, PromptStripDefinition] = {}
    if runtime_settings:
        for strip in runtime_settings.promptStripLibrary:
            index[strip.id] = strip
    for module in loaded_modules:
        for strip in module.promptStrips:
            index[strip.id] = strip
    return index


def _render_module_note(module: ModuleLibraryEntry) -> str:
    frontmatter = _format_frontmatter({
        'title': module.name,
        'module_id': module.id,
        'category': module.category,
        'lineage': module.lineage,
        'branch_targets': module.branchTargets,
        'theme_hints': module.themeHints,
        'recommended_profile': module.recommendedProfile or '',
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
        'strip_id': strip.id,
        'tags': strip.tags,
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
    frontmatter = _format_frontmatter({'title': display_name, 'group_name': group.name})
    lines = [frontmatter, '', f'# {display_name}', '', '## Agents']
    for agent in group.agents:
        lines.append(f'- [[Cast/{_filename(_pretty_label(group.name))}/{_filename(_pretty_label(agent.name))}]]')
    lines.append('')
    return '\n'.join(lines)


def _render_agent_note(group_name: str, agent: dict) -> str:
    display_name = _pretty_label(agent['name'])
    frontmatter = _format_frontmatter({'title': display_name, 'group': group_name})
    lines = [frontmatter, '', f"# {display_name}", '']
    if agent.get('description'):
        lines.extend([agent['description'], ''])
    lines.extend(['## System prompt', '```text', agent.get('systemPrompt', ''), '```', ''])
    tools = agent.get('tools') or []
    if tools:
        lines.append('## Tools')
        for tool in tools:
            lines.append(f'- `{tool}`')
        lines.append('')
    return '\n'.join(lines).strip() + '\n'


def _render_runtime_note(payload: GraphPayload, runtime_settings: RuntimeSettings | None) -> str:
    context = _runtime_context_map(runtime_settings)
    node_lines = [f"- `{node.id}` · `{node.type}`" for node in payload.nodes]
    tool_lines = [f"- `{tool.id}` · `{tool.type}`" for tool in payload.tools]
    frontmatter = _format_frontmatter({
        'title': 'Graph Runtime',
        'graph_id': payload.graph_id,
        'project_mode': payload.ui_context.project_mode if payload.ui_context else '',
        'execution_profile': payload.ui_context.execution_profile if payload.ui_context else '',
    })
    lines = [frontmatter, '', '# Graph Runtime', '', 'This tabletop experience is powered by the LangSuite graph. Obsidian is a companion vault for worldbuilding, scene prep, and play notes.', '', '## Runtime truth', f'- Graph id: `{payload.graph_id}`', f'- Project mode: `{payload.ui_context.project_mode if payload.ui_context else "langgraph"}`', f'- Execution profile: `{payload.ui_context.execution_profile if payload.ui_context else ("langgraph_async" if payload.is_async else "langgraph_sync")}`', f'- Checkpoint enabled: `{payload.use_checkpoint}`', '']
    if context:
        lines.append('## Runtime context')
        for key, value in context.items():
            lines.append(f'- `{key}` = {value}')
        lines.append('')
    lines.extend(['## Nodes', *node_lines, '', '## Tools', *tool_lines, ''])
    return '\n'.join(lines).strip() + '\n'


def _render_scene_note(runtime_settings: RuntimeSettings | None) -> str:
    context = _runtime_context_map(runtime_settings)
    frontmatter = _format_frontmatter({
        'title': context.get('current_scene', 'Current Scene').replace('_', ' ').title(),
        'scene_id': context.get('current_scene', ''),
        'location': context.get('opening_location', ''),
    })
    lines = [frontmatter, '', '# Current Scene', '']
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


def _render_home_note(payload: GraphPayload, runtime_settings: RuntimeSettings | None, loaded_modules: list[ModuleLibraryEntry]) -> str:
    context = _runtime_context_map(runtime_settings)
    title = context.get('session_title') or payload.graph_id.replace('_', ' ').title()
    setting = context.get('setting_id', 'unknown')
    tone = context.get('tone_mode', 'unspecified')
    rules = context.get('rules_mode', 'unspecified')
    frontmatter = _format_frontmatter({
        'title': title,
        'graph_id': payload.graph_id,
        'session_kind': context.get('session_kind', ''),
        'setting_id': setting,
        'tone_mode': tone,
        'rules_mode': rules,
        'tags': ['langsuite', 'tabletop', 'obsidian', 'graph_companion'],
    })
    lines = [frontmatter, '', f'# {title}', '', 'This vault is an Obsidian companion for a tabletop session powered by LangSuite graphs.', '', '## Start here', '- [[Graphs/Graph Runtime]]', '- [[Scenes/Current Scene]]', '- [[Modules/Loaded Modules]]', '- [[Prompts/Active Prompt Strips]]', '']
    if loaded_modules:
        lines.append('## Loaded packs')
        for module in loaded_modules:
            folder = _category_folder(module.category)
            lines.append(f'- [[{folder}/{_filename(module.name)}]]')
        lines.append('')
    lines.extend(['## Current session frame', f'- Setting: `{setting}`', f'- Rules: `{rules}`', f'- Tone: `{tone}`'])
    if context.get('opening_location'):
        lines.append(f"- Opening location: `{context['opening_location']}`")
    if context.get('current_scene'):
        lines.append(f"- Current scene: `{context['current_scene']}`")
    lines.append('')
    lines.extend(['## Truth boundary', '- The graph remains the runtime source of truth.', '- These notes are for prep, recap, scene tracking, and campaign continuity inside Obsidian.', ''])
    return '\n'.join(lines)


def _render_loaded_modules_index(loaded_modules: list[ModuleLibraryEntry]) -> str:
    frontmatter = _format_frontmatter({'title': 'Loaded Modules'})
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
    frontmatter = _format_frontmatter({'title': 'Active Prompt Strips'})
    lines = [frontmatter, '', '# Active Prompt Strips', '']
    prompt_notes: dict[str, str] = {}
    for strip_id, strip in sorted(strip_index.items(), key=lambda item: item[1].name.lower()):
        lines.append(f'- [[Prompts/{_filename(strip.name)}]]')
        prompt_notes[f'Prompts/{_filename(strip.name)}.md'] = _render_strip_note(strip, strip_assignments.get(strip_id, []))
    lines.append('')
    return '\n'.join(lines), prompt_notes


def build_obsidian_vault(payload: GraphPayload) -> io.BytesIO:
    runtime_settings = payload.ui_context.runtime_settings if payload.ui_context else None
    loaded_modules = _loaded_modules(runtime_settings)
    files: dict[str, str] = {}
    files['00 Session Hub.md'] = _render_home_note(payload, runtime_settings, loaded_modules)
    files['Graphs/Graph Runtime.md'] = _render_runtime_note(payload, runtime_settings)
    files['Scenes/Current Scene.md'] = _render_scene_note(runtime_settings)
    files['Modules/Loaded Modules.md'] = _render_loaded_modules_index(loaded_modules)
    prompts_index, prompt_notes = _render_active_prompts_index(runtime_settings, loaded_modules)
    files['Prompts/Active Prompt Strips.md'] = prompts_index
    files.update(prompt_notes)

    for module in loaded_modules:
        folder = _category_folder(module.category)
        files[f'{folder}/{_filename(module.name)}.md'] = _render_module_note(module)
        for group in module.subagentGroups:
            files[f'Cast/{_filename(_pretty_label(group.name))}/Index.md'] = _render_group_index(group)
            for agent in group.agents:
                files[f'Cast/{_filename(_pretty_label(group.name))}/{_filename(_pretty_label(agent.name))}.md'] = _render_agent_note(_pretty_label(group.name), agent.model_dump())

    if runtime_settings:
        group_index = {group.name: group for group in runtime_settings.subagentLibrary}
        for group_name, group in group_index.items():
            files.setdefault(f'Cast/{_filename(_pretty_label(group.name))}/Index.md', _render_group_index(group))
            for agent in group.agents:
                files.setdefault(f'Cast/{_filename(_pretty_label(group.name))}/{_filename(_pretty_label(agent.name))}.md', _render_agent_note(_pretty_label(group.name), agent.model_dump()))

    payload_json = json.dumps(payload.model_dump(mode='json'), indent=2, ensure_ascii=False)
    runtime_json = json.dumps(runtime_settings.model_dump(mode='json') if runtime_settings else {}, indent=2, ensure_ascii=False)
    files['_langsuite/graph_payload.json'] = payload_json + '\n'
    files['_langsuite/runtime_settings.json'] = runtime_json + '\n'
    files['_langsuite/README.md'] = (
        '# LangSuite companion data\n\n'
        'These files are exported for traceability. The graph remains the executable source of truth; '\
        'the markdown notes are the Obsidian-facing campaign surface.\n'
    )

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
        root = _filename(f'{payload.graph_id} Obsidian Vault', fallback='langsuite_obsidian_vault')
        for path, content in sorted(files.items()):
            zf.writestr(f'{root}/{path}', content)
    buffer.seek(0)
    return buffer

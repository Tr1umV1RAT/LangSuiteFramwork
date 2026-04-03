from __future__ import annotations

from typing import Any

PROMPT_NODE_FIELD_BY_TYPE: dict[str, str] = {
    'llm_chat': 'system_prompt',
    'react_agent': 'system_prompt',
    'deep_subagent_worker': 'system_prompt',
    'prompt_template': 'prompt',
}

PROMPT_TOOL_FIELD_BY_TYPE: dict[str, str] = {
    'tool_llm_worker': 'system_prompt',
}


def _as_mapping(value: Any) -> dict[str, Any]:
    if hasattr(value, 'model_dump'):
        dumped = value.model_dump()
        return dumped if isinstance(dumped, dict) else {}
    return value if isinstance(value, dict) else {}


def _as_text(value: Any) -> str:
    return value if isinstance(value, str) else ''


def _target_key(target: dict[str, Any]) -> str:
    kind = str(target.get('kind') or '').strip()
    tab_id = str(target.get('tabId') or '').strip()
    if kind == 'graph':
        return f'graph:{tab_id}'
    if kind == 'node':
        return f"node:{tab_id}:{str(target.get('nodeId') or '').strip()}"
    if kind == 'subagent':
        return f"subagent:{tab_id}:{str(target.get('groupName') or '').strip()}:{str(target.get('agentName') or '').strip()}"
    return ''


def _truncate(text: str, limit: int = 240) -> str:
    stripped = text.strip()
    if len(stripped) <= limit:
        return stripped
    return stripped[: limit - 1].rstrip() + '…'


def _assignment_export(row: dict[str, Any], library: dict[str, dict[str, Any]]) -> dict[str, Any] | None:
    strip_id = str(row.get('stripId') or '').strip()
    strip = library.get(strip_id)
    if not strip:
        return None
    return {
        'id': str(row.get('id') or '').strip(),
        'stripId': strip_id,
        'stripName': _as_text(strip.get('name')).strip() or strip_id,
        'mergeMode': str(row.get('mergeMode') or 'prepend'),
        'order': int(row.get('order', 0) or 0),
        'enabled': row.get('enabled') is not False,
        'origin': _as_text(strip.get('origin')).strip() or 'workspace',
        'tags': list(strip.get('tags') or []) if isinstance(strip.get('tags'), list) else [],
        'preview': _truncate(_as_text(strip.get('body'))),
    }


def _library_by_id(runtime_settings: Any) -> dict[str, dict[str, Any]]:
    raw_library = _as_mapping(runtime_settings).get('promptStripLibrary') or []
    library: dict[str, dict[str, Any]] = {}
    for item in raw_library:
        row = _as_mapping(item)
        strip_id = _as_text(row.get('id')).strip()
        body = _as_text(row.get('body'))
        if not strip_id or not body.strip():
            continue
        library[strip_id] = row
    return library


def _iter_assignments_for_target(runtime_settings: Any, *, target: dict[str, Any]) -> list[dict[str, Any]]:
    key = _target_key(target)
    if not key:
        return []
    raw_assignments = _as_mapping(runtime_settings).get('promptStripAssignments') or []
    rows: list[dict[str, Any]] = []
    for item in raw_assignments:
        row = _as_mapping(item)
        if not row:
            continue
        target_row = _as_mapping(row.get('target'))
        if _target_key(target_row) != key:
            continue
        if row.get('enabled') is False:
            continue
        rows.append(row)
    rows.sort(key=lambda row: int(row.get('order', 0) or 0))
    return rows


def _bodies_for(assignments: list[dict[str, Any]], library: dict[str, dict[str, Any]], merge_mode: str) -> list[str]:
    bodies: list[str] = []
    for row in assignments:
        if str(row.get('mergeMode') or 'prepend') != merge_mode:
            continue
        strip = library.get(str(row.get('stripId') or '').strip())
        if not strip:
            continue
        body = _as_text(strip.get('body'))
        if body.strip():
            bodies.append(body)
    return bodies


def resolve_prompt_layers(*, local_prompt: str | None, library: dict[str, dict[str, Any]], graph_assignments: list[dict[str, Any]] | None = None, local_assignments: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    graph_assignments = list(graph_assignments or [])
    local_assignments = list(local_assignments or [])
    prepend_bodies = _bodies_for(graph_assignments, library, 'prepend') + _bodies_for(local_assignments, library, 'prepend')
    append_bodies = _bodies_for(graph_assignments, library, 'append') + _bodies_for(local_assignments, library, 'append')
    replace_bodies = _bodies_for(graph_assignments, library, 'replace_if_empty') + _bodies_for(local_assignments, library, 'replace_if_empty')
    base = _as_text(local_prompt)
    chosen_base = base if base.strip() else '\n\n'.join(replace_bodies)
    resolved = '\n\n'.join([*prepend_bodies, chosen_base, *append_bodies]).strip()
    return {
        'localPrompt': base,
        'resolvedPrompt': resolved,
        'prependBodies': prepend_bodies,
        'appendBodies': append_bodies,
        'replaceIfEmptyBodies': replace_bodies,
    }


def build_prompt_resolution_provenance(*, runtime_settings: Any, target_kind: str, tab_id: str | None, local_prompt: str | None, graph_target: dict[str, Any] | None = None, local_target: dict[str, Any] | None = None) -> dict[str, Any]:
    library = _library_by_id(runtime_settings)
    graph_assignments = _iter_assignments_for_target(runtime_settings, target=graph_target or {}) if graph_target else []
    local_assignments = _iter_assignments_for_target(runtime_settings, target=local_target or {}) if local_target else []
    resolved = resolve_prompt_layers(
        local_prompt=local_prompt,
        library=library,
        graph_assignments=graph_assignments,
        local_assignments=local_assignments,
    )
    graph_exports = [item for item in (_assignment_export(row, library) for row in graph_assignments) if item]
    local_exports = [item for item in (_assignment_export(row, library) for row in local_assignments) if item]
    return {
        'version': 'prompt_strip_runtime_meta_v1',
        'targetKind': target_kind,
        'tabId': tab_id or '',
        'graphTargetKey': _target_key(graph_target or {}) if graph_target else '',
        'targetKey': _target_key(local_target or graph_target or {}),
        'localPromptPresent': bool(_as_text(local_prompt).strip()),
        'resolvedPromptPreview': _truncate(resolved['resolvedPrompt']),
        'resolvedPromptLength': len(resolved['resolvedPrompt']),
        'graphAssignments': graph_exports,
        'localAssignments': local_exports,
        'graphAssignmentCount': len(graph_exports),
        'localAssignmentCount': len(local_exports),
        'resolvedStripIds': [item['stripId'] for item in [*graph_exports, *local_exports]],
        'replaceIfEmptyActivated': (not _as_text(local_prompt).strip()) and bool(resolved['replaceIfEmptyBodies']),
        'prependCount': len(resolved['prependBodies']),
        'appendCount': len(resolved['appendBodies']),
        'replaceIfEmptyCount': len(resolved['replaceIfEmptyBodies']),
    }


def resolve_prompt_for_node(*, runtime_settings: Any, tab_id: str | None, node_id: str, node_type: str, params: Any) -> dict[str, Any] | None:
    field_name = PROMPT_NODE_FIELD_BY_TYPE.get(node_type)
    if not field_name:
        return None
    param_map = _as_mapping(params)
    graph_target = {'kind': 'graph', 'tabId': tab_id or ''}
    node_target = {'kind': 'node', 'tabId': tab_id or '', 'nodeId': node_id}
    library = _library_by_id(runtime_settings)
    graph_assignments = _iter_assignments_for_target(runtime_settings, target=graph_target)
    local_assignments = _iter_assignments_for_target(runtime_settings, target=node_target)
    resolved = resolve_prompt_layers(
        local_prompt=_as_text(param_map.get(field_name)),
        library=library,
        graph_assignments=graph_assignments,
        local_assignments=local_assignments,
    )
    provenance = build_prompt_resolution_provenance(
        runtime_settings=runtime_settings,
        target_kind='node',
        tab_id=tab_id,
        local_prompt=_as_text(param_map.get(field_name)),
        graph_target=graph_target,
        local_target=node_target,
    )
    return {'fieldName': field_name, 'provenance': provenance, **resolved}


def resolve_prompt_for_tool(*, runtime_settings: Any, tab_id: str | None, tool_type: str, params: Any) -> dict[str, Any] | None:
    field_name = PROMPT_TOOL_FIELD_BY_TYPE.get(tool_type)
    if not field_name:
        return None
    param_map = _as_mapping(params)
    graph_target = {'kind': 'graph', 'tabId': tab_id or ''}
    library = _library_by_id(runtime_settings)
    graph_assignments = _iter_assignments_for_target(runtime_settings, target=graph_target)
    resolved = resolve_prompt_layers(
        local_prompt=_as_text(param_map.get(field_name)),
        library=library,
        graph_assignments=graph_assignments,
        local_assignments=[],
    )
    provenance = build_prompt_resolution_provenance(
        runtime_settings=runtime_settings,
        target_kind='tool',
        tab_id=tab_id,
        local_prompt=_as_text(param_map.get(field_name)),
        graph_target=graph_target,
        local_target=None,
    )
    return {'fieldName': field_name, 'provenance': provenance, **resolved}


def resolve_prompt_for_subagent(*, runtime_settings: Any, tab_id: str | None, group_name: str, agent_name: str, local_prompt: str | None) -> dict[str, Any]:
    graph_target = {'kind': 'graph', 'tabId': tab_id or ''}
    subagent_target = {
        'kind': 'subagent',
        'tabId': tab_id or '',
        'groupName': group_name,
        'agentName': agent_name,
    }
    library = _library_by_id(runtime_settings)
    graph_assignments = _iter_assignments_for_target(runtime_settings, target=graph_target)
    local_assignments = _iter_assignments_for_target(runtime_settings, target=subagent_target)
    resolved = resolve_prompt_layers(
        local_prompt=local_prompt,
        library=library,
        graph_assignments=graph_assignments,
        local_assignments=local_assignments,
    )
    provenance = build_prompt_resolution_provenance(
        runtime_settings=runtime_settings,
        target_kind='subagent',
        tab_id=tab_id,
        local_prompt=local_prompt,
        graph_target=graph_target,
        local_target=subagent_target,
    )
    return {'provenance': provenance, **resolved}

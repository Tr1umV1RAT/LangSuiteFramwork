from __future__ import annotations

import re
from copy import deepcopy
from typing import Any

from core.schemas import GraphPayload

PROMPT_ASSIGNMENT_ID_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def node_payload(node: dict) -> dict:
    data = node.get('data', {}) if isinstance(node, dict) else {}
    return {
        'id': node.get('id'),
        'type': data.get('nodeType'),
        'params': data.get('params', {}),
    }


def sanitize_prompt_assignment_identifier(raw: str | None, fallback: str) -> str:
    source = raw.strip() if isinstance(raw, str) and raw.strip() else fallback
    normalized = re.sub(r"[^A-Za-z0-9_]+", "_", source)
    normalized = re.sub(r"_+", "_", normalized).strip("_")
    if not normalized:
        return fallback
    return normalized if re.match(r"^[A-Za-z_]", normalized) else f"prompt_{normalized}"


def build_prompt_assignment_target_key(target: dict) -> str:
    kind = target.get('kind')
    if kind == 'graph':
        return f"graph:{target['tabId']}"
    if kind == 'node':
        return f"node:{target['tabId']}:{target['nodeId']}"
    return f"subagent:{target['tabId']}:{target['groupName']}:{target['agentName']}"


def build_prompt_assignment_target_id_part(target: dict) -> str:
    kind = target.get('kind')
    if kind == 'graph':
        return f"graph_{target['tabId']}"
    if kind == 'node':
        return f"node_{target['tabId']}_{target['nodeId']}"
    return f"subagent_{target['tabId']}_{target['groupName']}_{target['agentName']}"


def sanitize_assignments(assignments: list[dict]) -> list[dict]:
    seen: set[str] = set()
    cleaned: list[dict] = []
    for index, item in enumerate(assignments):
        base_id = sanitize_prompt_assignment_identifier(item.get('id'), f'prompt_assignment_{index + 1}')
        candidate = base_id
        suffix = 2
        while candidate in seen:
            candidate = f"{base_id}_{suffix}"
            suffix += 1
        seen.add(candidate)
        cleaned.append({**item, 'id': candidate})
    return cleaned


def merge_prompt_assignments_from_module(base: list[dict], module_entry: dict, tab_id: str) -> list[dict]:
    next_assignments = [dict(item) for item in base]
    existing_keys = {
        f"{item['stripId']}:{build_prompt_assignment_target_key(item['target'])}:{item['mergeMode']}"
        for item in next_assignments
    }
    max_order_by_target: dict[str, int] = {}
    for item in next_assignments:
        key = build_prompt_assignment_target_key(item['target'])
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
        target_key = build_prompt_assignment_target_key(target)
        dedupe_key = f"{preset['stripId']}:{target_key}:{preset.get('mergeMode', 'prepend')}"
        if dedupe_key in existing_keys:
            continue
        next_order_base = max_order_by_target.get(target_key, -1) + 1
        order = min(999, max(next_order_base, int(preset.get('order', index))))
        next_assignments.append({
            'id': sanitize_prompt_assignment_identifier(
                f"{module_entry['id']}__{preset.get('id') or f'preset_{index + 1}'}__{build_prompt_assignment_target_id_part(target)}",
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
    return sanitize_assignments(next_assignments)


def build_guided_runtime_settings(runtime: dict, selected_module_ids: list[str], tab_id: str = 'starter_tab') -> dict:
    module_index = {entry['id']: entry for entry in runtime['moduleLibrary']}
    guided = deepcopy(runtime)
    guided['loadedModuleIds'] = []
    guided['promptStripAssignments'] = []
    guided['subagentLibrary'] = []
    guided['runtimeContext'] = [entry for entry in runtime.get('runtimeContext', []) if entry.get('key') == 'session_kind']
    guided['sceneSeeds'] = []
    guided['encounterSeeds'] = []
    guided['locationSeeds'] = []
    guided['clockSeeds'] = []
    guided['factionSeeds'] = []
    guided['hookSeeds'] = []
    guided['slotBindings'] = []
    for module_id in selected_module_ids:
        module_entry = module_index[module_id]
        guided['loadedModuleIds'] = [*guided['loadedModuleIds'], module_id]
        guided['promptStripAssignments'] = merge_prompt_assignments_from_module(guided['promptStripAssignments'], module_entry, tab_id)
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


def build_graph_payload(artifact: dict, runtime_settings: dict, graph_id: str = 'jdr_guided_payload') -> GraphPayload:
    return GraphPayload(
        graph_id=graph_id,
        ui_context={
            'tab_id': 'starter_tab',
            'artifact_type': 'graph',
            'execution_profile': 'langgraph_async',
            'project_mode': 'langgraph',
            'runtime_settings': runtime_settings,
        },
        nodes=[node_payload(node) for node in artifact['nodes']],
        edges=artifact['edges'],
        tools=artifact['tools'],
        is_async=artifact.get('isAsync', True),
    )


def build_workspace_snapshot(artifact: dict, runtime_settings: dict, project_name: str = 'Tabletop Session') -> dict[str, Any]:
    return {
        'version': 'langsuite.v21.workspace',
        'root': {
            'projectId': None,
            'projectName': project_name,
            'nodes': artifact['nodes'],
            'edges': artifact['edges'],
            'parentProjectId': None,
            'parentNodeId': None,
            'customStateSchema': artifact.get('customStateSchema', []),
            'graphBindings': artifact.get('graphBindings', []),
            'isAsync': artifact.get('isAsync', True),
            'scopeKind': 'project',
            'scopePath': project_name,
            'artifactType': artifact.get('artifactType', 'graph'),
            'executionProfile': artifact.get('executionProfile', 'langgraph_async'),
            'projectMode': artifact.get('projectMode', 'langgraph'),
            'runtimeSettings': runtime_settings,
        },
        'children': [],
        'activeScopeKey': None,
        'openChildScopeKeys': [],
    }


def build_project_data(artifact: dict, runtime_settings: dict) -> dict[str, Any]:
    return {
        'nodes': artifact['nodes'],
        'edges': artifact['edges'],
        'customStateSchema': artifact.get('customStateSchema', []),
        'graphBindings': artifact.get('graphBindings', []),
        'isAsync': artifact.get('isAsync', True),
        'scopeKind': 'project',
        'scopePath': artifact.get('name', 'Tabletop Session'),
        'artifactType': artifact.get('artifactType', 'graph'),
        'executionProfile': artifact.get('executionProfile', 'langgraph_async'),
        'projectMode': artifact.get('projectMode', 'langgraph'),
        'runtimeSettings': runtime_settings,
    }


def runtime_context_value(runtime_settings: dict, key: str) -> str | None:
    for entry in runtime_settings.get('runtimeContext', []):
        if entry.get('key') == key:
            return entry.get('value')
    return None

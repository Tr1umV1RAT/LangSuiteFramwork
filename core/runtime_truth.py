from __future__ import annotations

import json
from typing import Any

RUNTIME_EVENT_VERSION = 'runtime_event_v1'

_REASON_CODE_ALIASES = {
    'shell_execution_not_armed': 'shell_not_armed',
}


def as_record(value: Any) -> dict[str, Any] | None:
    return value if isinstance(value, dict) else None


def parse_maybe_json(value: Any) -> Any:
    if not isinstance(value, str):
        return value
    trimmed = value.strip()
    if not trimmed or trimmed[0] not in '{[':
        return value
    try:
        return json.loads(trimmed)
    except Exception:
        return value


def normalize_reason_code(code: str | None) -> str | None:
    if not isinstance(code, str):
        return None
    cleaned = code.strip()
    if not cleaned:
        return None
    return _REASON_CODE_ALIASES.get(cleaned, cleaned)


def extract_reason_code(message: str | None) -> str | None:
    if not isinstance(message, str):
        return None
    stripped = message.strip()
    if stripped.startswith('[') and ']' in stripped:
        raw = stripped[1:stripped.index(']')].strip()
        return normalize_reason_code(raw)
    return None


def _tool_observation_from_value(value: Any) -> dict[str, Any] | None:
    parsed = parse_maybe_json(value)
    record = as_record(parsed)
    if not record:
        return None
    toolkit = record.get('toolkit')
    operation = record.get('operation')
    status = record.get('status')
    if not all(isinstance(item, str) and item.strip() for item in (toolkit, operation, status)):
        return None
    return {
        'toolkit': str(toolkit),
        'operation': str(operation),
        'status': str(status),
        'reasonCode': normalize_reason_code(record.get('reason_code') if isinstance(record.get('reason_code'), str) else None),
        'mode': str(record.get('mode')) if isinstance(record.get('mode'), str) else None,
        'path': str(record.get('path')) if isinstance(record.get('path'), str) else None,
        'message': str(record.get('message')) if isinstance(record.get('message'), str) else None,
    }


def collect_tool_observation(value: Any, *, _depth: int = 0) -> dict[str, Any] | None:
    if _depth > 2:
        return None
    parsed = parse_maybe_json(value)
    record = as_record(parsed)
    if not record:
        return None
    direct = _tool_observation_from_value(record)
    if direct:
        return direct
    for child in record.values():
        nested = collect_tool_observation(child, _depth=_depth + 1)
        if nested:
            return nested
    return None


def build_runtime_event(message: dict[str, Any]) -> dict[str, Any]:
    msg_type = str(message.get('type') or '').strip() or 'unknown'
    runtime: dict[str, Any] = {
        'schemaVersion': RUNTIME_EVENT_VERSION,
        'eventType': msg_type,
        'kind': 'opaque',
    }

    if msg_type == 'node_update':
        data = as_record(message.get('data')) or {}
        node_ids = [str(key) for key in data.keys()]
        primary_node_id = node_ids[0] if node_ids else None
        primary_payload = data.get(primary_node_id) if primary_node_id else None
        observation = collect_tool_observation(primary_payload)
        runtime.update({
            'kind': 'runtime_update',
            'nodeIds': node_ids,
            'primaryNodeId': primary_node_id,
            'fanoutBound': bool(message.get('fanout_meta')),
            'observation': observation,
        })
        return runtime

    if msg_type == 'state_sync':
        next_nodes = [str(item) for item in (message.get('next') or []) if isinstance(item, str)]
        runtime.update({
            'kind': 'state',
            'nextNodes': next_nodes,
            'stateKeys': list((as_record(message.get('state')) or {}).keys()),
        })
        return runtime

    if msg_type == 'embedded_trace':
        runtime.update({
            'kind': 'trace',
            'nodeId': str(message.get('node_id')) if isinstance(message.get('node_id'), str) else None,
            'phase': str(message.get('phase')) if isinstance(message.get('phase'), str) else None,
            'reasonCode': normalize_reason_code(message.get('reasonCode') if isinstance(message.get('reasonCode'), str) else None),
            'integrationModel': str(message.get('integration_model')) if isinstance(message.get('integration_model'), str) else None,
            'executionKind': str(message.get('execution_kind')) if isinstance(message.get('execution_kind'), str) else None,
            'providerBacked': bool(message.get('provider_backed')),
        })
        return runtime

    if msg_type == 'error':
        runtime.update({
            'kind': 'error',
            'stage': str(message.get('stage')) if isinstance(message.get('stage'), str) else None,
            'reasonCode': normalize_reason_code(message.get('reasonCode') if isinstance(message.get('reasonCode'), str) else extract_reason_code(message.get('message') if isinstance(message.get('message'), str) else None)),
            'nodeId': str(message.get('node_id')) if isinstance(message.get('node_id'), str) else None,
        })
        return runtime

    if msg_type in {'started', 'paused', 'completed', 'stopped'}:
        runtime.update({
            'kind': 'lifecycle',
            'status': msg_type,
            'nodeId': str(message.get('pending_node')) if msg_type == 'paused' and isinstance(message.get('pending_node'), str) else None,
            'graphScope': str(message.get('graph_scope')) if isinstance(message.get('graph_scope'), str) else None,
            'scopeLineage': [str(item) for item in (message.get('scope_lineage') or []) if isinstance(item, str)],
            'artifactType': str(message.get('artifact_type')) if isinstance(message.get('artifact_type'), str) else None,
            'executionProfile': str(message.get('execution_profile')) if isinstance(message.get('execution_profile'), str) else None,
        })
        return runtime

    return runtime


def with_runtime_event(message: dict[str, Any]) -> dict[str, Any]:
    enriched = dict(message)
    enriched['runtime'] = build_runtime_event(enriched)
    return enriched

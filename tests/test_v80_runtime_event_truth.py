from __future__ import annotations

from core.runtime_truth import build_runtime_event, normalize_reason_code, with_runtime_event


def test_runtime_event_wraps_node_updates_with_tool_observation_summary() -> None:
    payload = with_runtime_event({
        'type': 'node_update',
        'data': {
            'node_1': {
                'tool_result': {
                    'toolkit': 'shell',
                    'operation': 'shell_command',
                    'status': 'blocked',
                    'reason_code': 'shell_not_armed',
                    'message': 'Shell execution is not armed.',
                }
            }
        },
        'fanout_meta': {'source_node': 'map_1'},
    })

    runtime = payload['runtime']
    assert runtime['schemaVersion'] == 'runtime_event_v1'
    assert runtime['kind'] == 'runtime_update'
    assert runtime['primaryNodeId'] == 'node_1'
    assert runtime['fanoutBound'] is True
    assert runtime['observation']['toolkit'] == 'shell'
    assert runtime['observation']['reasonCode'] == 'shell_not_armed'


def test_runtime_event_normalizes_preflight_reason_aliases() -> None:
    payload = build_runtime_event({
        'type': 'error',
        'stage': 'runtime_preflight',
        'reasonCode': 'shell_execution_not_armed',
        'message': 'Tool requires shell arming.',
    })
    assert payload['kind'] == 'error'
    assert payload['reasonCode'] == 'shell_not_armed'
    assert normalize_reason_code('shell_execution_not_armed') == 'shell_not_armed'


def test_runtime_event_wraps_started_and_state_sync_surfaces() -> None:
    started = with_runtime_event({
        'type': 'started',
        'graph_scope': 'root/project',
        'scope_lineage': ['root', 'project'],
        'artifact_type': 'graph',
        'execution_profile': 'langgraph_async',
    })
    assert started['runtime']['kind'] == 'lifecycle'
    assert started['runtime']['graphScope'] == 'root/project'
    assert started['runtime']['artifactType'] == 'graph'

    state_sync = with_runtime_event({'type': 'state_sync', 'state': {'a': 1}, 'next': ['node_b']})
    assert state_sync['runtime']['kind'] == 'state'
    assert state_sync['runtime']['nextNodes'] == ['node_b']
    assert state_sync['runtime']['stateKeys'] == ['a']

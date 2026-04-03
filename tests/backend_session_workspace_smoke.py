from __future__ import annotations
import json, os, sys, tempfile
from pathlib import Path
from fastapi.testclient import TestClient
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

def recv_until(ws, wanted: str, limit: int = 8):
    for _ in range(limit):
        msg = ws.receive_json()
        if msg.get('type') == wanted:
            return msg
    raise AssertionError(f'Did not receive {wanted!r}')

def run():
    with tempfile.TemporaryDirectory(prefix='langsuite-v22-session-') as tmpdir:
        os.environ['DB_PATH'] = str(Path(tmpdir) / 'session.db')
        import importlib, db.database, db, main
        importlib.reload(db.database); importlib.reload(db); importlib.reload(main)
        client = TestClient(main.app)
        root_payload = {
            'nodes': [], 'edges': [], 'isAsync': True, 'scopeKind': 'project', 'scopePath': 'root/alpha', 'artifactType': 'graph', 'executionProfile': 'langgraph_async',
            'runtimeSettings': {'inheritParentBindings': True, 'allowCrossScopeReads': True, 'persistOutputsToState': True},
            'workspaceTree': {'version': 'langsuite.v21.workspace', 'root': {'projectId': None, 'projectName': 'Alpha', 'nodes': [], 'edges': [], 'parentProjectId': None, 'parentNodeId': None, 'customStateSchema': [], 'graphBindings': [], 'isAsync': True, 'scopeKind': 'project', 'scopePath': 'root/alpha', 'artifactType': 'graph', 'executionProfile': 'langgraph_async', 'runtimeSettings': {'inheritParentBindings': True, 'allowCrossScopeReads': True, 'persistOutputsToState': True}}, 'children': [{'projectId': None, 'projectName': 'Child', 'nodes': [], 'edges': [], 'parentProjectId': None, 'parentNodeId': 'sub_1', 'customStateSchema': [], 'graphBindings': [], 'isAsync': True, 'scopeKind': 'subgraph', 'scopePath': 'root/alpha/child', 'artifactType': 'subgraph', 'executionProfile': 'langgraph_async', 'runtimeSettings': {'inheritParentBindings': True, 'allowCrossScopeReads': True, 'persistOutputsToState': True}}], 'activeScopeKey': 'local::root/alpha/child::sub_1', 'openChildScopeKeys': ['local::root/alpha/child::sub_1']}
        }
        created = client.post('/api/projects', json={'name': 'Alpha', 'data': json.dumps(root_payload)}).json()
        session = client.post('/api/sessions', json={'project_id': created['id'], 'workspace_tree': root_payload['workspaceTree']}).json()
        got = client.get(f"/api/sessions/{session['id']}").json()
        assert got['workspace_tree']['children'][0]['scopeKind'] == 'subgraph'
        with client.websocket_connect(f"/api/ws/{session['id']}?username=alice") as ws1:
            init_msg = recv_until(ws1, 'init')
            assert init_msg['workspaceTree']['children'][0]['projectName'] == 'Child'
            with client.websocket_connect(f"/api/ws/{session['id']}?username=bob") as ws2:
                recv_until(ws2, 'users'); recv_until(ws1, 'users')
                updated_tree = dict(root_payload['workspaceTree'])
                updated_tree['children'] = list(updated_tree['children']) + [{'projectId': None, 'projectName': 'Second Child', 'nodes': [], 'edges': [], 'parentProjectId': None, 'parentNodeId': 'sub_2', 'customStateSchema': [], 'graphBindings': [], 'isAsync': True, 'scopeKind': 'subgraph', 'scopePath': 'root/alpha/second', 'artifactType': 'subgraph', 'executionProfile': 'langgraph_async', 'runtimeSettings': {'inheritParentBindings': True, 'allowCrossScopeReads': True, 'persistOutputsToState': True}}]
                updated_tree['openChildScopeKeys'] = ['local::root/alpha/child::sub_1', 'local::root/alpha/second::sub_2']
                ws1.send_json({'type': 'sync', 'projectName': 'Alpha', 'nodes': [], 'edges': [], 'isAsync': True, 'customStateSchema': [], 'graphBindings': [], 'scopeKind': 'project', 'scopePath': 'root/alpha', 'artifactType': 'graph', 'executionProfile': 'langgraph_async', 'runtimeSettings': {'inheritParentBindings': True, 'allowCrossScopeReads': True, 'persistOutputsToState': True}, 'parentProjectId': None, 'parentNodeId': None, 'workspaceTree': updated_tree})
                bob_sync = recv_until(ws2, 'sync')
                assert len(bob_sync['workspaceTree']['children']) == 2
        final_session = client.get(f"/api/sessions/{session['id']}").json()
        assert len(final_session['workspace_tree']['children']) == 2
if __name__ == '__main__':
    run()

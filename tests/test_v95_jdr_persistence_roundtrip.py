from __future__ import annotations

import importlib
import json
import os
import sys
from pathlib import Path

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.artifact_registry import get_artifact
from tests.jdr_test_helpers import build_guided_runtime_settings, build_project_data, build_workspace_snapshot, runtime_context_value


def _fresh_client(tmp_path: Path) -> TestClient:
    os.environ['DB_PATH'] = str(tmp_path / 'jdr_roundtrip.db')
    import db.database as database
    import db.projects as projects
    import db.sessions as sessions
    import api.collaboration as collaboration
    import main as app_main

    importlib.reload(database)
    database.init_db()
    importlib.reload(projects)
    importlib.reload(sessions)
    importlib.reload(collaboration)
    app_main = importlib.reload(app_main)
    return TestClient(app_main.app)


def test_jdr_project_and_session_roundtrip_preserve_default_runtime_settings(tmp_path: Path) -> None:
    manifest = get_artifact('graph', 'jdr_solo_session_starter')
    assert manifest is not None
    artifact = manifest['artifact']
    runtime = artifact['runtimeSettings']

    client = _fresh_client(tmp_path)
    project_resp = client.post('/api/projects', json={
        'name': 'JDR Default Session',
        'data': json.dumps(build_project_data(artifact, runtime)),
    })
    assert project_resp.status_code == 200
    project = project_resp.json()
    project_id = project['id']

    fetched_project = client.get(f'/api/projects/{project_id}')
    assert fetched_project.status_code == 200
    stored_data = json.loads(fetched_project.json()['data'])
    assert stored_data['runtimeSettings']['loadedModuleIds'] == runtime['loadedModuleIds']
    assert stored_data['runtimeSettings']['promptStripAssignments'] == runtime['promptStripAssignments']
    assert stored_data['runtimeSettings']['subagentLibrary'] == runtime['subagentLibrary']
    assert runtime_context_value(stored_data['runtimeSettings'], 'setting_id') == 'frontier_fantasy'

    workspace_tree = build_workspace_snapshot(artifact, runtime, project_name='JDR Default Session')
    session_resp = client.post('/api/sessions', json={
        'project_id': project_id,
        'workspace_tree': workspace_tree,
    })
    assert session_resp.status_code == 200
    session_id = session_resp.json()['id']

    fetched_session = client.get(f'/api/sessions/{session_id}')
    assert fetched_session.status_code == 200
    returned_tree = fetched_session.json()['workspace_tree']
    assert returned_tree['root']['runtimeSettings']['loadedModuleIds'] == runtime['loadedModuleIds']
    assert returned_tree['root']['runtimeSettings']['promptStripAssignments'] == runtime['promptStripAssignments']
    assert returned_tree['root']['runtimeSettings']['subagentLibrary'] == runtime['subagentLibrary']
    assert runtime_context_value(returned_tree['root']['runtimeSettings'], 'setting_id') == 'frontier_fantasy'


def test_jdr_guided_workspace_and_package_json_roundtrip_preserve_guided_runtime_settings(tmp_path: Path) -> None:
    manifest = get_artifact('graph', 'jdr_solo_session_starter')
    assert manifest is not None
    artifact = manifest['artifact']
    guided_runtime = build_guided_runtime_settings(artifact['runtimeSettings'], [
        'module_jdr_world_corporate_arcology',
        'module_jdr_rules_hard_choice_clocks',
        'module_jdr_persona_gm_fair_guide',
        'module_jdr_tone_paranoid_intrigue',
        'module_jdr_party_response_team',
        'module_jdr_utility_structured_referee',
    ])

    client = _fresh_client(tmp_path)
    project_resp = client.post('/api/projects', json={
        'name': 'JDR Guided Session',
        'data': json.dumps(build_project_data(artifact, guided_runtime)),
    })
    assert project_resp.status_code == 200
    project_id = project_resp.json()['id']

    workspace_tree = build_workspace_snapshot(artifact, guided_runtime, project_name='JDR Guided Session')
    session_resp = client.post('/api/sessions', json={
        'project_id': project_id,
        'workspace_tree': workspace_tree,
    })
    assert session_resp.status_code == 200
    session_id = session_resp.json()['id']
    returned_tree = client.get(f'/api/sessions/{session_id}').json()['workspace_tree']
    returned_runtime = returned_tree['root']['runtimeSettings']

    assert returned_runtime['loadedModuleIds'] == guided_runtime['loadedModuleIds']
    assert returned_runtime['promptStripAssignments'] == guided_runtime['promptStripAssignments']
    assert returned_runtime['subagentLibrary'] == guided_runtime['subagentLibrary']
    assert runtime_context_value(returned_runtime, 'setting_id') == 'corporate_arcology'
    assert runtime_context_value(returned_runtime, 'rules_helper') == 'structured_referee'

    package_payload = {
        'kind': 'project_package',
        'version': 'langsuite.v23.package',
        'packageType': 'editable_workspace',
        'projectName': 'JDR Guided Session',
        'workspaceTree': workspace_tree,
    }
    decoded = json.loads(json.dumps(package_payload))
    package_runtime = decoded['workspaceTree']['root']['runtimeSettings']
    assert package_runtime['loadedModuleIds'] == guided_runtime['loadedModuleIds']
    assert package_runtime['promptStripAssignments'] == guided_runtime['promptStripAssignments']
    assert package_runtime['subagentLibrary'] == guided_runtime['subagentLibrary']
    assert runtime_context_value(package_runtime, 'setting_id') == 'corporate_arcology'
    assert runtime_context_value(package_runtime, 'rules_helper') == 'structured_referee'

import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from pydantic import BaseModel
from typing import Any, Optional

from db import projects, sessions
from core.capability_matrix import known_artifact_kinds, known_execution_profiles, known_project_modes
from core.mode_contracts import infer_project_mode, is_mode_artifact_allowed, is_mode_execution_profile_allowed

router = APIRouter(prefix="/api", tags=["collaboration"])


def _sanitize_session_alias(value: str | None) -> str:
    raw = str(value or '').strip()
    compact = ' '.join(raw.split())[:32]
    return compact or 'Guest'


class ProjectCreate(BaseModel):
    name: str
    data: str = "{}"
    parent_project_id: Optional[str] = None
    parent_node_id: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    data: Optional[str] = None
    description: Optional[str] = None


class SessionCreate(BaseModel):
    project_id: str
    workspace_tree: Optional[dict[str, Any]] = None


class ConnectionManager:
    def __init__(self):
        self.rooms: dict[str, list[tuple[WebSocket, str]]] = {}

    async def connect(self, session_id: str, ws: WebSocket, username: str):
        await ws.accept()
        alias = _sanitize_session_alias(username)
        if session_id not in self.rooms:
            self.rooms[session_id] = []
        self.rooms[session_id].append((ws, alias))
        await self._broadcast_users(session_id)

    def disconnect(self, session_id: str, ws: WebSocket):
        if session_id in self.rooms:
            self.rooms[session_id] = [(w, u) for w, u in self.rooms[session_id] if w is not ws]
            if not self.rooms[session_id]:
                del self.rooms[session_id]

    async def broadcast_users(self, session_id: str):
        await self._broadcast_users(session_id)

    async def _broadcast_users(self, session_id: str):
        users = self.get_users(session_id)
        await self._send_all(session_id, json.dumps({"type": "users", "users": users, "identityKind": "session_alias"}))

    async def broadcast_sync(self, session_id: str, data: str, exclude: WebSocket | None = None):
        await self._send_all(session_id, data, exclude)

    async def _send_all(self, session_id: str, message: str, exclude: WebSocket | None = None):
        if session_id not in self.rooms:
            return
        dead = []
        for ws, _ in self.rooms[session_id]:
            if ws is exclude:
                continue
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(session_id, ws)

    def get_users(self, session_id: str) -> list[str]:
        if session_id not in self.rooms:
            return []
        return [u for _, u in self.rooms[session_id]]


manager = ConnectionManager()


def _parse_workspace_state(raw: str | None) -> dict[str, Any] | None:
    if not raw:
        return None
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else None
    except Exception:
        return None


@router.post("/projects")
def api_create_project(body: ProjectCreate):
    return projects.create_project(body.name, body.data, body.parent_project_id, body.parent_node_id)


@router.get("/projects")
def api_list_projects():
    project_list = projects.list_projects()
    for p in project_list:
        p["subgraph_count"] = len(projects.get_subgraphs(p["id"]))
    return project_list


@router.get("/projects/{project_id}")
def api_get_project(project_id: str):
    p = projects.get_project(project_id)
    if not p:
        raise HTTPException(404, "Project not found")
    p["subgraphs"] = projects.get_subgraphs(project_id)
    return p


@router.put("/projects/{project_id}")
def api_update_project(project_id: str, body: ProjectUpdate):
    p = projects.update_project(project_id, body.name, body.data, body.description)
    if not p:
        raise HTTPException(404, "Project not found")
    return p


@router.delete("/projects/{project_id}")
def api_delete_project(project_id: str):
    if not projects.delete_project(project_id):
        raise HTTPException(404, "Project not found")
    return {"ok": True}


@router.get("/projects/{project_id}/subgraphs")
def api_get_subgraphs(project_id: str):
    p = projects.get_project(project_id)
    if not p:
        raise HTTPException(404, "Project not found")
    return projects.get_subgraphs(project_id)


@router.get("/projects/{project_id}/tree")
def api_get_project_tree(project_id: str):
    p = projects.get_project_tree(project_id)
    if not p:
        raise HTTPException(404, "Project not found")
    return p


@router.post("/projects/{project_id}/duplicate")
def api_duplicate_project(project_id: str):
    p = projects.get_project(project_id)
    if not p:
        raise HTTPException(404, "Project not found")
    new_project = projects.create_project(
        f"{p['name']} (copie)",
        p.get("data", "{}"),
        p.get("parent_project_id"),
        p.get("parent_node_id"),
    )
    for sub in projects.get_subgraphs(project_id):
        sub_full = projects.get_project(sub["id"])
        sub_data = sub_full.get("data", "{}") if sub_full else "{}"
        projects.create_project(sub["name"], sub_data, new_project["id"], sub.get("parent_node_id"))
    return new_project


@router.post("/sessions")
def api_create_session(body: SessionCreate | None = None, project_id: Optional[str] = None):
    resolved_project_id = body.project_id if body else project_id
    if not resolved_project_id or not projects.get_project(resolved_project_id):
        raise HTTPException(404, "Project not found")
    workspace_tree = body.workspace_tree if body and isinstance(body.workspace_tree, dict) else None
    return sessions.create_session(resolved_project_id, json.dumps(workspace_tree) if workspace_tree else None)


@router.get("/sessions")
def api_list_sessions():
    return sessions.list_sessions()


@router.get("/sessions/{session_id}")
def api_get_session(session_id: str):
    s = sessions.get_session(session_id)
    if not s:
        raise HTTPException(404, "Session not found")
    s["users"] = manager.get_users(session_id)
    s["workspace_tree"] = _parse_workspace_state(s.get("workspace_state"))
    return s


@router.websocket("/ws/{session_id}")
async def ws_endpoint(websocket: WebSocket, session_id: str, username: str = "Guest"):
    s = sessions.get_session(session_id)
    if not s:
        await websocket.close(code=4004, reason="Session not found")
        return

    await manager.connect(session_id, websocket, username)
    try:
        p = projects.get_project(s["project_id"])
        if p:
            await websocket.send_text(json.dumps({"type": "init", "project": p, "workspaceTree": _parse_workspace_state(s.get("workspace_state"))}))

        while True:
            msg = json.loads(await websocket.receive_text())
            if msg.get("type") != "sync":
                continue
            nodes = msg.get("nodes", [])
            edges = msg.get("edges", [])
            project_name = msg.get("projectName")
            custom_state_schema = msg.get("customStateSchema", [])
            graph_bindings = msg.get("graphBindings", [])
            is_async = msg.get("isAsync", True)
            scope_kind = msg.get("scopeKind")
            scope_path = msg.get("scopePath")
            artifact_type = msg.get("artifactType")
            execution_profile = msg.get("executionProfile")
            runtime_settings = msg.get("runtimeSettings")
            project_mode = msg.get("projectMode")
            parent_project_id = msg.get("parentProjectId")
            parent_node_id = msg.get("parentNodeId")
            workspace_tree = msg.get("workspaceTree")
            if not isinstance(nodes, list) or not isinstance(edges, list):
                continue
            if not isinstance(custom_state_schema, list):
                custom_state_schema = []
            if not isinstance(graph_bindings, list):
                graph_bindings = []
            if project_name is not None and not isinstance(project_name, str):
                project_name = None
            if scope_kind not in (None, "project", "subgraph"):
                scope_kind = None
            if scope_path is not None and not isinstance(scope_path, str):
                scope_path = None
            if artifact_type not in (None, *known_artifact_kinds()):
                artifact_type = None
            if execution_profile not in (None, *known_execution_profiles()):
                execution_profile = None
            if project_mode not in (None, *known_project_modes()):
                project_mode = None
            project_mode = infer_project_mode(artifact_type=artifact_type, execution_profile=execution_profile, project_mode=project_mode)
            if artifact_type is not None and not is_mode_artifact_allowed(project_mode, artifact_type):
                artifact_type = None
            if execution_profile is not None and not is_mode_execution_profile_allowed(project_mode, execution_profile):
                execution_profile = None
            project_mode = infer_project_mode(artifact_type=artifact_type, execution_profile=execution_profile, project_mode=project_mode)
            if not isinstance(runtime_settings, dict):
                runtime_settings = {}
            if parent_project_id is not None and not isinstance(parent_project_id, str):
                parent_project_id = None
            if parent_node_id is not None and not isinstance(parent_node_id, str):
                parent_node_id = None
            if not isinstance(workspace_tree, dict):
                workspace_tree = None
            if len(json.dumps(msg)) > 5_000_000:
                continue

            data = json.dumps({
                "nodes": nodes,
                "edges": edges,
                "customStateSchema": custom_state_schema,
                "graphBindings": graph_bindings,
                "isAsync": bool(is_async),
                "scopeKind": scope_kind,
                "scopePath": scope_path,
                "artifactType": artifact_type,
                "executionProfile": execution_profile,
                "projectMode": project_mode,
                "runtimeSettings": runtime_settings,
            })
            projects.update_project(s["project_id"], name=project_name, data=data)
            if workspace_tree is not None:
                sessions.update_session_workspace_state(session_id, json.dumps(workspace_tree))
            await manager.broadcast_sync(session_id, json.dumps({
                "type": "sync",
                "projectName": project_name,
                "nodes": nodes,
                "edges": edges,
                "customStateSchema": custom_state_schema,
                "graphBindings": graph_bindings,
                "isAsync": bool(is_async),
                "scopeKind": scope_kind,
                "scopePath": scope_path,
                "artifactType": artifact_type,
                "executionProfile": execution_profile,
                "projectMode": project_mode,
                "runtimeSettings": runtime_settings,
                "parentProjectId": parent_project_id,
                "parentNodeId": parent_node_id,
                "workspaceTree": workspace_tree,
            }), exclude=websocket)
    except WebSocketDisconnect:
        manager.disconnect(session_id, websocket)
        await manager.broadcast_users(session_id)
    except Exception:
        manager.disconnect(session_id, websocket)
        try:
            await manager.broadcast_users(session_id)
        except Exception:
            pass

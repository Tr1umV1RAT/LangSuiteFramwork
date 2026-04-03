import json
import uuid
from db.database import get_db


def _data_marks_hidden_child(raw_data: str | None) -> bool:
    if not raw_data:
        return False
    try:
        parsed = json.loads(raw_data)
    except Exception:
        return False
    if not isinstance(parsed, dict):
        return False
    workspace_meta = parsed.get('workspaceMeta')
    if not isinstance(workspace_meta, dict):
        return False
    return workspace_meta.get('hiddenFromProjectTree') is True or workspace_meta.get('staleChild') is True


def create_project(name: str, data: str = "{}", parent_project_id: str | None = None, parent_node_id: str | None = None) -> dict:
    pid = str(uuid.uuid4())
    conn = get_db()
    conn.execute(
        "INSERT INTO projects (id, name, data, parent_project_id, parent_node_id) VALUES (?, ?, ?, ?, ?)",
        (pid, name, data, parent_project_id, parent_node_id),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM projects WHERE id = ?", (pid,)).fetchone()
    conn.close()
    return dict(row)


def get_project(project_id: str) -> dict | None:
    conn = get_db()
    row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def update_project(project_id: str, name: str | None = None, data: str | None = None, description: str | None = None) -> dict | None:
    conn = get_db()
    if name is not None:
        conn.execute(
            "UPDATE projects SET name = ?, updated_at = datetime('now') WHERE id = ?",
            (name, project_id),
        )
    if data is not None:
        conn.execute(
            "UPDATE projects SET data = ?, updated_at = datetime('now') WHERE id = ?",
            (data, project_id),
        )
    if description is not None:
        conn.execute(
            "UPDATE projects SET description = ?, updated_at = datetime('now') WHERE id = ?",
            (description, project_id),
        )
    conn.commit()
    row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def list_projects() -> list[dict]:
    conn = get_db()
    rows = conn.execute(
        "SELECT id, name, description, created_at, updated_at FROM projects WHERE parent_project_id IS NULL ORDER BY updated_at DESC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def delete_project(project_id: str) -> bool:
    conn = get_db()
    cur = conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
    conn.commit()
    conn.close()
    return cur.rowcount > 0


def get_subgraphs(project_id: str) -> list[dict]:
    conn = get_db()
    rows = conn.execute(
        "SELECT id, name, description, data, parent_node_id, created_at, updated_at FROM projects WHERE parent_project_id = ? ORDER BY updated_at DESC",
        (project_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows if not _data_marks_hidden_child(r['data'])]


def get_project_tree(project_id: str) -> dict | None:
    project = get_project(project_id)
    if project is None:
        return None
    children = get_subgraphs(project_id)
    project["subgraphs"] = [get_project_tree(child["id"]) for child in children]
    return project

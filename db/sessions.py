import uuid
from db.database import get_db


def create_session(project_id: str, workspace_state: str | None = None) -> dict:
    sid = str(uuid.uuid4())
    conn = get_db()
    conn.execute(
        "INSERT INTO sessions (id, project_id, workspace_state) VALUES (?, ?, ?)",
        (sid, project_id, workspace_state),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM sessions WHERE id = ?", (sid,)).fetchone()
    conn.close()
    return dict(row)


def get_session(session_id: str) -> dict | None:
    conn = get_db()
    row = conn.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def update_session_workspace_state(session_id: str, workspace_state: str | None) -> dict | None:
    conn = get_db()
    conn.execute("UPDATE sessions SET workspace_state = ? WHERE id = ?", (workspace_state, session_id))
    conn.commit()
    row = conn.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def list_sessions() -> list[dict]:
    conn = get_db()
    rows = conn.execute(
        """SELECT s.id, s.project_id, s.workspace_state, p.name as project_name, s.created_at
           FROM sessions s JOIN projects p ON s.project_id = p.id
           ORDER BY s.created_at DESC"""
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def delete_session(session_id: str) -> bool:
    conn = get_db()
    cur = conn.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
    conn.commit()
    conn.close()
    return cur.rowcount > 0

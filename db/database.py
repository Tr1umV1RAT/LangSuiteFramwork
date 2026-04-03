import os
import sqlite3
from pathlib import Path

DB_PATH = Path(os.environ.get("DB_PATH", str(Path(__file__).parent / "langgraph_builder.db")))


def init_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("PRAGMA foreign_keys=ON")

    conn.executescript("""
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            data TEXT NOT NULL DEFAULT '{}',
            description TEXT NOT NULL DEFAULT '',
            parent_project_id TEXT,
            parent_node_id TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (parent_project_id) REFERENCES projects(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            workspace_state TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );
    """)

    cursor = conn.execute("PRAGMA table_info(projects)")
    columns = {row[1] for row in cursor.fetchall()}
    if "parent_project_id" not in columns:
        conn.execute("ALTER TABLE projects ADD COLUMN parent_project_id TEXT")
    if "parent_node_id" not in columns:
        conn.execute("ALTER TABLE projects ADD COLUMN parent_node_id TEXT")
    if "description" not in columns:
        conn.execute("ALTER TABLE projects ADD COLUMN description TEXT NOT NULL DEFAULT ''")

    cursor = conn.execute("PRAGMA table_info(sessions)")
    session_columns = {row[1] for row in cursor.fetchall()}
    if "workspace_state" not in session_columns:
        conn.execute("ALTER TABLE sessions ADD COLUMN workspace_state TEXT")

    conn.execute("CREATE INDEX IF NOT EXISTS idx_projects_parent ON projects(parent_project_id)")

    conn.commit()
    conn.close()


def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

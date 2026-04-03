from __future__ import annotations
import importlib, json, os, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def run():
    with tempfile.TemporaryDirectory(prefix='langsuite-v24-project-tree-') as tmpdir:
        os.environ['DB_PATH'] = str(Path(tmpdir) / 'tree.db')
        import db.database, db.projects, db
        importlib.reload(db.database)
        importlib.reload(db.projects)
        importlib.reload(db)
        from db import projects

        root = projects.create_project('Root', json.dumps({'nodes': [], 'edges': []}))
        visible = projects.create_project('Visible Child', json.dumps({'scopeKind': 'subgraph'}), root['id'], 'sub_1')
        projects.create_project(
            'Stale Child',
            json.dumps({'scopeKind': 'subgraph', 'workspaceMeta': {'staleChild': True, 'hiddenFromProjectTree': True}}),
            root['id'],
            'sub_2',
        )

        subgraphs = projects.get_subgraphs(root['id'])
        assert len(subgraphs) == 1, subgraphs
        assert subgraphs[0]['id'] == visible['id']
        tree = projects.get_project_tree(root['id'])
        assert len(tree['subgraphs']) == 1
        assert tree['subgraphs'][0]['name'] == 'Visible Child'


if __name__ == '__main__':
    run()

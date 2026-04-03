from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RUN_PANEL = ROOT / 'client' / 'src' / 'components' / 'RunPanel.tsx'
RUNNER = ROOT / 'api' / 'runner.py'


def test_run_panel_exposes_ordered_run_path_and_backend_truth_boundary() -> None:
    text = RUN_PANEL.read_text(encoding='utf-8')
    assert 'data-testid="runtime-run-path"' in text
    assert 'What Run checks, in order' in text
    assert '1. Local graph validation' in text
    assert '2. Project-mode gate' in text
    assert 'backend checks the real Python environment' in text
    assert 'instead of trusting UI copy alone' in text
    assert 'Run stops before dependency or environment preflight' in text


def test_runner_order_matches_run_panel_causality_claims() -> None:
    text = RUNNER.read_text(encoding='utf-8')
    anchor = text.index('project_mode = infer_project_mode(')
    scoped = text[anchor:]
    editor_only_idx = scoped.index('if not is_mode_runtime_enabled(project_mode):')
    deps_idx = scoped.index('missing_dependencies = find_missing_runtime_dependencies(payload)')
    preflight_idx = scoped.index('preflight_issues = find_runtime_preflight_issues(payload)')
    assert editor_only_idx < deps_idx < preflight_idx

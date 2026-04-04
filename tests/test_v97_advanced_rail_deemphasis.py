from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / 'client' / 'src' / 'App.tsx'
PROJECT_MANAGER = ROOT / 'client' / 'src' / 'components' / 'ProjectManager.tsx'


def test_empty_state_keeps_advanced_rails_secondary() -> None:
    text = APP.read_text(encoding='utf-8')
    assert 'data-testid="empty-state-advanced-rail-note"' in text
    assert 'Projects → Advanced project types' in text
    assert 'reveal advanced project types only when you actually need them' in text


def test_project_manager_gates_advanced_project_types_behind_a_secondary_toggle() -> None:
    text = PROJECT_MANAGER.read_text(encoding='utf-8')
    assert 'data-testid="project-manager-primary-langgraph"' in text
    assert 'data-testid="project-manager-toggle-advanced-types"' in text
    assert 'data-testid="project-manager-advanced-project-types"' in text
    assert 'editor-first' in text
    assert 'trunk-backed' in text

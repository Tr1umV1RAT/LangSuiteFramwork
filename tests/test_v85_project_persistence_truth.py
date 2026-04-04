from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKSPACE = ROOT / 'client' / 'src' / 'store' / 'workspace.ts'
TOOLBAR = ROOT / 'client' / 'src' / 'components' / 'Toolbar.tsx'
PROJECT_MANAGER = ROOT / 'client' / 'src' / 'components' / 'ProjectManager.tsx'
SETTINGS = ROOT / 'client' / 'src' / 'components' / 'SettingsShell.tsx'
STATE_PANEL = ROOT / 'client' / 'src' / 'components' / 'StatePanelContent.tsx'
TRUTH_BLOCK = ROOT / 'client' / 'src' / 'components' / 'ProjectPersistenceTruthBlock.tsx'


def test_workspace_defines_project_persistence_truth_summaries() -> None:
    text = WORKSPACE.read_text(encoding='utf-8')
    assert 'buildProjectPersistenceSummary' in text
    assert 'Save in app updates the local app database' in text
    assert 'Open in Projects restores the saved editable workspace tree only.' in text
    assert 'Project packages move a portable workspace copy.' in text


def test_toolbar_surfaces_project_save_open_truth() -> None:
    text = TOOLBAR.read_text(encoding='utf-8')
    assert 'ProjectPersistenceTruthBlock' in text
    assert 'testIdPrefix="project-save-open"' in text
    assert 'showContrast={false}' in text


def test_project_manager_and_settings_shell_explain_open_consequences() -> None:
    manager_text = PROJECT_MANAGER.read_text(encoding='utf-8')
    settings_text = SETTINGS.read_text(encoding='utf-8')
    assert 'ProjectPersistenceTruthBlock' in manager_text
    assert 'testIdPrefix="project-manager"' in manager_text
    assert 'ProjectPersistenceTruthBlock' in settings_text
    assert 'testIdPrefix="settings-project-persistence"' in settings_text
    assert 'Project persistence truth' in settings_text


def test_artifact_publish_truth_block_is_not_duplicated() -> None:
    text = STATE_PANEL.read_text(encoding='utf-8')
    assert text.count('data-testid="artifact-publish-truth"') == 1


def test_shared_project_persistence_block_defines_save_open_and_contrast_truth() -> None:
    text = TRUTH_BLOCK.read_text(encoding='utf-8')
    assert 'data-testid={`${testIdPrefix}-save-truth`}' in text
    assert 'data-testid={`${testIdPrefix}-open-truth`}' in text
    assert 'data-testid={`${testIdPrefix}-contrast-truth`}' in text
    assert 'summary.saveEffectSummary' in text
    assert 'summary.openEffectSummary' in text
    assert 'summary.contrastSummary' in text


def test_toolbar_uses_shared_surface_truth_summary_helper() -> None:
    text = TOOLBAR.read_text(encoding='utf-8')
    assert 'buildSurfaceTruthSummary' in text
    assert 'function describeCurrentSurfaceTruth' not in text

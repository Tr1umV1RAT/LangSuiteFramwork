from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
README = ROOT / 'readme.md'
GITIGNORE = ROOT / '.gitignore'
TOOLBAR = ROOT / 'client' / 'src' / 'components' / 'Toolbar.tsx'
APP = ROOT / 'client' / 'src' / 'App.tsx'
PROJECT_MANAGER = ROOT / 'client' / 'src' / 'components' / 'ProjectManager.tsx'
ARTIFACT_LIBRARY = ROOT / 'client' / 'src' / 'components' / 'artifacts' / 'ArtifactLibrarySection.tsx'


def test_readme_reframes_product_truth_and_support_levels() -> None:
    text = README.read_text(encoding='utf-8')
    assert 'LangSuite is a **LangGraph-first visual authoring tool**.' in text
    assert 'Package export/import moves the editable workspace only.' in text
    assert 'Save in app**, **package export/import**, and **compile Python** are different operations' in text
    assert '## Support levels' in text


def test_gitignore_ignores_generated_and_local_state_artifacts() -> None:
    text = GITIGNORE.read_text(encoding='utf-8')
    assert 'db/langgraph_builder.db' in text
    assert 'client/dist/' in text
    assert 'static/assets/' in text


def test_toolbar_surfaces_package_consequence_dialog_and_advanced_deemphasis() -> None:
    text = TOOLBAR.read_text(encoding='utf-8')
    assert 'data-testid="package-consequence-dialog"' in text
    assert 'Before exporting this package' in text
    assert 'Before importing this package' in text
    assert 'recommended' in text
    assert 'optional' in text
    assert 'data-testid="advanced-mode-toolbar-note"' in text


def test_app_and_project_manager_deemphasize_advanced_surfaces() -> None:
    app_text = APP.read_text(encoding='utf-8')
    manager_text = PROJECT_MANAGER.read_text(encoding='utf-8')
    assert 'data-testid="advanced-mode-notice"' in app_text
    assert 'default product path is still the LangGraph trunk plus compile/export' in app_text
    assert 'data-testid="project-manager-mode-note"' in manager_text
    assert 'LangGraph is the default path.' in manager_text


def test_artifact_library_restates_advanced_view_truthfully() -> None:
    text = ARTIFACT_LIBRARY.read_text(encoding='utf-8')
    assert 'data-testid="artifact-library-advanced-note"' in text
    assert 'does not imply peer native runtime parity with the LangGraph trunk' in text

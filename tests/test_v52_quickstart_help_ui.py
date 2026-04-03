from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TYPES = ROOT / 'client' / 'src' / 'store' / 'types.ts'
PREFS = ROOT / 'client' / 'src' / 'store' / 'preferences.ts'
BLOCKS = ROOT / 'client' / 'src' / 'components' / 'BlocksPanelContent.tsx'
CUSTOM = ROOT / 'client' / 'src' / 'components' / 'CustomNode.tsx'
TOOLBAR = ROOT / 'client' / 'src' / 'components' / 'Toolbar.tsx'
SETTINGS = ROOT / 'client' / 'src' / 'components' / 'SettingsShell.tsx'


def test_palette_mode_includes_quickstart_and_defaults_to_it() -> None:
    types_text = TYPES.read_text(encoding='utf-8')
    prefs_text = PREFS.read_text(encoding='utf-8')
    settings_text = SETTINGS.read_text(encoding='utf-8')
    blocks_text = BLOCKS.read_text(encoding='utf-8')
    assert "'quickstart' | 'common' | 'all'" in types_text
    assert "paletteMode: 'quickstart'" in prefs_text
    assert "{ value: 'quickstart', label: 'Quickstart' }" in settings_text
    assert "paletteMode === 'quickstart'" in blocks_text
    assert 'Quickstart' in blocks_text


def test_custom_node_uses_help_button_instead_of_inline_explainer_walls() -> None:
    custom_text = CUSTOM.read_text(encoding='utf-8')
    assert 'data-testid={`node-help-${id}`}' in custom_text
    assert 'Quick help' in custom_text
    assert 'contextualHelpLines' in custom_text
    assert 'Handle affordances' in custom_text
    assert 'Tools handle: many tools may attach here' in custom_text


def test_toolbar_package_help_is_compact_with_opt_in_details() -> None:
    toolbar_text = TOOLBAR.read_text(encoding='utf-8')
    assert 'Portable package' in toolbar_text
    assert 'showPackageHelp' in toolbar_text
    assert 'Workspace only: graph, tabs, profiles, UI metadata.' in toolbar_text

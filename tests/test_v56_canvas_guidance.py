from pathlib import Path


def test_toolbar_exposes_canvas_help_popover() -> None:
    text = Path("client/src/components/Toolbar.tsx").read_text()
    assert "toolbar-canvas-help" in text
    assert "canvas-help-popover" in text
    assert "Canvas semantics" in text
    assert "Detached interactive circuits compile as independent graphs" in text


def test_state_panel_has_canvas_semantics_section() -> None:
    text = Path("client/src/components/StatePanelContent.tsx").read_text()
    assert 'Section title="Sémantique du canvas"' in text
    assert 'Semantic link kinds' in text
    assert "Les graph-scope markers n'ont pas besoin d'arêtes pour rester valides." in text

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / 'client' / 'src' / 'App.tsx'
RUN_PANEL = ROOT / 'client' / 'src' / 'components' / 'RunPanel.tsx'
CATALOG = ROOT / 'client' / 'src' / 'catalog.ts'
INSPECTOR = ROOT / 'client' / 'src' / 'components' / 'CapabilityInspectorSection.tsx'


def test_catalog_exposes_node_maturity_labels() -> None:
    text = CATALOG.read_text(encoding='utf-8')
    assert "export type NodeMaturity = 'supported' | 'advanced' | 'experimental' | 'legacy';" in text
    assert "supported: 'Supported'" in text
    assert "advanced: 'Advanced'" in text
    assert "experimental: 'Experimental'" in text
    assert "legacy: 'Legacy'" in text
    assert 'export function inferNodeMaturity' in text


def test_empty_state_surfaces_recommended_primary_path() -> None:
    text = APP.read_text(encoding='utf-8')
    assert 'data-testid="recommended-path-card"' in text
    assert 'Primary path' in text
    assert 'Export zip when you want the runnable Python output.' in text


def test_run_panel_surfaces_readiness_and_fact_markers() -> None:
    text = RUN_PANEL.read_text(encoding='utf-8')
    assert 'data-testid="runtime-readiness-checklist"' in text
    assert 'Runtime readiness' in text
    assert 'runtime emitted' in text
    assert 'legacy fallback' in text
    assert 'UI inferred' in text


def test_capability_inspector_surfaces_maturity() -> None:
    text = INSPECTOR.read_text(encoding='utf-8')
    assert 'Row label="Maturity"' in text

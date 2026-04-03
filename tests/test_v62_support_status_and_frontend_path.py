from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CAP_MATRIX = ROOT / 'client' / 'src' / 'capabilityMatrix.json'
PACKAGE_JSON = ROOT / 'client' / 'package.json'
CATALOG_TS = ROOT / 'client' / 'src' / 'catalog.ts'
INSPECTOR_TS = ROOT / 'client' / 'src' / 'components' / 'CapabilityInspectorSection.tsx'


def test_support_status_legend_is_present_and_complete() -> None:
    matrix = json.loads(CAP_MATRIX.read_text())
    legend = matrix.get('supportStatusLegend')
    assert isinstance(legend, dict)
    assert set(legend) == {'trunk_runtime', 'bridge_backed_runtime', 'editor_only', 'alias_backed'}
    assert all(isinstance(entry.get('description'), str) and entry['description'] for entry in legend.values())


def test_frontend_package_exposes_reproducible_verify_path() -> None:
    package = json.loads(PACKAGE_JSON.read_text())
    scripts = package.get('scripts', {})
    assert 'typecheck' in scripts
    assert 'build:static' in scripts
    assert 'verify' in scripts
    assert 'sync-dist.mjs' in scripts['build:static']


def test_catalog_and_inspector_surface_support_status_explicitly() -> None:
    catalog_text = CATALOG_TS.read_text()
    inspector_text = INSPECTOR_TS.read_text()
    assert 'Support status' in inspector_text
    assert 'SUPPORT_STATUS_LABELS' in catalog_text
    assert 'inferNodeSupportStatus' in catalog_text


def test_frontend_repro_script_dry_run_succeeds() -> None:
    result = subprocess.run(
        [sys.executable, str(ROOT / 'qa' / 'repro_frontend_build.py'), '--dry-run', '--skip-install'],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr or result.stdout
    assert 'npm run verify' in result.stdout

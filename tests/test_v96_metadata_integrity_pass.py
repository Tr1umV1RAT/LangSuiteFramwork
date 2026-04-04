from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MATRIX_PATH = ROOT / 'client' / 'src' / 'capabilityMatrix.json'
CATALOG_TS = ROOT / 'client' / 'src' / 'catalog.ts'
INSPECTOR_TS = ROOT / 'client' / 'src' / 'components' / 'CapabilityInspectorSection.tsx'
ARTIFACT_LIBRARY_TS = ROOT / 'client' / 'src' / 'components' / 'artifacts' / 'ArtifactLibrarySection.tsx'
CAPABILITIES_TS = ROOT / 'client' / 'src' / 'capabilities.ts'


def _matrix() -> dict:
    return json.loads(MATRIX_PATH.read_text(encoding='utf-8'))


def test_canonical_rail_taxonomy_matches_shared_json_and_backend() -> None:
    matrix = _matrix()
    canonical = {'trunk', 'composition', 'agentic', 'adapter', 'services'}
    assert set(matrix.get('rails', {}).keys()) == canonical


def test_no_matrix_entry_uses_noncanonical_rail_values() -> None:
    matrix = _matrix()
    canonical = set(matrix.get('rails', {}).keys())
    for section_name in ('artifactKinds', 'executionProfiles', 'projectModes', 'nodeTypes'):
        section = matrix.get(section_name, {})
        assert isinstance(section, dict)
        for key, meta in section.items():
            if isinstance(meta, dict) and 'rail' in meta:
                assert meta['rail'] in canonical, f'{section_name}:{key} uses noncanonical rail {meta["rail"]!r}'


def test_visible_runtime_palette_surfaces_resolve_to_known_rails_even_when_node_rail_is_omitted() -> None:
    matrix = _matrix()
    canonical = set(matrix.get('rails', {}).keys())
    node_defaults = matrix.get('nodeDefaults', {})
    node_types = matrix.get('nodeTypes', {})
    for key in ('memory_store_read', 'memoryreader', 'memorywriter'):
        node = node_types.get(key, {})
        resolved = node.get('rail') or node_defaults.get('rail')
        assert resolved in canonical


def test_catalog_exposes_fail_soft_rail_helpers() -> None:
    catalog_text = CATALOG_TS.read_text(encoding='utf-8')
    assert 'normalizeRailId' in catalog_text
    assert 'getRailLabel' in catalog_text
    assert 'getRailBadgeClass' in catalog_text
    assert "FALLBACK_RAIL_ID: RailId = 'trunk'" in catalog_text


def test_obvious_panels_use_fail_soft_rail_helpers() -> None:
    inspector_text = INSPECTOR_TS.read_text(encoding='utf-8')
    library_text = ARTIFACT_LIBRARY_TS.read_text(encoding='utf-8')
    assert 'getRailLabel' in inspector_text and 'getRailBadgeClass' in inspector_text
    assert 'getRailLabel' in library_text and 'getRailBadgeClass' in library_text
    assert 'RAIL_LABELS[' not in inspector_text
    assert 'RAIL_BADGE_CLASSES[' not in inspector_text
    assert 'RAIL_LABELS[' not in library_text
    assert 'RAIL_BADGE_CLASSES[' not in library_text

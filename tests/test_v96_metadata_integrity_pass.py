from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.capability_matrix import rail_meta
from core.artifact_registry import list_artifacts

CAP_MATRIX = ROOT / 'client' / 'src' / 'capabilityMatrix.json'
CATALOG = ROOT / 'client' / 'src' / 'catalog.ts'
BLOCKS = ROOT / 'client' / 'src' / 'components' / 'BlocksPanelContent.tsx'
INSPECTOR = ROOT / 'client' / 'src' / 'components' / 'CapabilityInspectorSection.tsx'
ARTIFACT_LIBRARY = ROOT / 'client' / 'src' / 'components' / 'artifacts' / 'ArtifactLibrarySection.tsx'


def _load_matrix() -> dict:
    return json.loads(CAP_MATRIX.read_text(encoding='utf-8'))


def test_canonical_rail_taxonomy_matches_shared_json_and_backend() -> None:
    matrix = _load_matrix()
    json_rails = tuple(matrix['rails'].keys())
    backend_rails = tuple(rail_meta().keys())
    assert backend_rails == json_rails
    assert json_rails == ('trunk', 'composition', 'agentic', 'adapter', 'services')


def test_no_matrix_entry_uses_noncanonical_rail_values() -> None:
    matrix = _load_matrix()
    rails = set(matrix['rails'])
    invalid: list[tuple[str, str, object]] = []
    for section in ('artifactKinds', 'executionProfiles', 'projectModes', 'nodeTypes'):
        for key, value in matrix.get(section, {}).items():
            if not isinstance(value, dict) or 'rail' not in value:
                continue
            if value['rail'] not in rails:
                invalid.append((section, key, value['rail']))
    assert invalid == []


def test_visible_runtime_palette_surfaces_resolve_to_known_rails_even_when_node_rail_is_omitted() -> None:
    matrix = _load_matrix()
    rails = set(matrix['rails'])
    runtime_backed = set(matrix.get('runtimeBackedNodeTypes', []))
    palette_hidden = set(matrix.get('paletteHiddenNodeTypes', []))
    default_rail = matrix['nodeDefaults']['rail']
    assert default_rail in rails

    invalid_visible_nodes: list[tuple[str, object]] = []
    for node_type, meta in matrix.get('nodeTypes', {}).items():
        if not isinstance(meta, dict):
            continue
        visible = (
            node_type in runtime_backed
            and node_type not in palette_hidden
            and not bool(meta.get('internalOnly'))
            and str(meta.get('surfaceLevel', matrix['nodeDefaults']['surfaceLevel'])) != 'internal'
        )
        if not visible:
            continue
        resolved_rail = meta.get('rail', default_rail)
        if resolved_rail not in rails:
            invalid_visible_nodes.append((node_type, resolved_rail))
    assert invalid_visible_nodes == []


def test_obvious_panels_use_fail_soft_rail_rendering_paths() -> None:
    catalog = CATALOG.read_text(encoding='utf-8')
    assert 'export function normalizeRailId(value: unknown): RailId {' in catalog
    assert "return typeof value === 'string' && value in RAIL_LABELS ? (value as RailId) : 'trunk';" in catalog
    assert 'export function getRailLabel(value: unknown): string {' in catalog
    assert 'export function getRailBadgeClass(value: unknown): string {' in catalog

    blocks = BLOCKS.read_text(encoding='utf-8')
    assert "const railKey = (capability.rail && capability.rail in RAIL_LABELS ? capability.rail : 'trunk')" in blocks

    inspector = INSPECTOR.read_text(encoding='utf-8')
    assert 'getRailBadgeClass(capability.rail)' in inspector
    assert 'getRailLabel(capability.rail)' in inspector

    artifact_library = ARTIFACT_LIBRARY.read_text(encoding='utf-8')
    assert 'getRailBadgeClass(item.rail)' in artifact_library
    assert 'getRailLabel(item.rail)' in artifact_library


def test_visible_artifact_library_entries_use_known_rails() -> None:
    valid_rails = set(rail_meta())
    for include_hidden in (False, True):
        items = list_artifacts(include_hidden=include_hidden)
        bad = [(item['id'], item.get('rail')) for item in items if item.get('rail') is not None and item.get('rail') not in valid_rails]
        assert bad == []

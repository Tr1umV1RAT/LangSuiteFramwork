from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RUNTIME_EVENT = ROOT / 'client' / 'src' / 'runtimeEvent.ts'
STORE = ROOT / 'client' / 'src' / 'store.ts'
STORE_TYPES = ROOT / 'client' / 'src' / 'store' / 'types.ts'


def test_frontend_has_shared_runtime_event_projection_layer() -> None:
    text = RUNTIME_EVENT.read_text(encoding='utf-8')
    assert 'export interface RuntimeEventRecord' in text
    assert 'export function getRuntimeEvent' in text
    assert "schemaVersion: 'runtime_event_v1'" in text
    assert "schemaVersion: 'legacy_fallback'" in text


def test_store_prefers_runtime_event_projection_without_dropping_legacy_fallbacks() -> None:
    store = STORE.read_text(encoding='utf-8')
    types = STORE_TYPES.read_text(encoding='utf-8')
    assert "import { getRuntimeEvent } from './runtimeEvent';" in store
    assert 'const runtimeEvent = getRuntimeEvent(msg);' in store
    assert "truthSource: runtimeEvent?.schemaVersion === 'runtime_event_v1' ? 'runtime_event' : 'legacy'" in store
    assert 'runtimeSchemaVersion?: string | null;' in types
    assert "truthSource?: 'runtime_event' | 'legacy';" in types

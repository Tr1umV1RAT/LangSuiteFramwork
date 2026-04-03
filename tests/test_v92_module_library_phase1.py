from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.schemas import RuntimeSettings

TYPES = ROOT / 'client' / 'src' / 'store' / 'types.ts'
WORKSPACE = ROOT / 'client' / 'src' / 'store' / 'workspace.ts'
STATE_PANEL = ROOT / 'client' / 'src' / 'components' / 'StatePanelContent.tsx'


def test_runtime_settings_backend_accepts_module_library_phase1_fields() -> None:
    settings = RuntimeSettings(
        moduleLibrary=[
            {
                'id': 'module_world_rules',
                'name': 'World Rules',
                'category': 'world',
                'tags': ['rpg', 'demo'],
                'promptStrips': [
                    {'id': 'canon', 'name': 'Canon', 'body': 'Respect the canon.'},
                ],
                'subagentGroups': [
                    {'name': 'cast', 'agents': [{'name': 'gm', 'systemPrompt': 'Guide the table.', 'tools': []}]},
                ],
                'runtimeContext': [{'key': 'setting', 'value': 'low_fantasy'}],
            }
        ],
        loadedModuleIds=['module_world_rules'],
    )
    assert settings.moduleLibrary[0].name == 'World Rules'
    assert settings.moduleLibrary[0].promptStrips[0].id == 'canon'
    assert settings.loadedModuleIds == ['module_world_rules']


def test_workspace_sanitizes_and_applies_module_library_phase1_state() -> None:
    text = WORKSPACE.read_text(encoding='utf-8')
    assert 'sanitizeModuleLibrary' in text
    assert 'sanitizeLoadedModuleIds' in text
    assert 'applyModuleDefinitionToRuntimeSettings' in text
    assert 'buildModuleLibraryEntryFromRuntimeSettings' in text
    assert 'moduleLibrary: sanitizeModuleLibrary(settings?.moduleLibrary)' in text
    assert 'loadedModuleIds: sanitizeLoadedModuleIds(settings?.loadedModuleIds)' in text
    assert 'loadedModuleIds: Array.from(new Set([...(settings.loadedModuleIds || []), moduleEntry.id]))' in text


def test_runtime_settings_types_include_module_library_phase1_contract() -> None:
    text = TYPES.read_text(encoding='utf-8')
    assert 'export interface ModuleLibraryEntry' in text
    assert "export type ModuleLibraryCategory = 'world' | 'rules' | 'persona' | 'party' | 'utility' | 'mixed';" in text
    assert 'moduleLibrary: ModuleLibraryEntry[];' in text
    assert 'loadedModuleIds: string[];' in text


def test_state_panel_exposes_module_library_phase1_boundary_and_actions() -> None:
    text = STATE_PANEL.read_text(encoding='utf-8')
    assert 'data-testid="module-library-phase1"' in text
    assert 'bounded bundles' in text
    assert 'This is <strong>not yet</strong> a general plugin system, a separate runtime, or artifact/module publishing.' in text
    assert 'Charger dans le workspace' in text
    assert 'Recapturer depuis le workspace' in text
    assert 'Current load semantics stay explicit and non-destructive' in text

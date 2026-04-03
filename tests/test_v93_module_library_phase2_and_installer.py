from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.schemas import RuntimeSettings

TYPES = ROOT / 'client' / 'src' / 'store' / 'types.ts'
WORKSPACE = ROOT / 'client' / 'src' / 'store' / 'workspace.ts'
STATE_PANEL = ROOT / 'client' / 'src' / 'components' / 'StatePanelContent.tsx'
WINDOWS_QA = ROOT / 'tests' / 'windows_qa_sanity.py'


def _load_module(path: Path, module_name: str):
    spec = importlib.util.spec_from_file_location(module_name, path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_runtime_settings_backend_accepts_module_library_phase2_fields() -> None:
    settings = RuntimeSettings(
        moduleLibrary=[
            {
                'id': 'module_tabletop_demo',
                'name': 'Tabletop Demo',
                'category': 'world',
                'promptStrips': [
                    {'id': 'canon', 'name': 'Canon', 'body': 'Respect the canon.'},
                ],
                'promptAssignments': [
                    {'id': 'graph_default', 'stripId': 'canon', 'targetKind': 'graph', 'mergeMode': 'prepend', 'order': 0},
                    {'id': 'gm_default', 'stripId': 'canon', 'targetKind': 'subagent', 'groupName': 'cast', 'agentName': 'gm', 'mergeMode': 'append', 'order': 1},
                ],
                'subagentGroups': [
                    {'name': 'cast', 'agents': [{'name': 'gm', 'systemPrompt': 'Guide the table.', 'tools': []}]},
                ],
                'starterArtifacts': [
                    {'artifactId': 'tabletop_scene_starter', 'artifactKind': 'graph', 'label': 'Scene Starter', 'description': 'Cold open scene'},
                ],
                'runtimeContext': [{'key': 'setting', 'value': 'low_fantasy'}],
            }
        ],
        loadedModuleIds=['module_tabletop_demo'],
    )
    entry = settings.moduleLibrary[0]
    assert entry.promptAssignments[0].targetKind == 'graph'
    assert entry.promptAssignments[1].groupName == 'cast'
    assert entry.starterArtifacts[0].artifactId == 'tabletop_scene_starter'
    assert settings.loadedModuleIds == ['module_tabletop_demo']


def test_workspace_phase2_module_helpers_cover_prompt_presets_and_starter_refs() -> None:
    text = WORKSPACE.read_text(encoding='utf-8')
    assert 'sanitizeModulePromptAssignments' in text
    assert 'sanitizeModuleStarterArtifactRefs' in text
    assert 'collectModulePromptAssignmentsFromRuntime' in text
    assert 'mergePromptAssignmentsFromModule' in text
    assert 'promptAssignments: sanitizeModulePromptAssignments(data.promptAssignments)' in text
    assert 'starterArtifacts: sanitizeModuleStarterArtifactRefs(data.starterArtifacts)' in text
    assert 'promptStripAssignments: mergePromptAssignmentsFromModule(settings.promptStripAssignments || [], moduleEntry, options.tabId)' in text
    assert 'collectModulePromptAssignmentsFromRuntime(settings, options.tabId)' in text


def test_runtime_settings_types_include_module_library_phase2_contract() -> None:
    text = TYPES.read_text(encoding='utf-8')
    assert 'export interface ModulePromptAssignmentPreset' in text
    assert "targetKind: 'graph' | 'subagent';" in text
    assert 'export interface ModuleStarterArtifactRef' in text
    assert 'promptAssignments: ModulePromptAssignmentPreset[];' in text
    assert 'starterArtifacts: ModuleStarterArtifactRef[];' in text


def test_state_panel_exposes_module_library_phase2_boundary_and_actions() -> None:
    text = STATE_PANEL.read_text(encoding='utf-8')
    assert 'data-testid="module-library-phase1"' in text
    assert 'starter references' in text
    assert 'graph/subagent prompt-assignment presets' in text
    assert 'Starter references are descriptive only in phase 2' in text
    assert 'node-target presets remain outside this phase' in text
    assert 'Ajouter un starter ref' in text
    assert 'applyModuleDefinitionToRuntimeSettings(activeTab.runtimeSettings, entry, { tabId: activeTab.id })' in text


def test_windows_installer_sanity_wrapper_still_passes() -> None:
    module = _load_module(WINDOWS_QA, 'windows_qa_sanity_v93')
    module.run()

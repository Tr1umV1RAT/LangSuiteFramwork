from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TYPES = ROOT / 'client' / 'src' / 'store' / 'types.ts'
WORKSPACE = ROOT / 'client' / 'src' / 'store' / 'workspace.ts'
STATE_PANEL = ROOT / 'client' / 'src' / 'components' / 'StatePanelContent.tsx'
INSPECTOR = ROOT / 'client' / 'src' / 'components' / 'CapabilityInspectorSection.tsx'


def test_runtime_settings_now_persist_prompt_strip_assets_and_assignments() -> None:
    text = TYPES.read_text(encoding='utf-8')
    assert 'export interface PromptStripDefinition' in text
    assert 'export interface PromptStripAssignment' in text
    assert 'promptStripLibrary: PromptStripDefinition[];' in text
    assert 'promptStripAssignments: PromptStripAssignment[];' in text


def test_workspace_sanitizes_and_resolves_prompt_strip_phase1_data() -> None:
    text = WORKSPACE.read_text(encoding='utf-8')
    assert 'sanitizePromptStripLibrary' in text
    assert 'sanitizePromptStripAssignments' in text
    assert 'extractPromptStripVariables' in text
    assert 'resolvePromptStripsForTarget' in text
    assert 'isPromptCapableNodeType' in text
    assert "promptStripLibrary: sanitizePromptStripLibrary(settings?.promptStripLibrary)" in text
    assert "promptStripAssignments: sanitizePromptStripAssignments(settings?.promptStripAssignments)" in text


def test_state_panel_exposes_prompt_strip_library_targets_and_preview() -> None:
    text = STATE_PANEL.read_text(encoding='utf-8')
    assert 'data-testid="prompt-strip-library-phase1"' in text
    assert 'Phase 2 now resolves graph defaults plus node/subagent-local prompt strips' in text
    assert 'Artifact publishing and broader prompt-surface propagation are <strong>not yet active</strong>' in text
    assert 'Créer depuis le nœud sélectionné' in text
    assert 'Selected node (' in text
    assert 'Prompt strips ·' in text
    assert 'data-testid="prompt-strip-preview"' in text


def test_capability_inspector_reports_prompt_strip_phase1_status_for_nodes() -> None:
    text = INSPECTOR.read_text(encoding='utf-8')
    assert 'data-testid="prompt-strip-node-summary"' in text
    assert 'Prompt strips:' in text
    assert 'available in the state panel' in text
    assert 'Phase 2 resolves graph defaults plus node-local prompt strips before compile/runtime' in text

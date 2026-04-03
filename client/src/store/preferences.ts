import type { PalettePreset, Preferences, RunPanelTab, WorkspacePreset, EditorMode } from './types';

export const PREFERENCES_STORAGE_KEY = 'langgraph-builder-preferences-v2';
export const EDITOR_MODE_STORAGE_KEY = 'langgraph-builder-editor-mode';
const PALETTE_PRESET_VALUES: readonly PalettePreset[] = ['minimal', 'graph', 'memory_rag', 'debug', 'advanced'];
const RUN_PANEL_TAB_VALUES: readonly RunPanelTab[] = ['inputs', 'execution', 'json'];

export function defaultPreferences(): Preferences {
  return {
    defaultEditorMode: 'simple',
    autosaveEnabled: true,
    confirmBeforeCloseUnsavedWork: true,
    showMinimap: true,
    snapToGrid: false,
    uiDensity: 'compact',
    showQuickStart: true,
    showIncompatibleBlocks: false,
    compactPalette: false,
    paletteMode: 'quickstart',
    palettePreset: 'graph',
    defaultRunPanelTab: 'inputs',
    showJsonTab: true,
    autoScrollLogs: true,
    deEmphasizeJsonInSimpleMode: true,
    reducedTechnicalBadgesInSimpleMode: true,
    showArtifactBadgesInSimpleMode: false,
    showScopePathInSimpleMode: false,
    blocksPanelWidth: 196,
    debugPanelWidth: 184,
    statePanelWidth: 208,
    runPanelHeightPercent: 30,
  };
}

function clampPreferenceNumber(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

export function sanitizePreferences(preferences: Partial<Preferences> | null | undefined): Preferences {
  const defaults = defaultPreferences();
  return {
    defaultEditorMode: preferences?.defaultEditorMode === 'advanced' ? 'advanced' : defaults.defaultEditorMode,
    autosaveEnabled: preferences?.autosaveEnabled !== false,
    confirmBeforeCloseUnsavedWork: preferences?.confirmBeforeCloseUnsavedWork !== false,
    showMinimap: preferences?.showMinimap !== false,
    snapToGrid: preferences?.snapToGrid === true,
    uiDensity: preferences?.uiDensity === 'compact' || preferences?.uiDensity === 'comfortable' ? preferences.uiDensity : defaults.uiDensity,
    showQuickStart: preferences?.showQuickStart !== false,
    showIncompatibleBlocks: preferences?.showIncompatibleBlocks === true,
    compactPalette: preferences?.compactPalette === true,
    paletteMode: preferences?.paletteMode === 'all' ? 'all' : preferences?.paletteMode === 'common' ? 'common' : preferences?.paletteMode === 'quickstart' ? 'quickstart' : defaults.paletteMode,
    palettePreset: preferences?.palettePreset && PALETTE_PRESET_VALUES.includes(preferences.palettePreset) ? preferences.palettePreset : defaults.palettePreset,
    defaultRunPanelTab: preferences?.defaultRunPanelTab && RUN_PANEL_TAB_VALUES.includes(preferences.defaultRunPanelTab) ? preferences.defaultRunPanelTab : defaults.defaultRunPanelTab,
    showJsonTab: preferences?.showJsonTab !== false,
    autoScrollLogs: preferences?.autoScrollLogs !== false,
    deEmphasizeJsonInSimpleMode: preferences?.deEmphasizeJsonInSimpleMode !== false,
    reducedTechnicalBadgesInSimpleMode: preferences?.reducedTechnicalBadgesInSimpleMode !== false,
    showArtifactBadgesInSimpleMode: preferences?.showArtifactBadgesInSimpleMode === true,
    showScopePathInSimpleMode: preferences?.showScopePathInSimpleMode === true,
    blocksPanelWidth: clampPreferenceNumber(preferences?.blocksPanelWidth, 168, 360, defaults.blocksPanelWidth),
    debugPanelWidth: clampPreferenceNumber(preferences?.debugPanelWidth, 168, 340, defaults.debugPanelWidth),
    statePanelWidth: clampPreferenceNumber(preferences?.statePanelWidth, 188, 360, defaults.statePanelWidth),
    runPanelHeightPercent: clampPreferenceNumber(preferences?.runPanelHeightPercent, 24, 68, defaults.runPanelHeightPercent),
  };
}

export function getWorkspacePresetPatch(preset: WorkspacePreset): Partial<Preferences> {
  switch (preset) {
    case 'graph_memory':
      return {
        defaultEditorMode: 'simple',
        uiDensity: 'standard',
        showQuickStart: true,
        showIncompatibleBlocks: false,
        compactPalette: false,
        paletteMode: 'quickstart',
        palettePreset: 'memory_rag',
        defaultRunPanelTab: 'inputs',
        showJsonTab: true,
        autoScrollLogs: true,
        reducedTechnicalBadgesInSimpleMode: true,
        showArtifactBadgesInSimpleMode: false,
        showScopePathInSimpleMode: false,
        deEmphasizeJsonInSimpleMode: true,
        blocksPanelWidth: 196,
        debugPanelWidth: 184,
        statePanelWidth: 208,
        runPanelHeightPercent: 30,
      };
    case 'debug_build':
      return {
        defaultEditorMode: 'advanced',
        uiDensity: 'compact',
        showQuickStart: false,
        showIncompatibleBlocks: true,
        compactPalette: true,
        paletteMode: 'all',
        palettePreset: 'debug',
        defaultRunPanelTab: 'execution',
        showJsonTab: true,
        autoScrollLogs: true,
        reducedTechnicalBadgesInSimpleMode: false,
        showArtifactBadgesInSimpleMode: true,
        showScopePathInSimpleMode: true,
        deEmphasizeJsonInSimpleMode: false,
        blocksPanelWidth: 214,
        debugPanelWidth: 198,
        statePanelWidth: 222,
        runPanelHeightPercent: 34,
      };
    case 'advanced_authoring':
      return {
        defaultEditorMode: 'advanced',
        uiDensity: 'standard',
        showQuickStart: false,
        showIncompatibleBlocks: true,
        compactPalette: false,
        paletteMode: 'all',
        palettePreset: 'advanced',
        defaultRunPanelTab: 'execution',
        showJsonTab: true,
        autoScrollLogs: true,
        reducedTechnicalBadgesInSimpleMode: false,
        showArtifactBadgesInSimpleMode: true,
        showScopePathInSimpleMode: true,
        deEmphasizeJsonInSimpleMode: false,
        blocksPanelWidth: 218,
        debugPanelWidth: 202,
        statePanelWidth: 226,
        runPanelHeightPercent: 34,
      };
    case 'graph_simple':
    default:
      return {
        defaultEditorMode: 'simple',
        uiDensity: 'compact',
        showQuickStart: true,
        showIncompatibleBlocks: false,
        compactPalette: true,
        paletteMode: 'quickstart',
        palettePreset: 'graph',
        defaultRunPanelTab: 'inputs',
        showJsonTab: true,
        autoScrollLogs: true,
        reducedTechnicalBadgesInSimpleMode: true,
        showArtifactBadgesInSimpleMode: false,
        showScopePathInSimpleMode: false,
        deEmphasizeJsonInSimpleMode: true,
        blocksPanelWidth: 196,
        debugPanelWidth: 184,
        statePanelWidth: 208,
        runPanelHeightPercent: 30,
      };
  }
}

export function getInitialPreferences(): Preferences {
  try {
    const stored = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!stored) return defaultPreferences();
    return sanitizePreferences(JSON.parse(stored));
  } catch {
    return defaultPreferences();
  }
}

export function getInitialEditorMode(): EditorMode {
  try {
    const stored = window.localStorage.getItem(EDITOR_MODE_STORAGE_KEY);
    if (stored === 'advanced' || stored === 'simple') return stored;
  } catch {
    // ignore storage failures
  }
  return getInitialPreferences().defaultEditorMode;
}

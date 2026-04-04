import type { RuntimeSettings, ModuleLibraryEntry } from '../store/types';

export type TabletopThemeVariant = 'tabletop' | 'fantasy' | 'noir' | 'space';

export interface TabletopVisualProfile {
  isTabletop: boolean;
  variant: TabletopThemeVariant;
  shellClassName: string;
  badgeLabel: string;
  settingLabel: string | null;
  rulesLabel: string | null;
  toneLabel: string | null;
  hintLabels: string[];
}

function getLoadedModules(runtimeSettings?: RuntimeSettings | null): ModuleLibraryEntry[] {
  if (!runtimeSettings) return [];
  const ids = new Set(runtimeSettings.loadedModuleIds || []);
  return (runtimeSettings.moduleLibrary || []).filter((entry) => ids.has(entry.id));
}

function findContextValue(runtimeSettings: RuntimeSettings | null | undefined, key: string): string | null {
  const entry = (runtimeSettings?.runtimeContext || []).find((item) => item.key === key);
  return entry?.value || null;
}

function prettify(value: string | null): string | null {
  if (!value) return null;
  return value.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function findLoadedModule(loadedModules: ModuleLibraryEntry[], predicate: (entry: ModuleLibraryEntry) => boolean): ModuleLibraryEntry | null {
  return loadedModules.find(predicate) || null;
}

export function getTabletopVisualProfile(runtimeSettings?: RuntimeSettings | null): TabletopVisualProfile {
  const loadedModules = getLoadedModules(runtimeSettings);
  const themeHints = new Set(loadedModules.flatMap((entry) => entry.themeHints || []));
  const branchTargets = new Set(loadedModules.flatMap((entry) => entry.branchTargets || []));
  const recommendedProfiles = new Set(loadedModules.map((entry) => entry.recommendedProfile || '').filter(Boolean));
  const settingId = findContextValue(runtimeSettings, 'setting_id');
  const sessionKind = findContextValue(runtimeSettings, 'session_kind');
  const isTabletop = recommendedProfiles.has('tabletop_demo') || branchTargets.has('jdr_demo') || sessionKind === 'solo_jdr' || Boolean(settingId);

  const worldModule = findLoadedModule(loadedModules, (entry) => entry.category === 'world');
  const rulesModule = findLoadedModule(loadedModules, (entry) => entry.category === 'rules');
  const toneModule = findLoadedModule(loadedModules, (entry) => entry.category === 'utility' && entry.runtimeContext.some((item) => item.key === 'tone_mode'));

  let variant: TabletopThemeVariant = 'tabletop';
  if (themeHints.has('space') || settingId === 'space_outpost') variant = 'space';
  else if (themeHints.has('noir') || themeHints.has('intrigue') || settingId === 'occult_city' || settingId === 'corporate_arcology') variant = 'noir';
  else if (themeHints.has('fantasy') || themeHints.has('ruin') || settingId === 'frontier_fantasy' || settingId === 'ruined_coast') variant = 'fantasy';

  return {
    isTabletop,
    variant,
    shellClassName: isTabletop ? `jdr-shell jdr-variant-${variant}` : '',
    badgeLabel: variant === 'space' ? 'TTRPG · Space' : variant === 'noir' ? 'TTRPG · Noir' : variant === 'fantasy' ? 'TTRPG · Fantasy' : 'TTRPG',
    settingLabel: worldModule?.name || prettify(settingId),
    rulesLabel: rulesModule?.name || prettify(findContextValue(runtimeSettings, 'rules_mode')),
    toneLabel: toneModule?.name || prettify(findContextValue(runtimeSettings, 'tone_mode')),
    hintLabels: Array.from(themeHints).slice(0, 4),
  };
}

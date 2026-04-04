import type { Edge, Node } from '@xyflow/react';
import type { RuntimeSettings, ModuleLibraryEntry, SubagentDefinition } from './types';
import { applyModuleDefinitionToRuntimeSettings, sanitizeRuntimeSettings } from './workspace';
import { getProviderMeta, normalizeProvider } from '../providerContracts';

export type TabletopSettingId = 'frontier_fantasy' | 'occult_city' | 'space_outpost' | 'ruined_coast' | 'corporate_arcology';
export type TabletopCastId = 'roadside_cast' | 'investigator_contacts' | 'station_crew' | 'relic_hunters' | 'response_team';
export type TabletopRulesId = 'light_narrative' | 'dice_forward' | 'fiction_first_pressure' | 'hard_choice_clocks';
export type TabletopToneId = 'adventurous_grounded' | 'mystery_pressure' | 'grim_consequences' | 'hopeful_resistance' | 'paranoid_intrigue';

export interface TabletopProviderSelection {
  provider: string;
  modelName: string;
  apiKeyEnv: string;
  apiBaseUrl: string;
}

export interface TabletopStarterSelection {
  settingId: TabletopSettingId;
  castId: TabletopCastId;
  rulesId: TabletopRulesId;
  toneId: TabletopToneId;
}

export interface TabletopOption<T extends string> {
  id: T;
  label: string;
  description: string;
  moduleId: string;
}

export interface TabletopCatalog {
  settings: TabletopOption<TabletopSettingId>[];
  casts: TabletopOption<TabletopCastId>[];
  rules: TabletopOption<TabletopRulesId>[];
  tones: TabletopOption<TabletopToneId>[];
}

type ArtifactPayload = {
  name?: string;
  runtimeSettings?: Partial<RuntimeSettings>;
};

const DEFAULT_PROVIDER_MODELS: Record<string, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-sonnet-latest',
  google_genai: 'gemini-2.0-flash',
  lm_studio: 'local-model',
  openai_compat: 'local-model',
  ollama: 'local-model',
};

const PROVIDER_BACKED_NODE_TYPES = new Set(['llm_chat', 'tool_sub_agent', 'tool_llm_worker', 'react_agent']);
const CAST_TOOL_IDS = ['tool_sub_agent_cast_1', 'tool_sub_agent_cast_2', 'tool_sub_agent_cast_3'] as const;

const DEFAULT_TABLETOP_CATALOG: TabletopCatalog = {
  settings: [
    {
      id: 'frontier_fantasy',
      label: 'Frontier fantasy',
      description: 'Roadside pressure, travel risks, and approachable fantasy play.',
      moduleId: 'module_jdr_world_frontier_fantasy',
    },
    {
      id: 'occult_city',
      label: 'Occult city',
      description: 'Clues, factions, institutions, and ritual danger under public normalcy.',
      moduleId: 'module_jdr_world_occult_city',
    },
    {
      id: 'space_outpost',
      label: 'Space outpost',
      description: 'Remote infrastructure, operational pressure, and survival-led mystery.',
      moduleId: 'module_jdr_world_space_outpost',
    },
    {
      id: 'ruined_coast',
      label: 'Ruined coast',
      description: 'Storm-worn ports, wreck salvage, and exposed ruins along a dangerous littoral.',
      moduleId: 'module_jdr_world_ruined_coast',
    },
    {
      id: 'corporate_arcology',
      label: 'Corporate arcology',
      description: 'Vertical districts, surveillance, labor pressure, and hidden resistance cells.',
      moduleId: 'module_jdr_world_corporate_arcology',
    },
  ],
  casts: [
    {
      id: 'roadside_cast',
      label: 'Roadside cast',
      description: 'Innkeeper, scout, and guard for a grounded opening scene.',
      moduleId: 'module_jdr_party_roadside_cast',
    },
    {
      id: 'investigator_contacts',
      label: 'Investigator contacts',
      description: 'Fixer, librarian, and inspector for clue-first social play.',
      moduleId: 'module_jdr_party_investigator_contacts',
    },
    {
      id: 'station_crew',
      label: 'Station crew',
      description: 'Quartermaster, pilot, and security chief for operational sci-fi scenes.',
      moduleId: 'module_jdr_party_station_crew',
    },
    {
      id: 'relic_hunters',
      label: 'Relic hunters',
      description: 'Broker, outrider, and occultist for salvage, ruins, and hidden cost.',
      moduleId: 'module_jdr_party_relic_hunters',
    },
    {
      id: 'response_team',
      label: 'Response team',
      description: 'Medic, engineer, and marshal for breach control and procedural pressure.',
      moduleId: 'module_jdr_party_response_team',
    },
  ],
  rules: [
    {
      id: 'light_narrative',
      label: 'Light narrative',
      description: 'Prompt-led play with bounded adjudication and minimal friction.',
      moduleId: 'module_jdr_rules_light_narrative',
    },
    {
      id: 'dice_forward',
      label: 'Dice-forward',
      description: 'Explicit checks, stakes, difficulty, and consequence framing.',
      moduleId: 'module_jdr_rules_dice_forward',
    },
    {
      id: 'fiction_first_pressure',
      label: 'Fiction-first pressure',
      description: 'Position, leverage, and fallout come from the fiction before explicit rolls.',
      moduleId: 'module_jdr_rules_fiction_first_pressure',
    },
    {
      id: 'hard_choice_clocks',
      label: 'Hard-choice clocks',
      description: 'Use visible clocks, escalating pressure, and tradeoffs instead of flat outcomes.',
      moduleId: 'module_jdr_rules_hard_choice_clocks',
    },
  ],
  tones: [
    {
      id: 'adventurous_grounded',
      label: 'Adventurous',
      description: 'Forward motion, momentum, and meaningful but fair setbacks.',
      moduleId: 'module_jdr_tone_adventure_with_consequence',
    },
    {
      id: 'mystery_pressure',
      label: 'Mystery',
      description: 'Clues, suspicion, and pressure that compounds scene by scene.',
      moduleId: 'module_jdr_tone_mystery_pressure',
    },
    {
      id: 'grim_consequences',
      label: 'Grim',
      description: 'Attrition, scarcity, and visible tradeoffs under pressure.',
      moduleId: 'module_jdr_tone_grim_consequences',
    },
    {
      id: 'hopeful_resistance',
      label: 'Hopeful resistance',
      description: 'Pressure is real, but solidarity and earned openings still matter.',
      moduleId: 'module_jdr_tone_hopeful_resistance',
    },
    {
      id: 'paranoid_intrigue',
      label: 'Paranoid intrigue',
      description: 'Surveillance, compromised loyalties, and risky alliances drive the scenes.',
      moduleId: 'module_jdr_tone_paranoid_intrigue',
    },
  ],
};

export const TABLETOP_SETTING_OPTIONS = DEFAULT_TABLETOP_CATALOG.settings;
export const TABLETOP_CAST_OPTIONS = DEFAULT_TABLETOP_CATALOG.casts;
export const TABLETOP_RULES_OPTIONS = DEFAULT_TABLETOP_CATALOG.rules;
export const TABLETOP_TONE_OPTIONS = DEFAULT_TABLETOP_CATALOG.tones;

export function getDefaultTabletopCatalog(): TabletopCatalog {
  return JSON.parse(JSON.stringify(DEFAULT_TABLETOP_CATALOG)) as TabletopCatalog;
}

function deepCloneNode<T extends Node | Edge>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function readRuntimeContextValue(entry: Pick<ModuleLibraryEntry, 'runtimeContext'> | null | undefined, key: string): string | null {
  const item = (entry?.runtimeContext || []).find((candidate) => candidate.key === key);
  return item?.value || null;
}

function includesJdrBranch(entry: ModuleLibraryEntry): boolean {
  const targets = entry.branchTargets || [];
  return targets.length === 0 || targets.includes('jdr_demo') || targets.includes('main');
}

function sortOptions<T extends string>(options: TabletopOption<T>[]): TabletopOption<T>[] {
  return [...options].sort((a, b) => a.label.localeCompare(b.label));
}

function buildOptionFromModule<T extends string>(entry: ModuleLibraryEntry, category: keyof TabletopCatalog): TabletopOption<T> | null {
  if (!includesJdrBranch(entry)) return null;
  let id: string | null = null;
  if (category === 'settings') id = readRuntimeContextValue(entry, 'setting_id');
  if (category === 'rules') id = readRuntimeContextValue(entry, 'rules_mode');
  if (category === 'tones') id = readRuntimeContextValue(entry, 'tone_mode');
  if (category === 'casts') id = entry.subagentGroups?.[0]?.name || null;
  if (!id) return null;
  return {
    id: id as T,
    label: entry.name,
    description: entry.description || entry.compatibilityNotes || 'Branch overlay module',
    moduleId: entry.id,
  };
}

export function buildTabletopCatalogFromRuntimeSettings(runtimeSettings?: Partial<RuntimeSettings> | null): TabletopCatalog {
  const fallback = getDefaultTabletopCatalog();
  const moduleLibrary = Array.isArray(runtimeSettings?.moduleLibrary) ? runtimeSettings.moduleLibrary : [];

  const settings = sortOptions(moduleLibrary.filter((entry) => entry.category === 'world').map((entry) => buildOptionFromModule<TabletopSettingId>(entry, 'settings')).filter((entry): entry is TabletopOption<TabletopSettingId> => Boolean(entry)));
  const casts = sortOptions(moduleLibrary.filter((entry) => entry.category === 'party').map((entry) => buildOptionFromModule<TabletopCastId>(entry, 'casts')).filter((entry): entry is TabletopOption<TabletopCastId> => Boolean(entry)));
  const rules = sortOptions(moduleLibrary.filter((entry) => entry.category === 'rules').map((entry) => buildOptionFromModule<TabletopRulesId>(entry, 'rules')).filter((entry): entry is TabletopOption<TabletopRulesId> => Boolean(entry)));
  const tones = sortOptions(moduleLibrary.filter((entry) => entry.category === 'utility' && Boolean(readRuntimeContextValue(entry, 'tone_mode'))).map((entry) => buildOptionFromModule<TabletopToneId>(entry, 'tones')).filter((entry): entry is TabletopOption<TabletopToneId> => Boolean(entry)));

  return {
    settings: settings.length ? settings : fallback.settings,
    casts: casts.length ? casts : fallback.casts,
    rules: rules.length ? rules : fallback.rules,
    tones: tones.length ? tones : fallback.tones,
  };
}

function getModuleById(moduleLibrary: ModuleLibraryEntry[], moduleId: string): ModuleLibraryEntry {
  const entry = moduleLibrary.find((item) => item.id === moduleId);
  if (!entry) throw new Error(`Missing tabletop module '${moduleId}'.`);
  return entry;
}

function resolveModuleIdForSelection(moduleLibrary: ModuleLibraryEntry[], category: keyof TabletopCatalog, selectionId: string): string {
  const catalog = buildTabletopCatalogFromRuntimeSettings({ moduleLibrary } as Partial<RuntimeSettings>);
  const matched = catalog[category].find((item) => item.id === selectionId);
  if (matched) return matched.moduleId;
  const fallback = getDefaultTabletopCatalog()[category].find((item) => item.id === selectionId);
  if (fallback) return fallback.moduleId;
  throw new Error(`No module mapping found for tabletop ${category} '${selectionId}'.`);
}

function resetTabletopRuntimeSettings(base: RuntimeSettings): RuntimeSettings {
  const persistentContextKeys = new Set(['session_kind']);
  return sanitizeRuntimeSettings({
    ...base,
    loadedModuleIds: [],
    promptStripAssignments: [],
    subagentLibrary: [],
    runtimeContext: (base.runtimeContext || []).filter((entry) => persistentContextKeys.has(entry.key)),
  });
}

export function getDefaultTabletopProviderSelection(provider: string = 'openai'): TabletopProviderSelection {
  const normalized = normalizeProvider(provider) || 'openai';
  const meta = getProviderMeta(normalized);
  return {
    provider: normalized,
    modelName: DEFAULT_PROVIDER_MODELS[normalized] || DEFAULT_PROVIDER_MODELS.openai,
    apiKeyEnv: meta?.defaultApiKeyEnv || '',
    apiBaseUrl: meta?.defaultApiBaseUrl || '',
  };
}

export function getDefaultTabletopSelection(catalog?: TabletopCatalog): TabletopStarterSelection {
  const resolved = catalog || getDefaultTabletopCatalog();
  const pick = <T extends string>(options: TabletopOption<T>[], preferred: T): T => options.find((item) => item.id === preferred)?.id || options[0]?.id || preferred;
  return {
    settingId: pick(resolved.settings, 'frontier_fantasy'),
    castId: pick(resolved.casts, 'roadside_cast'),
    rulesId: pick(resolved.rules, 'light_narrative'),
    toneId: pick(resolved.tones, 'adventurous_grounded'),
  };
}

function buildSelectedRuntimeSettings(base: RuntimeSettings, selection: TabletopStarterSelection): RuntimeSettings {
  const moduleIds = [
    resolveModuleIdForSelection(base.moduleLibrary || [], 'settings', selection.settingId),
    resolveModuleIdForSelection(base.moduleLibrary || [], 'rules', selection.rulesId),
    'module_jdr_persona_gm_fair_guide',
    resolveModuleIdForSelection(base.moduleLibrary || [], 'tones', selection.toneId),
    resolveModuleIdForSelection(base.moduleLibrary || [], 'casts', selection.castId),
    'module_jdr_utility_structured_referee',
  ].filter((item): item is string => Boolean(item));

  return moduleIds.reduce((acc, moduleId) => {
    const entry = getModuleById(base.moduleLibrary || [], moduleId);
    return applyModuleDefinitionToRuntimeSettings(acc, entry, { tabId: 'starter_tab' });
  }, resetTabletopRuntimeSettings(base));
}

function updateNodeParams(node: Node, patch: Record<string, unknown>): Node {
  return {
    ...node,
    data: {
      ...(node.data as Record<string, unknown>),
      params: {
        ...(((node.data as Record<string, unknown>)?.params as Record<string, unknown>) || {}),
        ...patch,
      },
    },
  };
}

function removeRuntimeProviderConfigFromNode(node: Node): Node {
  const data = (node.data as Record<string, unknown>) || {};
  const params = { ...(((data.params as Record<string, unknown>) || {})) };
  delete params.provider;
  delete params.model_name;
  delete params.api_key_env;
  delete params.api_base_url;
  return {
    ...node,
    data: {
      ...data,
      params,
    },
  };
}

function updateNodeLabel(node: Node, label: string, description?: string): Node {
  const currentParams = (((node.data as Record<string, unknown>)?.params as Record<string, unknown>) || {});
  return {
    ...node,
    data: {
      ...(node.data as Record<string, unknown>),
      label,
      params: description ? { ...currentParams, description } : currentParams,
    },
  };
}

function applyRuntimeProviderConfig(nodes: Node[], selection: TabletopProviderSelection): Node[] {
  return nodes.map((node) => {
    const nodeType = String((node.data as Record<string, unknown>)?.nodeType || '');
    if (!PROVIDER_BACKED_NODE_TYPES.has(nodeType)) return node;
    return updateNodeParams(node, {
      provider: selection.provider,
      model_name: selection.modelName,
      api_key_env: selection.apiKeyEnv,
      api_base_url: selection.apiBaseUrl,
    });
  });
}

export function stripRuntimeProviderConfig(nodes: Node[]): Node[] {
  return nodes.map((node) => {
    const nodeType = String((node.data as Record<string, unknown>)?.nodeType || '');
    return PROVIDER_BACKED_NODE_TYPES.has(nodeType) ? removeRuntimeProviderConfigFromNode(node) : node;
  });
}

export function isTabletopRuntimeConfigNeeded(nodes: Node[]): boolean {
  return nodes.some((node) => {
    const nodeType = String((node.data as Record<string, unknown>)?.nodeType || '');
    if (!PROVIDER_BACKED_NODE_TYPES.has(nodeType)) return false;
    const params = (((node.data as Record<string, unknown>)?.params as Record<string, unknown>) || {});
    return !String(params.provider || '').trim();
  });
}

export function withTabletopRuntimeProviderConfig(nodes: Node[], selection: TabletopProviderSelection): Node[] {
  return applyRuntimeProviderConfig(nodes, selection);
}

function prettifyValue(value: string): string {
  return value.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function titleizeAgent(agent: SubagentDefinition): string {
  return prettifyValue(agent.name);
}

function buildCastToolConfig(moduleLibrary: ModuleLibraryEntry[], castId: TabletopCastId): Array<{ toolId: string; groupName: string; agentName: string; label: string; description: string }> {
  const moduleId = resolveModuleIdForSelection(moduleLibrary, 'casts', castId);
  const moduleEntry = getModuleById(moduleLibrary, moduleId);
  const group = moduleEntry.subagentGroups?.[0];
  if (!group) return [];
  return CAST_TOOL_IDS.map((toolId, index) => {
    const agent = group.agents[index];
    if (!agent) {
      return {
        toolId,
        groupName: group.name,
        agentName: `agent_${index + 1}`,
        label: `Cast Advisor · ${index + 1}`,
        description: 'Cast advisor slot preserved for branch-compatible module packs.',
      };
    }
    return {
      toolId,
      groupName: group.name,
      agentName: agent.name,
      label: `Cast Advisor · ${titleizeAgent(agent)}`,
      description: agent.description || `${titleizeAgent(agent)} advisor`,
    };
  });
}

function applyCastToNodes(nodes: Node[], moduleLibrary: ModuleLibraryEntry[], castId: TabletopCastId): Node[] {
  const config = buildCastToolConfig(moduleLibrary, castId);
  return nodes.map((node) => {
    const toolConfig = config.find((entry) => entry.toolId === node.id);
    if (!toolConfig) return node;
    const withParams = updateNodeParams(node, {
      target_group: toolConfig.groupName,
      target_agent: toolConfig.agentName,
      description: toolConfig.description,
    });
    return updateNodeLabel(withParams, toolConfig.label, toolConfig.description);
  });
}

function getPrimaryPromptBody(entry: ModuleLibraryEntry | null | undefined): string {
  return entry?.promptStrips?.[0]?.body || entry?.description || entry?.name || 'No additional module guidance supplied.';
}

function applyRulesRefereeToNodes(nodes: Node[], moduleLibrary: ModuleLibraryEntry[], selection: TabletopStarterSelection): Node[] {
  const rulesEntry = getModuleById(moduleLibrary, resolveModuleIdForSelection(moduleLibrary, 'rules', selection.rulesId));
  const toneEntry = getModuleById(moduleLibrary, resolveModuleIdForSelection(moduleLibrary, 'tones', selection.toneId));
  const prompt = [
    'You are a structured tabletop rules referee. Use the active branch-overlay packs below as bounded context. Support the GM with concise rulings only; do not narrate scenes.',
    `Rules pack (${rulesEntry.name}): ${getPrimaryPromptBody(rulesEntry)}`,
    `Tone pack (${toneEntry.name}): ${getPrimaryPromptBody(toneEntry)}`,
    'Return compact adjudication with: intent, likely check, stakes, consequence, and next state.',
  ].join('\n\n');
  const description = `Structured rules advisor using ${rulesEntry.name.toLowerCase()} with ${toneEntry.name.toLowerCase()}.`;
  return nodes.map((node) => {
    if (node.id !== 'tool_llm_worker_rules_referee_1') return node;
    const withParams = updateNodeParams(node, {
      system_prompt: prompt,
      description,
      temperature: selection.rulesId === 'light_narrative' ? 0.1 : selection.rulesId === 'dice_forward' ? 0.05 : 0.08,
    });
    return updateNodeLabel(withParams, 'Structured Rules Referee', description);
  });
}

function buildSessionTitle(moduleLibrary: ModuleLibraryEntry[], selection: TabletopStarterSelection): string {
  const settingEntry = getModuleById(moduleLibrary, resolveModuleIdForSelection(moduleLibrary, 'settings', selection.settingId));
  const toneEntry = getModuleById(moduleLibrary, resolveModuleIdForSelection(moduleLibrary, 'tones', selection.toneId));
  return `Tabletop · ${settingEntry.name} · ${toneEntry.name}`;
}

export function buildGuidedTabletopStarter(artifact: ArtifactPayload, nodes: Node[], edges: Edge[], selection: TabletopStarterSelection) {
  const baseRuntime = sanitizeRuntimeSettings(artifact.runtimeSettings || {}, 'langgraph');
  const runtimeSettings = buildSelectedRuntimeSettings(baseRuntime, selection);
  const clonedNodes = nodes.map((node) => deepCloneNode(node));
  const clonedEdges = edges.map((edge) => deepCloneNode(edge));
  const providerNeutralNodes = stripRuntimeProviderConfig(clonedNodes);
  const castApplied = applyCastToNodes(providerNeutralNodes, baseRuntime.moduleLibrary || [], selection.castId);
  const finalNodes = applyRulesRefereeToNodes(castApplied, baseRuntime.moduleLibrary || [], selection);

  return {
    name: buildSessionTitle(baseRuntime.moduleLibrary || [], selection),
    nodes: finalNodes,
    edges: clonedEdges,
    runtimeSettings,
  };
}

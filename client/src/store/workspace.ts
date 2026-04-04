import type { Edge, Node } from '@xyflow/react';
import {
  type ArtifactType,
  type ExecutionProfile,
  type GraphScopeKind,
  type ProjectMode,
  getModeContract,
  normalizeVisibleArtifactType,
  normalizeVisibleExecutionProfile,
  normalizeWorkspaceArtifactType,
  normalizeWorkspaceExecutionProfile,
  getDefaultExecutionProfileForArtifact,
  getDefaultSurfaceForProjectMode,
  normalizeProjectMode,
  projectModeAllowsCompile,
  projectModeAllowsRuntime,
} from '../capabilities';
import type { GraphBinding, ImportDiagnostic, ModuleLibraryCategory, ModuleLibraryEntry, ModuleLibraryLineage, ModulePromptAssignmentPreset, ModuleStarterArtifactRef, PromptAssignmentTarget, PromptStripAssignment, PromptStripDefinition, PromptStripMergeMode, PromptStripVariableDefinition, RuntimeSettings, SerializedWorkspaceTab, SurfaceTruthSummary, Tab, WorkspaceTreeSnapshot, SubagentDefinition, SubagentGroupDefinition, SceneSeed, EncounterSeed, LocationSeed, ClockSeed, FactionSeed, HookSeed, HookTarget, FactionPresence, ModuleSlotProvision, RuntimeSlotBinding, ModuleSlotName, ModuleSlotEntityType, ModuleSlotPolicy, ModuleSeedMergePolicy, SubagentRef } from './types';

export { normalizeVisibleArtifactType, normalizeVisibleExecutionProfile, normalizeWorkspaceArtifactType, normalizeWorkspaceExecutionProfile };

export function defaultExecutionProfile(isAsync: boolean, artifactType: ArtifactType = 'graph'): ExecutionProfile {
  if (artifactType === 'graph' || artifactType === 'subgraph') {
    return isAsync ? 'langgraph_async' : 'langgraph_sync';
  }
  return getDefaultExecutionProfileForArtifact(artifactType);
}

function sanitizeSubagentName(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function sanitizeSubagentDefinition(raw: unknown, index: number): SubagentDefinition | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const name = sanitizeSubagentName(data.name, `subagent_${index + 1}`);
  const tools = Array.isArray(data.tools) ? data.tools.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim()) : [];
  return {
    name,
    systemPrompt: typeof data.systemPrompt === 'string' ? data.systemPrompt : '',
    tools,
    description: typeof data.description === 'string' ? data.description : '',
  };
}

function sanitizeSubagentLibrary(raw: unknown): SubagentGroupDefinition[] {
  if (!Array.isArray(raw)) return [];
  const groups: SubagentGroupDefinition[] = [];
  for (const [groupIndex, groupRaw] of raw.entries()) {
    if (!groupRaw || typeof groupRaw !== 'object') continue;
    const data = groupRaw as Record<string, unknown>;
    const name = sanitizeSubagentName(data.name, groupIndex === 0 ? 'default' : `group_${groupIndex + 1}`);
    const rawAgents = Array.isArray(data.agents) ? data.agents : [];
    const agents = rawAgents.map((agentRaw, agentIndex) => sanitizeSubagentDefinition(agentRaw, agentIndex)).filter((item): item is SubagentDefinition => Boolean(item));
    groups.push({ name, agents });
  }
  return groups;
}

const PROMPT_STRIP_VARIABLE_RE = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;

function slugifyPromptPart(value: string, fallback: string): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
  return cleaned || fallback;
}

function sanitizePromptStripVariable(raw: unknown, index: number): PromptStripVariableDefinition | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const fallback = `var_${index + 1}`;
  const name = typeof data.name === 'string' ? slugifyPromptPart(data.name, fallback) : fallback;
  return {
    name,
    required: data.required !== false,
    defaultValue: typeof data.defaultValue === 'string' ? data.defaultValue : '',
  };
}

export function extractPromptStripVariables(body: string): PromptStripVariableDefinition[] {
  const found = new Map<string, PromptStripVariableDefinition>();
  const source = typeof body === 'string' ? body : '';
  for (const match of source.matchAll(PROMPT_STRIP_VARIABLE_RE)) {
    const name = slugifyPromptPart(match[1] || '', 'variable');
    if (!found.has(name)) {
      found.set(name, { name, required: true, defaultValue: '' });
    }
  }
  return Array.from(found.values());
}

function sanitizePromptStripDefinition(raw: unknown, index: number): PromptStripDefinition | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const body = typeof data.body === 'string' ? data.body : '';
  const fallbackId = `prompt_strip_${index + 1}`;
  const fallbackName = index === 0 ? 'Default Prompt Strip' : `Prompt Strip ${index + 1}`;
  const explicitVariables = Array.isArray(data.variables)
    ? data.variables.map((item, variableIndex) => sanitizePromptStripVariable(item, variableIndex)).filter((item): item is PromptStripVariableDefinition => Boolean(item))
    : [];
  const inferredVariables = extractPromptStripVariables(body);
  const variableMap = new Map<string, PromptStripVariableDefinition>();
  [...explicitVariables, ...inferredVariables].forEach((item) => {
    if (!variableMap.has(item.name)) variableMap.set(item.name, item);
  });
  const tags = Array.isArray(data.tags)
    ? Array.from(new Set(data.tags.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)))
    : [];
  return {
    id: typeof data.id === 'string' && data.id.trim() ? data.id.trim() : fallbackId,
    name: typeof data.name === 'string' && data.name.trim() ? data.name.trim() : fallbackName,
    description: typeof data.description === 'string' ? data.description : '',
    body,
    tags,
    variables: Array.from(variableMap.values()),
    origin: data.origin === 'artifact' ? 'artifact' : 'workspace',
    artifactRef: typeof data.artifactRef === 'string' && data.artifactRef.trim() ? data.artifactRef.trim() : null,
  };
}

function sanitizePromptStripLibrary(raw: unknown): PromptStripDefinition[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const strips: PromptStripDefinition[] = [];
  raw.forEach((item, index) => {
    const sanitized = sanitizePromptStripDefinition(item, index);
    if (!sanitized) return;
    if (seen.has(sanitized.id)) return;
    seen.add(sanitized.id);
    strips.push(sanitized);
  });
  return strips;
}

function sanitizeRuntimeContextEntries(raw: unknown): { key: string; value: string }[] {
  return Array.isArray(raw)
    ? raw
        .filter((entry): entry is { key: string; value: string } => !!entry && typeof entry === 'object' && typeof (entry as any).key === 'string' && typeof (entry as any).value === 'string')
        .map((entry) => ({ key: entry.key.trim(), value: entry.value }))
        .filter((entry) => entry.key.length > 0)
    : [];
}

const MODULE_SLOT_NAME_RE = /^(opening_scene|default_location|starter_encounter|starter_clock|primary_cast|fallback_referee_frame)$/;
const MODULE_IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function sanitizeStringList(raw: unknown, pattern?: RegExp): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const cleaned: string[] = [];
  raw.forEach((item) => {
    const value = typeof item === 'string' ? item.trim() : '';
    if (!value) return;
    if (pattern && !pattern.test(value)) return;
    if (seen.has(value)) return;
    seen.add(value);
    cleaned.push(value);
  });
  return cleaned;
}

function sanitizeSeedMergePolicy(raw: unknown): ModuleSeedMergePolicy {
  return raw === 'preserve' || raw === 'replace' ? raw : 'error';
}

function sanitizeSeedStatus(raw: unknown): 'seeded' | 'active' | 'resolved' {
  return raw === 'active' || raw === 'resolved' ? raw : 'seeded';
}

function sanitizeModuleSlotName(raw: unknown): ModuleSlotName | null {
  return typeof raw === 'string' && MODULE_SLOT_NAME_RE.test(raw.trim()) ? raw.trim() as ModuleSlotName : null;
}

function sanitizeModuleSlotEntityType(raw: unknown): ModuleSlotEntityType | null {
  const value = typeof raw === 'string' ? raw.trim() : '';
  return value === 'scene' || value === 'encounter' || value === 'location' || value === 'clock' || value === 'cast_group' || value === 'faction' ? value : null;
}

function sanitizeModuleSlotPolicy(raw: unknown): ModuleSlotPolicy {
  return raw === 'append' || raw === 'replace' ? raw : 'exclusive';
}

function sanitizeSubagentRef(raw: unknown): SubagentRef | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const groupName = typeof data.groupName === 'string' ? data.groupName.trim() : '';
  const agentName = typeof data.agentName === 'string' ? data.agentName.trim() : '';
  if (!MODULE_IDENTIFIER_RE.test(groupName) || !MODULE_IDENTIFIER_RE.test(agentName)) return null;
  return { groupName, agentName };
}

function sanitizeStructuredSeedBase<T extends {
  id: string;
  title: string;
  description?: string;
  tags?: string[];
  mergePolicy?: ModuleSeedMergePolicy;
  origin?: 'workspace' | 'artifact';
  artifactRef?: string | null;
  sourceModuleId?: string;
}>(
  data: Record<string, unknown>,
  fallbackId: string,
  fallbackTitle: string,
) {
  const id = typeof data.id === 'string' && MODULE_IDENTIFIER_RE.test(data.id.trim()) ? data.id.trim() : fallbackId;
  const title = typeof data.title === 'string' && data.title.trim() ? data.title.trim() : fallbackTitle;
  const sourceModuleId = typeof data.sourceModuleId === 'string' && MODULE_IDENTIFIER_RE.test(data.sourceModuleId.trim())
    ? data.sourceModuleId.trim()
    : undefined;
  return {
    id,
    title,
    description: typeof data.description === 'string' ? data.description : '',
    tags: sanitizeStringList(data.tags),
    mergePolicy: sanitizeSeedMergePolicy(data.mergePolicy),
    origin: data.origin === 'artifact' ? 'artifact' as const : 'workspace' as const,
    artifactRef: typeof data.artifactRef === 'string' && data.artifactRef.trim() ? data.artifactRef.trim() : null,
    sourceModuleId,
  };
}

function sanitizeSceneSeed(raw: unknown, index: number): SceneSeed | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const base = sanitizeStructuredSeedBase(data, `scene_${index + 1}`, `Scene ${index + 1}`);
  const kind = data.kind === 'travel' || data.kind === 'social' || data.kind === 'investigation' || data.kind === 'combat' || data.kind === 'fallback' ? data.kind : 'opening';
  const locationId = typeof data.locationId === 'string' && MODULE_IDENTIFIER_RE.test(data.locationId.trim()) ? data.locationId.trim() : undefined;
  return {
    ...base,
    kind,
    status: sanitizeSeedStatus(data.status),
    locationId,
    objective: typeof data.objective === 'string' ? data.objective : '',
    situation: typeof data.situation === 'string' ? data.situation : '',
    castGroupNames: sanitizeStringList(data.castGroupNames, MODULE_IDENTIFIER_RE),
    encounterIds: sanitizeStringList(data.encounterIds, MODULE_IDENTIFIER_RE),
    clockIds: sanitizeStringList(data.clockIds, MODULE_IDENTIFIER_RE),
  };
}

function sanitizeEncounterSeed(raw: unknown, index: number): EncounterSeed | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const base = sanitizeStructuredSeedBase(data, `encounter_${index + 1}`, `Encounter ${index + 1}`);
  const kind = data.kind === 'combat_pressure' || data.kind === 'hazard' || data.kind === 'investigation' || data.kind === 'pursuit' ? data.kind : 'social_pressure';
  const sceneId = typeof data.sceneId === 'string' && MODULE_IDENTIFIER_RE.test(data.sceneId.trim()) ? data.sceneId.trim() : undefined;
  const locationId = typeof data.locationId === 'string' && MODULE_IDENTIFIER_RE.test(data.locationId.trim()) ? data.locationId.trim() : undefined;
  const participantRefs = Array.isArray(data.participantRefs)
    ? data.participantRefs.map((item) => sanitizeSubagentRef(item)).filter((item): item is SubagentRef => Boolean(item))
    : [];
  return {
    ...base,
    kind,
    status: sanitizeSeedStatus(data.status),
    sceneId,
    locationId,
    participantRefs,
    pressure: data.pressure === 'low' || data.pressure === 'high' ? data.pressure : 'medium',
    stakes: typeof data.stakes === 'string' ? data.stakes : '',
    successAtCost: typeof data.successAtCost === 'string' ? data.successAtCost : '',
    falloutOnFail: typeof data.falloutOnFail === 'string' ? data.falloutOnFail : '',
    suggestedToolIds: sanitizeStringList(data.suggestedToolIds, MODULE_IDENTIFIER_RE),
  };
}

function sanitizeLocationSeed(raw: unknown, index: number): LocationSeed | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const base = sanitizeStructuredSeedBase(data, `location_${index + 1}`, `Location ${index + 1}`);
  const kind = data.kind === 'inn' || data.kind === 'district' || data.kind === 'station' || data.kind === 'ruin' || data.kind === 'wilderness' || data.kind === 'settlement' ? data.kind : 'site';
  const parentLocationId = typeof data.parentLocationId === 'string' && MODULE_IDENTIFIER_RE.test(data.parentLocationId.trim()) ? data.parentLocationId.trim() : undefined;
  return {
    ...base,
    kind,
    status: sanitizeSeedStatus(data.status),
    summary: typeof data.summary === 'string' ? data.summary : '',
    region: typeof data.region === 'string' ? data.region : '',
    parentLocationId,
    sceneIds: sanitizeStringList(data.sceneIds, MODULE_IDENTIFIER_RE),
  };
}

function sanitizeClockSeed(raw: unknown, index: number): ClockSeed | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const base = sanitizeStructuredSeedBase(data, `clock_${index + 1}`, `Clock ${index + 1}`);
  const sceneId = typeof data.sceneId === 'string' && MODULE_IDENTIFIER_RE.test(data.sceneId.trim()) ? data.sceneId.trim() : undefined;
  const locationId = typeof data.locationId === 'string' && MODULE_IDENTIFIER_RE.test(data.locationId.trim()) ? data.locationId.trim() : undefined;
  const segments = Number.isFinite(Number(data.segments)) ? Math.max(1, Math.min(24, Number(data.segments))) : 4;
  const progress = Number.isFinite(Number(data.progress)) ? Math.max(0, Math.min(segments, Number(data.progress))) : 0;
  return {
    ...base,
    status: sanitizeSeedStatus(data.status),
    segments,
    progress,
    trigger: typeof data.trigger === 'string' ? data.trigger : '',
    consequence: typeof data.consequence === 'string' ? data.consequence : '',
    sceneId,
    locationId,
    factionIds: sanitizeStringList(data.factionIds, MODULE_IDENTIFIER_RE),
    linkedSceneIds: sanitizeStringList(data.linkedSceneIds, MODULE_IDENTIFIER_RE),
    linkedEncounterIds: sanitizeStringList(data.linkedEncounterIds, MODULE_IDENTIFIER_RE),
    publicVisible: data.publicVisible === true,
  };
}

function sanitizeFactionPresence(raw: unknown): FactionPresence | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const locationId = typeof data.locationId === 'string' && MODULE_IDENTIFIER_RE.test(data.locationId.trim()) ? data.locationId.trim() : '';
  if (!locationId) return null;
  const strength = data.strength === 'weak' || data.strength === 'present' || data.strength === 'strong' || data.strength === 'dominant' ? data.strength : 'hidden';
  return {
    locationId,
    strength,
    details: typeof data.details === 'string' ? data.details : '',
  };
}

function sanitizeFactionSeed(raw: unknown, index: number): FactionSeed | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const base = sanitizeStructuredSeedBase(data, `faction_${index + 1}`, `Faction ${index + 1}`);
  const tier = data.tier === 'regional' || data.tier === 'global' || data.tier === 'planar' || data.tier === 'cosmic' ? data.tier : 'local';
  const factionType = typeof data.factionType === 'string' ? data.factionType : 'political';
  const allowedFactionTypes = new Set(['political', 'criminal', 'economic', 'mystical', 'military', 'guild', 'mercantile', 'religious', 'nomadic', 'hermetic']);
  const presence = Array.isArray(data.presence)
    ? data.presence.map((item) => sanitizeFactionPresence(item)).filter((item): item is FactionPresence => Boolean(item))
    : [];
  return {
    ...base,
    tier,
    factionType: allowedFactionTypes.has(factionType) ? factionType as FactionSeed['factionType'] : 'political',
    presence,
    agenda: typeof data.agenda === 'string' ? data.agenda : '',
    resources: sanitizeStringList(data.resources),
    rivalIds: sanitizeStringList(data.rivalIds, MODULE_IDENTIFIER_RE),
    allyIds: sanitizeStringList(data.allyIds, MODULE_IDENTIFIER_RE),
    clockIds: sanitizeStringList(data.clockIds, MODULE_IDENTIFIER_RE),
    sceneIds: sanitizeStringList(data.sceneIds, MODULE_IDENTIFIER_RE),
    leaderName: typeof data.leaderName === 'string' && data.leaderName.trim() ? data.leaderName.trim() : undefined,
    headquartersLocationId: typeof data.headquartersLocationId === 'string' && MODULE_IDENTIFIER_RE.test(data.headquartersLocationId.trim()) ? data.headquartersLocationId.trim() : undefined,
  };
}

function sanitizeHookTarget(raw: unknown): HookTarget | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const targetType = data.targetType;
  const allowed = new Set(['scene', 'location', 'encounter', 'faction', 'npc', 'any']);
  const targetId = typeof data.targetId === 'string' && MODULE_IDENTIFIER_RE.test(data.targetId.trim()) ? data.targetId.trim() : '';
  if (!allowed.has(String(targetType || '')) || !targetId) return null;
  const weight = Number.isFinite(Number(data.weight)) ? Math.max(0, Math.min(10, Number(data.weight))) : 1;
  return { targetType: targetType as HookTarget['targetType'], targetId, weight };
}

function sanitizeHookSeed(raw: unknown, index: number): HookSeed | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const base = sanitizeStructuredSeedBase(data, `hook_${index + 1}`, `Hook ${index + 1}`);
  const allowed = new Set(['rumor', 'event', 'discovery', 'threat', 'opportunity', 'mystery', 'task', 'vision']);
  const hookKind = typeof data.hookKind === 'string' && allowed.has(data.hookKind) ? data.hookKind as HookSeed['hookKind'] : 'rumor';
  const targets = Array.isArray(data.targets)
    ? data.targets.map((item) => sanitizeHookTarget(item)).filter((item): item is HookTarget => Boolean(item))
    : [];
  return {
    ...base,
    hookKind,
    triggerCondition: typeof data.triggerCondition === 'string' ? data.triggerCondition : 'always',
    content: typeof data.content === 'string' ? data.content : '',
    targets,
    expirationClockId: typeof data.expirationClockId === 'string' && MODULE_IDENTIFIER_RE.test(data.expirationClockId.trim()) ? data.expirationClockId.trim() : undefined,
    expirationCondition: typeof data.expirationCondition === 'string' ? data.expirationCondition : '',
    used: data.used === true,
    hidden: data.hidden !== false,
    gmNotes: typeof data.gmNotes === 'string' ? data.gmNotes : '',
    suggestedChecks: sanitizeStringList(data.suggestedChecks),
  };
}

function sanitizeFactionSeeds(raw: unknown): FactionSeed[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const items: FactionSeed[] = [];
  raw.forEach((item, index) => {
    const sanitized = sanitizeFactionSeed(item, index);
    if (!sanitized || seen.has(sanitized.id)) return;
    seen.add(sanitized.id);
    items.push(sanitized);
  });
  return items;
}

function sanitizeHookSeeds(raw: unknown): HookSeed[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const items: HookSeed[] = [];
  raw.forEach((item, index) => {
    const sanitized = sanitizeHookSeed(item, index);
    if (!sanitized || seen.has(sanitized.id)) return;
    seen.add(sanitized.id);
    items.push(sanitized);
  });
  return items;
}

function sanitizeModuleSlotProvision(raw: unknown): ModuleSlotProvision | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const slot = sanitizeModuleSlotName(data.slot);
  const entityType = sanitizeModuleSlotEntityType(data.entityType);
  const entityId = typeof data.entityId === 'string' && MODULE_IDENTIFIER_RE.test(data.entityId.trim()) ? data.entityId.trim() : '';
  if (!slot || !entityType || !entityId) return null;
  return {
    slot,
    entityType,
    entityId,
    policy: sanitizeModuleSlotPolicy(data.policy),
  };
}

function sanitizeRuntimeSlotBinding(raw: unknown): RuntimeSlotBinding | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const slot = sanitizeModuleSlotName(data.slot);
  const entityType = sanitizeModuleSlotEntityType(data.entityType);
  const entityId = typeof data.entityId === 'string' && MODULE_IDENTIFIER_RE.test(data.entityId.trim()) ? data.entityId.trim() : '';
  const providerModuleId = typeof data.providerModuleId === 'string' && MODULE_IDENTIFIER_RE.test(data.providerModuleId.trim()) ? data.providerModuleId.trim() : '';
  if (!slot || !entityType || !entityId || !providerModuleId) return null;
  return { slot, entityType, entityId, providerModuleId };
}

function sanitizeSceneSeeds(raw: unknown): SceneSeed[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const items: SceneSeed[] = [];
  raw.forEach((item, index) => {
    const sanitized = sanitizeSceneSeed(item, index);
    if (!sanitized || seen.has(sanitized.id)) return;
    seen.add(sanitized.id);
    items.push(sanitized);
  });
  return items;
}

function sanitizeEncounterSeeds(raw: unknown): EncounterSeed[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const items: EncounterSeed[] = [];
  raw.forEach((item, index) => {
    const sanitized = sanitizeEncounterSeed(item, index);
    if (!sanitized || seen.has(sanitized.id)) return;
    seen.add(sanitized.id);
    items.push(sanitized);
  });
  return items;
}

function sanitizeLocationSeeds(raw: unknown): LocationSeed[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const items: LocationSeed[] = [];
  raw.forEach((item, index) => {
    const sanitized = sanitizeLocationSeed(item, index);
    if (!sanitized || seen.has(sanitized.id)) return;
    seen.add(sanitized.id);
    items.push(sanitized);
  });
  return items;
}

function sanitizeClockSeeds(raw: unknown): ClockSeed[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const items: ClockSeed[] = [];
  raw.forEach((item, index) => {
    const sanitized = sanitizeClockSeed(item, index);
    if (!sanitized || seen.has(sanitized.id)) return;
    seen.add(sanitized.id);
    items.push(sanitized);
  });
  return items;
}

function sanitizeModuleSlotProvisions(raw: unknown): ModuleSlotProvision[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const items: ModuleSlotProvision[] = [];
  raw.forEach((item) => {
    const sanitized = sanitizeModuleSlotProvision(item);
    if (!sanitized) return;
    const key = `${sanitized.slot}:${sanitized.entityType}:${sanitized.entityId}:${sanitized.policy}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push(sanitized);
  });
  return items;
}

function sanitizeRuntimeSlotBindings(raw: unknown): RuntimeSlotBinding[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const items: RuntimeSlotBinding[] = [];
  raw.forEach((item) => {
    const sanitized = sanitizeRuntimeSlotBinding(item);
    if (!sanitized) return;
    const key = `${sanitized.slot}:${sanitized.entityType}:${sanitized.entityId}:${sanitized.providerModuleId}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push(sanitized);
  });
  return items;
}

function sanitizeModuleCategory(raw: unknown): ModuleLibraryCategory {
  return raw === 'world' || raw === 'rules' || raw === 'persona' || raw === 'party' || raw === 'utility' || raw === 'adventure' ? raw : 'mixed';
}

function sanitizeModuleLineage(raw: unknown): ModuleLibraryLineage {
  return raw === 'branch_overlay' ? 'branch_overlay' : 'shared';
}

function sanitizeIdentifierList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return Array.from(new Set(raw.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter((item) => /^[A-Za-z0-9_:-]+$/.test(item))));
}

function sanitizeModuleStarterArtifactRef(raw: unknown): ModuleStarterArtifactRef | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const artifactId = typeof data.artifactId === 'string' ? data.artifactId.trim() : '';
  if (!artifactId) return null;
  const artifactKind = typeof data.artifactKind === 'string' && data.artifactKind.trim() ? data.artifactKind.trim() : 'graph';
  return {
    artifactId,
    artifactKind,
    label: typeof data.label === 'string' ? data.label : '',
    description: typeof data.description === 'string' ? data.description : '',
  };
}

function sanitizeModuleStarterArtifactRefs(raw: unknown): ModuleStarterArtifactRef[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const refs: ModuleStarterArtifactRef[] = [];
  raw.forEach((item) => {
    const sanitized = sanitizeModuleStarterArtifactRef(item);
    if (!sanitized) return;
    const key = `${sanitized.artifactKind}:${sanitized.artifactId}`;
    if (seen.has(key)) return;
    seen.add(key);
    refs.push(sanitized);
  });
  return refs;
}

function sanitizeModulePromptAssignmentPreset(raw: unknown, index: number): ModulePromptAssignmentPreset | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const stripId = typeof data.stripId === 'string' ? data.stripId.trim() : '';
  if (!stripId) return null;
  const targetKind = data.targetKind === 'subagent' ? 'subagent' : 'graph';
  const groupName = typeof data.groupName === 'string' ? data.groupName.trim() : '';
  const agentName = typeof data.agentName === 'string' ? data.agentName.trim() : '';
  if (targetKind === 'subagent' && (!groupName || !agentName)) return null;
  const mergeMode: PromptStripMergeMode = data.mergeMode === 'append' || data.mergeMode === 'replace_if_empty' ? data.mergeMode : 'prepend';
  return {
    id: typeof data.id === 'string' && data.id.trim() ? data.id.trim() : `module_prompt_${index + 1}`,
    stripId,
    targetKind,
    groupName: targetKind === 'subagent' ? groupName : undefined,
    agentName: targetKind === 'subagent' ? agentName : undefined,
    mergeMode,
    order: Number.isFinite(Number(data.order)) ? Math.max(0, Math.min(999, Number(data.order))) : index,
    enabled: data.enabled !== false,
  };
}

function sanitizeModulePromptAssignments(raw: unknown): ModulePromptAssignmentPreset[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const presets: ModulePromptAssignmentPreset[] = [];
  raw.forEach((item, index) => {
    const sanitized = sanitizeModulePromptAssignmentPreset(item, index);
    if (!sanitized) return;
    const key = `${sanitized.stripId}:${sanitized.targetKind}:${sanitized.groupName || ''}:${sanitized.agentName || ''}:${sanitized.mergeMode}:${sanitized.order}`;
    if (seen.has(key)) return;
    seen.add(key);
    presets.push(sanitized);
  });
  return presets;
}

function sanitizeModuleLibraryEntry(raw: unknown, index: number): ModuleLibraryEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const fallbackId = `module_${index + 1}`;
  const fallbackName = index === 0 ? 'Default Module' : `Module ${index + 1}`;
  return {
    id: typeof data.id === 'string' && data.id.trim() ? data.id.trim() : fallbackId,
    name: typeof data.name === 'string' && data.name.trim() ? data.name.trim() : fallbackName,
    description: typeof data.description === 'string' ? data.description : '',
    category: sanitizeModuleCategory(data.category),
    tags: Array.isArray(data.tags)
      ? Array.from(new Set(data.tags.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)))
      : [],
    lineage: sanitizeModuleLineage(data.lineage),
    branchTargets: sanitizeIdentifierList(data.branchTargets),
    recommendedProfile: typeof data.recommendedProfile === 'string' ? data.recommendedProfile.trim().replace(/[^A-Za-z0-9_:-]/g, '') : '',
    themeHints: sanitizeIdentifierList(data.themeHints),
    compatibilityNotes: typeof data.compatibilityNotes === 'string' ? data.compatibilityNotes : '',
    origin: data.origin === 'artifact' ? 'artifact' : 'workspace',
    artifactRef: typeof data.artifactRef === 'string' && data.artifactRef.trim() ? data.artifactRef.trim() : null,
    promptStrips: sanitizePromptStripLibrary(data.promptStrips),
    promptAssignments: sanitizeModulePromptAssignments(data.promptAssignments),
    subagentGroups: sanitizeSubagentLibrary(data.subagentGroups),
    starterArtifacts: sanitizeModuleStarterArtifactRefs(data.starterArtifacts),
    runtimeContext: sanitizeRuntimeContextEntries(data.runtimeContext),
    moduleDependencies: sanitizeIdentifierList(data.moduleDependencies),
    moduleConflicts: sanitizeIdentifierList(data.moduleConflicts),
    requiresSlots: sanitizeStringList(data.requiresSlots, MODULE_SLOT_NAME_RE) as ModuleSlotName[],
    providesSlots: sanitizeModuleSlotProvisions(data.providesSlots),
    sceneSeeds: sanitizeSceneSeeds(data.sceneSeeds),
    encounterSeeds: sanitizeEncounterSeeds(data.encounterSeeds),
    locationSeeds: sanitizeLocationSeeds(data.locationSeeds),
    clockSeeds: sanitizeClockSeeds(data.clockSeeds),
    factionSeeds: sanitizeFactionSeeds(data.factionSeeds),
    hookSeeds: sanitizeHookSeeds(data.hookSeeds),
  };
}

function sanitizeModuleLibrary(raw: unknown): ModuleLibraryEntry[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const modules: ModuleLibraryEntry[] = [];
  raw.forEach((item, index) => {
    const sanitized = sanitizeModuleLibraryEntry(item, index);
    if (!sanitized) return;
    if (seen.has(sanitized.id)) return;
    seen.add(sanitized.id);
    modules.push(sanitized);
  });
  return modules;
}

function sanitizeLoadedModuleIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const cleaned: string[] = [];
  raw.forEach((item) => {
    const value = typeof item === 'string' ? item.trim() : '';
    if (!value || seen.has(value)) return;
    seen.add(value);
    cleaned.push(value);
  });
  return cleaned;
}

function sanitizePromptAssignmentTarget(raw: unknown, fallbackTabId = 'active_tab'): PromptAssignmentTarget | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const kind = data.kind;
  const tabId = typeof data.tabId === 'string' && data.tabId.trim() ? data.tabId.trim() : fallbackTabId;
  if (kind == 'graph') {
    return { kind: 'graph', tabId };
  }
  if (kind == 'node') {
    const nodeId = typeof data.nodeId === 'string' ? data.nodeId.trim() : '';
    if (!nodeId) return null;
    return { kind: 'node', tabId, nodeId };
  }
  if (kind == 'subagent') {
    const groupName = typeof data.groupName === 'string' ? data.groupName.trim() : '';
    const agentName = typeof data.agentName === 'string' ? data.agentName.trim() : '';
    if (!groupName || !agentName) return null;
    return { kind: 'subagent', tabId, groupName, agentName };
  }
  return null;
}

function sanitizePromptAssignmentIdentifier(raw: unknown, fallback: string): string {
  const source = typeof raw === 'string' && raw.trim() ? raw.trim() : fallback;
  const normalized = source
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!normalized) return fallback;
  return /^[A-Za-z_]/.test(normalized) ? normalized : `prompt_${normalized}`;
}

function sanitizePromptStripAssignment(raw: unknown, index: number, fallbackTabId = 'active_tab'): PromptStripAssignment | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const target = sanitizePromptAssignmentTarget(data.target, fallbackTabId);
  const stripId = typeof data.stripId === 'string' ? data.stripId.trim() : '';
  if (!target || !stripId) return null;
  const mergeMode: PromptStripMergeMode = data.mergeMode === 'append' || data.mergeMode === 'replace_if_empty' ? data.mergeMode : 'prepend';
  return {
    id: sanitizePromptAssignmentIdentifier(data.id, `prompt_assignment_${index + 1}`),
    stripId,
    target,
    mergeMode,
    order: Number.isFinite(Number(data.order)) ? Math.max(0, Math.min(999, Number(data.order))) : index,
    enabled: data.enabled !== false,
  };
}

function sanitizePromptStripAssignments(raw: unknown, fallbackTabId = 'active_tab'): PromptStripAssignment[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const assignments: PromptStripAssignment[] = [];
  raw.forEach((item, index) => {
    const sanitized = sanitizePromptStripAssignment(item, index, fallbackTabId);
    if (!sanitized) return;
    let candidateId = sanitized.id;
    let suffix = 2;
    while (seen.has(candidateId)) {
      candidateId = `${sanitized.id}_${suffix}`;
      suffix += 1;
    }
    seen.add(candidateId);
    assignments.push({ ...sanitized, id: candidateId });
  });
  return assignments;
}

export function buildPromptAssignmentTargetKey(target: PromptAssignmentTarget): string {
  if (target.kind === 'graph') return `graph:${target.tabId}`;
  if (target.kind === 'node') return `node:${target.tabId}:${target.nodeId}`;
  return `subagent:${target.tabId}:${target.groupName}:${target.agentName}`;
}

function buildPromptAssignmentTargetIdPart(target: PromptAssignmentTarget): string {
  if (target.kind === 'graph') return `graph_${target.tabId}`;
  if (target.kind === 'node') return `node_${target.tabId}_${target.nodeId}`;
  return `subagent_${target.tabId}_${target.groupName}_${target.agentName}`;
}

export function describePromptAssignmentTarget(target: PromptAssignmentTarget): string {
  if (target.kind === 'graph') return 'Graph default';
  if (target.kind === 'node') return `Node ${target.nodeId}`;
  return `Subagent ${target.groupName}/${target.agentName}`;
}

export function matchesPromptAssignmentTarget(left: PromptAssignmentTarget, right: PromptAssignmentTarget): boolean {
  return buildPromptAssignmentTargetKey(left) === buildPromptAssignmentTargetKey(right);
}

export function getPromptAssignmentsForTarget(assignments: PromptStripAssignment[], target: PromptAssignmentTarget): PromptStripAssignment[] {
  return assignments.filter((assignment) => matchesPromptAssignmentTarget(assignment.target, target));
}

export function remapPromptAssignmentsToTabId(assignments: PromptStripAssignment[], tabId: string): PromptStripAssignment[] {
  return sanitizePromptStripAssignments(assignments.map((assignment) => ({
    ...assignment,
    target: { ...assignment.target, tabId } as PromptAssignmentTarget,
  })), tabId);
}

function getPromptStripBodies(assignments: PromptStripAssignment[], library: PromptStripDefinition[], mergeMode: PromptStripMergeMode): string[] {
  const byId = new Map(library.map((strip) => [strip.id, strip]));
  return assignments
    .filter((assignment) => assignment.enabled && assignment.mergeMode === mergeMode)
    .sort((a, b) => a.order - b.order)
    .map((assignment) => byId.get(assignment.stripId)?.body || '')
    .filter((body) => body.trim().length > 0);
}

export function resolvePromptStripsForTarget(options: {
  localPrompt?: string | null;
  library: PromptStripDefinition[];
  assignments: PromptStripAssignment[];
}): {
  resolvedPrompt: string;
  localPrompt: string;
  prependBodies: string[];
  appendBodies: string[];
  replaceIfEmptyBodies: string[];
} {
  const localPrompt = typeof options.localPrompt === 'string' ? options.localPrompt : '';
  const prependBodies = getPromptStripBodies(options.assignments, options.library, 'prepend');
  const appendBodies = getPromptStripBodies(options.assignments, options.library, 'append');
  const replaceIfEmptyBodies = getPromptStripBodies(options.assignments, options.library, 'replace_if_empty');
  const base = localPrompt.trim() ? localPrompt : replaceIfEmptyBodies.join('\n\n');
  const resolvedPrompt = [...prependBodies, base, ...appendBodies].filter((item) => item.trim().length > 0).join('\n\n');
  return { resolvedPrompt, localPrompt, prependBodies, appendBodies, replaceIfEmptyBodies };
}

export function resolvePromptStripsForAssignmentLayers(options: {
  localPrompt?: string | null;
  library: PromptStripDefinition[];
  assignmentLayers: PromptStripAssignment[][];
}): {
  resolvedPrompt: string;
  localPrompt: string;
  prependBodies: string[];
  appendBodies: string[];
  replaceIfEmptyBodies: string[];
} {
  const localPrompt = typeof options.localPrompt === 'string' ? options.localPrompt : '';
  const prependBodies = options.assignmentLayers.flatMap((assignments) => getPromptStripBodies(assignments, options.library, 'prepend'));
  const appendBodies = options.assignmentLayers.flatMap((assignments) => getPromptStripBodies(assignments, options.library, 'append'));
  const replaceIfEmptyBodies = options.assignmentLayers.flatMap((assignments) => getPromptStripBodies(assignments, options.library, 'replace_if_empty'));
  const base = localPrompt.trim() ? localPrompt : replaceIfEmptyBodies.join('\n\n');
  const resolvedPrompt = [...prependBodies, base, ...appendBodies].filter((item) => item.trim().length > 0).join('\n\n');
  return { resolvedPrompt, localPrompt, prependBodies, appendBodies, replaceIfEmptyBodies };
}

export function resolvePromptStripsForNodeTarget(options: {
  localPrompt?: string | null;
  library: PromptStripDefinition[];
  assignments: PromptStripAssignment[];
  graphTarget: PromptAssignmentTarget;
  nodeTarget: PromptAssignmentTarget;
}) {
  return resolvePromptStripsForAssignmentLayers({
    localPrompt: options.localPrompt,
    library: options.library,
    assignmentLayers: [
      getPromptAssignmentsForTarget(options.assignments, options.graphTarget),
      getPromptAssignmentsForTarget(options.assignments, options.nodeTarget),
    ],
  });
}

export function resolvePromptStripsForSubagentTarget(options: {
  localPrompt?: string | null;
  library: PromptStripDefinition[];
  assignments: PromptStripAssignment[];
  graphTarget: PromptAssignmentTarget;
  subagentTarget: PromptAssignmentTarget;
}) {
  return resolvePromptStripsForAssignmentLayers({
    localPrompt: options.localPrompt,
    library: options.library,
    assignmentLayers: [
      getPromptAssignmentsForTarget(options.assignments, options.graphTarget),
      getPromptAssignmentsForTarget(options.assignments, options.subagentTarget),
    ],
  });
}

export function isPromptCapableNodeType(nodeType: string): boolean {
  return [
    'llm_chat',
    'react_agent',
    'sub_agent',
    'tool_llm_worker',
    'deep_subagent_worker',
    'prompt_template',
  ].includes(nodeType);
}

export function getLocalPromptForNode(nodeType: string, params: Record<string, unknown>): string {
  if (typeof params.system_prompt === 'string') return params.system_prompt;
  if (typeof params.prompt_template === 'string') return params.prompt_template;
  if (typeof params.template === 'string') return params.template;
  if (nodeType === 'prompt_template' && typeof params.prompt === 'string') return params.prompt;
  return '';
}

export function defaultRuntimeSettings(projectMode: ProjectMode = 'langgraph'): RuntimeSettings {
  const surface = getDefaultSurfaceForProjectMode(projectMode);
  return {
    recursionLimit: 50,
    streamMode: surface.defaultStreamMode,
    debug: false,
    inheritParentBindings: true,
    storeBackend: 'in_memory',
    storePath: 'runtime_store.db',
    checkpointEnabled: false,
    subagentLibrary: [],
    promptStripLibrary: [],
    promptStripAssignments: [],
    moduleLibrary: [],
    loadedModuleIds: [],
    runtimeContext: [],
    shellExecutionEnabled: false,
    sceneSeeds: [],
    encounterSeeds: [],
    locationSeeds: [],
    clockSeeds: [],
    factionSeeds: [],
    hookSeeds: [],
    slotBindings: [],
  };
}

export function sanitizeRuntimeSettings(settings: Partial<RuntimeSettings> | null | undefined, projectMode: ProjectMode = 'langgraph'): RuntimeSettings {
  const defaults = defaultRuntimeSettings(projectMode);
  const rawStorePath = typeof settings?.storePath === 'string' ? settings.storePath.trim() : '';
  const safeStorePath = rawStorePath && !/[\0\r\n]/.test(rawStorePath) ? rawStorePath : defaults.storePath;
  return {
    recursionLimit: Number.isFinite(Number(settings?.recursionLimit)) ? Math.max(1, Math.min(500, Number(settings?.recursionLimit))) : defaults.recursionLimit,
    streamMode: settings?.streamMode === 'values' || settings?.streamMode === 'debug' ? settings.streamMode : defaults.streamMode,
    debug: Boolean(settings?.debug),
    inheritParentBindings: settings?.inheritParentBindings === false ? false : defaults.inheritParentBindings,
    storeBackend: settings?.storeBackend === 'sqlite_local' ? 'sqlite_local' : defaults.storeBackend,
    storePath: safeStorePath,
    checkpointEnabled: settings?.checkpointEnabled === true,
    subagentLibrary: sanitizeSubagentLibrary(settings?.subagentLibrary),
    promptStripLibrary: sanitizePromptStripLibrary(settings?.promptStripLibrary),
    promptStripAssignments: sanitizePromptStripAssignments(settings?.promptStripAssignments),
    moduleLibrary: sanitizeModuleLibrary(settings?.moduleLibrary),
    loadedModuleIds: sanitizeLoadedModuleIds(settings?.loadedModuleIds),
    runtimeContext: sanitizeRuntimeContextEntries(settings?.runtimeContext),
    shellExecutionEnabled: settings?.shellExecutionEnabled === true,
    sceneSeeds: sanitizeSceneSeeds(settings?.sceneSeeds),
    encounterSeeds: sanitizeEncounterSeeds(settings?.encounterSeeds),
    locationSeeds: sanitizeLocationSeeds(settings?.locationSeeds),
    clockSeeds: sanitizeClockSeeds(settings?.clockSeeds),
    factionSeeds: sanitizeFactionSeeds(settings?.factionSeeds),
    hookSeeds: sanitizeHookSeeds(settings?.hookSeeds),
    slotBindings: sanitizeRuntimeSlotBindings(settings?.slotBindings),
  };
}

function mergePromptStripLibraries(base: PromptStripDefinition[], incoming: PromptStripDefinition[]): PromptStripDefinition[] {
  const seen = new Set(base.map((item) => item.id));
  return [...base, ...incoming.filter((item) => !seen.has(item.id))];
}

function mergeSubagentLibraries(base: SubagentGroupDefinition[], incoming: SubagentGroupDefinition[]): SubagentGroupDefinition[] {
  const byGroup = new Map(base.map((group) => [group.name, { ...group, agents: [...group.agents] }]));
  incoming.forEach((group) => {
    const current = byGroup.get(group.name);
    if (!current) {
      byGroup.set(group.name, { ...group, agents: [...group.agents] });
      return;
    }
    const seenAgents = new Set(current.agents.map((agent) => agent.name));
    group.agents.forEach((agent) => {
      if (!seenAgents.has(agent.name)) {
        current.agents.push(agent);
        seenAgents.add(agent.name);
      }
    });
  });
  return Array.from(byGroup.values());
}

function mergeRuntimeContextLists(base: { key: string; value: string }[], incoming: { key: string; value: string }[]): { key: string; value: string }[] {
  const seen = new Set(base.map((entry) => entry.key));
  return [...base, ...incoming.filter((entry) => !seen.has(entry.key))];
}

function getLoadedModuleEntries(settings: RuntimeSettings): ModuleLibraryEntry[] {
  const ids = new Set(settings.loadedModuleIds || []);
  return (settings.moduleLibrary || []).filter((entry) => ids.has(entry.id));
}

function assertModuleCanBeApplied(settings: RuntimeSettings, moduleEntry: ModuleLibraryEntry): void {
  const loadedIds = new Set(settings.loadedModuleIds || []);
  (moduleEntry.moduleDependencies || []).forEach((dependencyId) => {
    if (!loadedIds.has(dependencyId)) {
      throw new Error(`Module '${moduleEntry.id}' requires missing module '${dependencyId}'.`);
    }
  });
  (moduleEntry.moduleConflicts || []).forEach((conflictId) => {
    if (loadedIds.has(conflictId)) {
      throw new Error(`Module '${moduleEntry.id}' conflicts with already loaded module '${conflictId}'.`);
    }
  });
  getLoadedModuleEntries(settings).forEach((loadedModule) => {
    if ((loadedModule.moduleConflicts || []).includes(moduleEntry.id)) {
      throw new Error(`Loaded module '${loadedModule.id}' conflicts with module '${moduleEntry.id}'.`);
    }
  });
}

function attachSourceModuleId<T extends { sourceModuleId?: string }>(items: T[], moduleId: string): T[] {
  return items.map((item) => ({ ...item, sourceModuleId: item.sourceModuleId || moduleId }));
}

function mergeSeedListsById<T extends { id: string; mergePolicy?: ModuleSeedMergePolicy }>(
  base: T[],
  incoming: T[],
  label: string,
  moduleId: string,
): T[] {
  const byId = new Map(base.map((item) => [item.id, item]));
  incoming.forEach((item) => {
    const existing = byId.get(item.id);
    if (!existing) {
      byId.set(item.id, item);
      return;
    }
    if (JSON.stringify(existing) === JSON.stringify(item)) return;
    const mergePolicy = item.mergePolicy || 'error';
    if (mergePolicy === 'preserve') return;
    if (mergePolicy === 'replace') {
      byId.set(item.id, item);
      return;
    }
    throw new Error(`Module '${moduleId}' attempted to redefine ${label} '${item.id}'.`);
  });
  return Array.from(byId.values());
}

function mergeSlotBindings(
  base: RuntimeSlotBinding[],
  incoming: ModuleSlotProvision[],
  providerModuleId: string,
): RuntimeSlotBinding[] {
  let next = [...base];
  incoming.forEach((provision) => {
    const binding: RuntimeSlotBinding = {
      slot: provision.slot,
      entityType: provision.entityType,
      entityId: provision.entityId,
      providerModuleId,
    };
    if (provision.policy === 'replace') {
      next = next.filter((existing) => existing.slot !== provision.slot);
      next.push(binding);
      return;
    }
    if (provision.policy === 'append') {
      const duplicate = next.some((existing) => existing.slot === binding.slot && existing.entityType === binding.entityType && existing.entityId === binding.entityId && existing.providerModuleId === providerModuleId);
      if (!duplicate) next.push(binding);
      return;
    }
    const conflict = next.find((existing) => existing.slot === provision.slot && existing.providerModuleId !== providerModuleId);
    if (conflict) {
      throw new Error(`Module '${providerModuleId}' cannot claim exclusive slot '${provision.slot}' because it is already provided by '${conflict.providerModuleId}'.`);
    }
    next = next.filter((existing) => !(existing.slot === binding.slot && existing.providerModuleId === providerModuleId));
    next.push(binding);
  });
  return next;
}

function assertRequiredSlotsResolved(
  slotBindings: RuntimeSlotBinding[],
  requiredSlots: ModuleSlotName[],
  moduleId: string,
): void {
  const available = new Set(slotBindings.map((binding) => binding.slot));
  requiredSlots.forEach((slot) => {
    if (!available.has(slot)) {
      throw new Error(`Module '${moduleId}' requires unresolved slot '${slot}'.`);
    }
  });
}

function buildModulePresetRuntimeTarget(preset: ModulePromptAssignmentPreset, tabId: string): PromptAssignmentTarget | null {
  if (preset.targetKind === 'graph') return { kind: 'graph', tabId };
  if (preset.targetKind === 'subagent' && preset.groupName && preset.agentName) {
    return { kind: 'subagent', tabId, groupName: preset.groupName, agentName: preset.agentName };
  }
  return null;
}

function collectModulePromptAssignmentsFromRuntime(settings: RuntimeSettings, tabId?: string | null): ModulePromptAssignmentPreset[] {
  if (!tabId) return [];
  const assignments = sanitizePromptStripAssignments(settings.promptStripAssignments, tabId);
  const validSubagents = new Set((settings.subagentLibrary || []).flatMap((group) => (group.agents || []).map((agent) => `${group.name}::${agent.name}`)));
  return assignments.flatMap<ModulePromptAssignmentPreset>((assignment, index) => {
    if (assignment.target.kind === 'graph' && assignment.target.tabId === tabId) {
      return [{
        id: assignment.id || `module_prompt_${index + 1}`,
        stripId: assignment.stripId,
        targetKind: 'graph' as const,
        mergeMode: assignment.mergeMode,
        order: assignment.order,
        enabled: assignment.enabled !== false,
      }];
    }
    if (assignment.target.kind === 'subagent' && assignment.target.tabId === tabId) {
      const subKey = `${assignment.target.groupName}::${assignment.target.agentName}`;
      if (!validSubagents.has(subKey)) return [];
      return [{
        id: assignment.id || `module_prompt_${index + 1}`,
        stripId: assignment.stripId,
        targetKind: 'subagent' as const,
        groupName: assignment.target.groupName,
        agentName: assignment.target.agentName,
        mergeMode: assignment.mergeMode,
        order: assignment.order,
        enabled: assignment.enabled !== false,
      }];
    }
    return [];
  });
}

function mergePromptAssignmentsFromModule(base: PromptStripAssignment[], moduleEntry: ModuleLibraryEntry, tabId?: string | null): PromptStripAssignment[] {
  if (!tabId) return base;
  const next = [...base];
  const existingKeys = new Set(next.map((assignment) => `${assignment.stripId}:${buildPromptAssignmentTargetKey(assignment.target)}:${assignment.mergeMode}`));
  const maxOrderByTarget = new Map<string, number>();
  next.forEach((assignment) => {
    const key = buildPromptAssignmentTargetKey(assignment.target);
    maxOrderByTarget.set(key, Math.max(maxOrderByTarget.get(key) ?? -1, assignment.order));
  });
  (moduleEntry.promptAssignments || []).forEach((preset, index) => {
    if (preset.enabled === false) return;
    const target = buildModulePresetRuntimeTarget(preset, tabId);
    if (!target) return;
    const targetKey = buildPromptAssignmentTargetKey(target);
    const dedupeKey = `${preset.stripId}:${targetKey}:${preset.mergeMode}`;
    if (existingKeys.has(dedupeKey)) return;
    const nextOrderBase = (maxOrderByTarget.get(targetKey) ?? -1) + 1;
    const order = Math.min(999, Math.max(nextOrderBase, preset.order));
    next.push({
      id: sanitizePromptAssignmentIdentifier(
        `${moduleEntry.id}__${preset.id || `preset_${index + 1}`}__${buildPromptAssignmentTargetIdPart(target)}`,
        `prompt_assignment_${next.length + 1}`,
      ),
      stripId: preset.stripId,
      target,
      mergeMode: preset.mergeMode,
      order,
      enabled: true,
    });
    existingKeys.add(dedupeKey);
    maxOrderByTarget.set(targetKey, order);
  });
  return next;
}

export function applyModuleDefinitionToRuntimeSettings(settings: RuntimeSettings, moduleEntry: ModuleLibraryEntry, options: { tabId?: string | null } = {}): RuntimeSettings {
  assertModuleCanBeApplied(settings, moduleEntry);

  const incomingSceneSeeds = attachSourceModuleId(moduleEntry.sceneSeeds || [], moduleEntry.id);
  const incomingEncounterSeeds = attachSourceModuleId(moduleEntry.encounterSeeds || [], moduleEntry.id);
  const incomingLocationSeeds = attachSourceModuleId(moduleEntry.locationSeeds || [], moduleEntry.id);
  const incomingClockSeeds = attachSourceModuleId(moduleEntry.clockSeeds || [], moduleEntry.id);
  const incomingFactionSeeds = attachSourceModuleId(moduleEntry.factionSeeds || [], moduleEntry.id);
  const incomingHookSeeds = attachSourceModuleId(moduleEntry.hookSeeds || [], moduleEntry.id);

  const nextSlotBindings = mergeSlotBindings(
    settings.slotBindings || [],
    moduleEntry.providesSlots || [],
    moduleEntry.id,
  );

  assertRequiredSlotsResolved(nextSlotBindings, moduleEntry.requiresSlots || [], moduleEntry.id);

  return sanitizeRuntimeSettings({
    ...settings,
    promptStripLibrary: mergePromptStripLibraries(settings.promptStripLibrary || [], moduleEntry.promptStrips || []),
    promptStripAssignments: mergePromptAssignmentsFromModule(settings.promptStripAssignments || [], moduleEntry, options.tabId),
    subagentLibrary: mergeSubagentLibraries(settings.subagentLibrary || [], moduleEntry.subagentGroups || []),
    runtimeContext: mergeRuntimeContextLists(settings.runtimeContext || [], moduleEntry.runtimeContext || []),
    sceneSeeds: mergeSeedListsById(settings.sceneSeeds || [], incomingSceneSeeds, 'sceneSeeds', moduleEntry.id),
    encounterSeeds: mergeSeedListsById(settings.encounterSeeds || [], incomingEncounterSeeds, 'encounterSeeds', moduleEntry.id),
    locationSeeds: mergeSeedListsById(settings.locationSeeds || [], incomingLocationSeeds, 'locationSeeds', moduleEntry.id),
    clockSeeds: mergeSeedListsById(settings.clockSeeds || [], incomingClockSeeds, 'clockSeeds', moduleEntry.id),
    factionSeeds: mergeSeedListsById(settings.factionSeeds || [], incomingFactionSeeds, 'factionSeeds', moduleEntry.id),
    hookSeeds: mergeSeedListsById(settings.hookSeeds || [], incomingHookSeeds, 'hookSeeds', moduleEntry.id),
    slotBindings: nextSlotBindings,
    loadedModuleIds: Array.from(new Set([...(settings.loadedModuleIds || []), moduleEntry.id])),
  });
}


export function buildModuleLibraryEntryFromRuntimeSettings(settings: RuntimeSettings, seed: Partial<ModuleLibraryEntry> = {}, options: { tabId?: string | null } = {}): ModuleLibraryEntry {
  return {
    id: typeof seed.id === 'string' && seed.id.trim() ? seed.id.trim() : `module_${Date.now()}`,
    name: typeof seed.name === 'string' && seed.name.trim() ? seed.name.trim() : 'Workspace Module',
    description: typeof seed.description === 'string' ? seed.description : '',
    category: sanitizeModuleCategory(seed.category),
    tags: Array.isArray(seed.tags) ? seed.tags.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim()) : [],
    lineage: sanitizeModuleLineage(seed.lineage),
    branchTargets: sanitizeIdentifierList(seed.branchTargets),
    recommendedProfile: typeof seed.recommendedProfile === 'string' ? seed.recommendedProfile.trim().replace(/[^A-Za-z0-9_:-]/g, '') : '',
    themeHints: sanitizeIdentifierList(seed.themeHints),
    compatibilityNotes: typeof seed.compatibilityNotes === 'string' ? seed.compatibilityNotes : '',
    origin: seed.origin === 'artifact' ? 'artifact' : 'workspace',
    artifactRef: typeof seed.artifactRef === 'string' && seed.artifactRef.trim() ? seed.artifactRef.trim() : null,
    promptStrips: sanitizePromptStripLibrary(Array.isArray(seed.promptStrips) ? seed.promptStrips : settings.promptStripLibrary),
    promptAssignments: sanitizeModulePromptAssignments(Array.isArray(seed.promptAssignments) ? seed.promptAssignments : collectModulePromptAssignmentsFromRuntime(settings, options.tabId)),
    subagentGroups: sanitizeSubagentLibrary(Array.isArray(seed.subagentGroups) ? seed.subagentGroups : settings.subagentLibrary),
    starterArtifacts: sanitizeModuleStarterArtifactRefs(Array.isArray(seed.starterArtifacts) ? seed.starterArtifacts : []),
    runtimeContext: sanitizeRuntimeContextEntries(Array.isArray(seed.runtimeContext) ? seed.runtimeContext : settings.runtimeContext),
    moduleDependencies: sanitizeIdentifierList(Array.isArray(seed.moduleDependencies) ? seed.moduleDependencies : []),
    moduleConflicts: sanitizeIdentifierList(Array.isArray(seed.moduleConflicts) ? seed.moduleConflicts : []),
    requiresSlots: sanitizeStringList(Array.isArray(seed.requiresSlots) ? seed.requiresSlots : [], MODULE_SLOT_NAME_RE) as ModuleSlotName[],
    providesSlots: sanitizeModuleSlotProvisions(Array.isArray(seed.providesSlots) ? seed.providesSlots : []),
    sceneSeeds: sanitizeSceneSeeds(Array.isArray(seed.sceneSeeds) ? seed.sceneSeeds : []),
    encounterSeeds: sanitizeEncounterSeeds(Array.isArray(seed.encounterSeeds) ? seed.encounterSeeds : []),
    locationSeeds: sanitizeLocationSeeds(Array.isArray(seed.locationSeeds) ? seed.locationSeeds : []),
    clockSeeds: sanitizeClockSeeds(Array.isArray(seed.clockSeeds) ? seed.clockSeeds : []),
    factionSeeds: sanitizeFactionSeeds(Array.isArray(seed.factionSeeds) ? seed.factionSeeds : []),
    hookSeeds: sanitizeHookSeeds(Array.isArray(seed.hookSeeds) ? seed.hookSeeds : []),
  };
}

function slugifyGraphPart(value: string, fallback = 'graph'): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_\-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
  return cleaned || fallback;
}

function shortScopeId(value: string | null | undefined, fallbackPrefix: string): string {
  if (value && value.trim()) {
    return slugifyGraphPart(value, fallbackPrefix).slice(0, 12);
  }
  return `${fallbackPrefix}_${Math.random().toString(36).slice(2, 8)}`;
}

export function inferScopeKind(parentProjectId?: string | null, parentNodeId?: string | null): GraphScopeKind {
  return parentProjectId || parentNodeId ? 'subgraph' : 'project';
}

export function buildScopePath(projectName: string, parentNodeId?: string | null): string {
  const base = slugifyGraphPart(projectName || 'graph', 'graph');
  if (!parentNodeId) return base;
  return `${slugifyGraphPart(parentNodeId, 'parent')}/${base}`;
}

export function isSubgraphTab(tab: Pick<Tab, 'scopeKind'>): boolean {
  return tab.scopeKind === 'subgraph';
}

export function makeEmptyRootTab(makeTabId: () => string, name = 'Nouveau Projet', projectMode: ProjectMode = 'langgraph'): Tab {
  const surface = getDefaultSurfaceForProjectMode(projectMode);
  return {
    id: makeTabId(),
    projectId: null,
    projectName: name,
    nodes: [],
    edges: [],
    isDirty: false,
    parentProjectId: null,
    parentTabId: null,
    parentNodeId: null,
    customStateSchema: [],
    graphBindings: [],
    isAsync: surface.isAsync,
    scopeKind: 'project',
    scopePath: buildScopePath(name),
    artifactType: surface.artifactType,
    executionProfile: surface.executionProfile,
    projectMode,
    runtimeSettings: defaultRuntimeSettings(projectMode),
  };
}

export function buildScopedGraphId(tab: Pick<Tab, 'id' | 'projectId' | 'projectName' | 'parentProjectId' | 'parentNodeId' | 'scopeKind' | 'artifactType'>): string {
  const namePart = slugifyGraphPart(tab.projectName || 'graph', 'graph').slice(0, 40);
  const projectPart = shortScopeId(tab.projectId ?? tab.parentProjectId ?? tab.id, 'project');
  const artifactPart = slugifyGraphPart(normalizeWorkspaceArtifactType(tab.artifactType, tab.scopeKind), 'graph').slice(0, 16);
  const localPart = tab.scopeKind === 'subgraph'
    ? shortScopeId(tab.parentNodeId ?? tab.id, 'subgraph')
    : shortScopeId(tab.id, 'tab');
  return `${artifactPart}__${namePart}__${projectPart}__${localPart}`.slice(0, 128);
}

export function createImportDiagnostic(partial: Partial<ImportDiagnostic> & Pick<ImportDiagnostic, 'status' | 'format' | 'title' | 'message'>): ImportDiagnostic {
  return {
    accepted: [],
    missing: [],
    fallbackUsed: false,
    partialRecovery: false,
    surfaceTruth: null,
    packageIncludes: [],
    packageExcludes: [],
    ...partial,
  };
}

export function buildSurfaceTruthSummary(surface: {
  artifactType?: string | null;
  executionProfile?: string | null;
  projectMode?: string | null;
}): SurfaceTruthSummary {
  const artifactType = typeof surface.artifactType === 'string' ? surface.artifactType : null;
  const executionProfile = typeof surface.executionProfile === 'string' ? surface.executionProfile : null;
  const projectMode = normalizeProjectMode(surface.projectMode, artifactType as ArtifactType | null | undefined, executionProfile as ExecutionProfile | null | undefined);
  const compileSafe = projectModeAllowsCompile(projectMode);
  const runtimeEnabled = projectModeAllowsRuntime(projectMode);
  const editorOnly = Boolean(getModeContract(projectMode).editorOnly) || !runtimeEnabled;
  let summary = 'Compile-safe on the default LangGraph trunk.';
  if (!compileSafe && editorOnly) {
    summary = 'Editor-only in this build.';
  } else if (compileSafe && editorOnly) {
    summary = 'Compile-capable, but in-app runtime stays disabled on this surface.';
  } else if (compileSafe && runtimeEnabled) {
    summary = 'Compile-safe and in-app runtime-enabled on this surface.';
  }
  return {
    artifactType,
    executionProfile,
    projectMode,
    compileSafe,
    runtimeEnabled,
    editorOnly,
    summary,
  };
}

export type ProjectPersistenceSummary = {
  saveEffectSummary: string;
  openEffectSummary: string;
  contrastSummary: string;
};

export function buildProjectPersistenceSummary(): ProjectPersistenceSummary {
  return {
    saveEffectSummary: 'Save in app updates the local app database with the editable workspace tree the current build understands: root graph, known child subgraphs, reopening metadata, and saved graph settings.',
    openEffectSummary: 'Open in Projects restores the saved editable workspace tree only. It reopens known child tabs and saved graph settings, but it does not recreate runtime state, installed packages, vector stores, secrets, or hidden environment state.',
    contrastSummary: 'Save in app updates the local project tree. Open in Projects rehydrates that saved editable workspace tree. Project packages move a portable workspace copy. Compile Python generates runnable code.',
  };
}

export function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function sanitizeImportedWorkspaceTab(raw: unknown, fallbackName: string, fallbackScopeKind: GraphScopeKind, fallbackProjectMode: ProjectMode = 'langgraph'): SerializedWorkspaceTab | null {
  if (!isObjectRecord(raw)) return null;
  const scopeKind: GraphScopeKind = raw.scopeKind === 'subgraph' ? 'subgraph' : fallbackScopeKind;
  const projectName = typeof raw.projectName === 'string' && raw.projectName.trim() ? raw.projectName : fallbackName;
  const artifactType: ArtifactType = normalizeWorkspaceArtifactType(raw.artifactType, scopeKind);
  const isAsync = typeof raw.isAsync === 'boolean' ? raw.isAsync : true;
  const parentNodeId = typeof raw.parentNodeId === 'string' ? raw.parentNodeId : null;
  const executionProfile = normalizeWorkspaceExecutionProfile(raw.executionProfile, isAsync, scopeKind, artifactType);
  const projectMode = normalizeProjectMode(raw.projectMode, artifactType, executionProfile) || fallbackProjectMode;
  return {
    projectId: typeof raw.projectId === 'string' ? raw.projectId : null,
    projectName,
    nodes: Array.isArray(raw.nodes) ? (raw.nodes as Node[]) : [],
    edges: Array.isArray(raw.edges) ? (raw.edges as Edge[]) : [],
    parentProjectId: typeof raw.parentProjectId === 'string' ? raw.parentProjectId : null,
    parentNodeId,
    customStateSchema: Array.isArray(raw.customStateSchema) ? (raw.customStateSchema as SerializedWorkspaceTab['customStateSchema']) : [],
    graphBindings: Array.isArray(raw.graphBindings) ? (raw.graphBindings as GraphBinding[]) : [],
    isAsync,
    scopeKind,
    scopePath: typeof raw.scopePath === 'string' && raw.scopePath.trim() ? raw.scopePath : buildScopePath(projectName, parentNodeId),
    artifactType,
    executionProfile,
    projectMode,
    runtimeSettings: sanitizeRuntimeSettings(isObjectRecord(raw.runtimeSettings) ? (raw.runtimeSettings as Partial<RuntimeSettings>) : undefined, projectMode),
  };
}

export function parseWorkspaceSnapshotForImport(raw: unknown): { snapshot: WorkspaceTreeSnapshot | null; warnings: string[]; missing: string[] } {
  if (!isObjectRecord(raw)) {
    return { snapshot: null, warnings: [], missing: ['workspace tree'] };
  }
  const root = sanitizeImportedWorkspaceTab(raw.root, typeof raw.projectName === 'string' ? raw.projectName : 'Imported Project', 'project');
  if (!root) {
    return { snapshot: null, warnings: [], missing: ['root graph'] };
  }
  const warnings: string[] = [];
  const missing: string[] = [];
  const childrenRaw = raw.children;
  if (!Array.isArray(childrenRaw)) {
    warnings.push('Child subgraph list was missing; restored the root graph only.');
  }
  const children = Array.isArray(childrenRaw)
    ? childrenRaw
        .map((child, index) => sanitizeImportedWorkspaceTab(child, `Imported Subgraph ${index + 1}`, 'subgraph', root.projectMode))
        .filter((child): child is SerializedWorkspaceTab => child !== null)
    : [];
  if (Array.isArray(childrenRaw) && children.length < childrenRaw.length) {
    warnings.push('Some child subgraph rows were damaged and were skipped during import.');
    missing.push('one or more child subgraphs');
  }
  const activeScopeKey = typeof raw.activeScopeKey === 'string' ? raw.activeScopeKey : null;
  const openChildScopeKeys = Array.isArray(raw.openChildScopeKeys)
    ? raw.openChildScopeKeys.filter((value): value is string => typeof value === 'string')
    : [];
  return {
    snapshot: {
      version: 'langsuite.v21.workspace',
      root,
      children,
      activeScopeKey,
      openChildScopeKeys,
    },
    warnings,
    missing,
  };
}

export function buildInvalidImportDiagnostic(reason: string, missing: string[] = []): ImportDiagnostic {
  return createImportDiagnostic({
    status: 'error',
    format: 'invalid',
    title: 'Import failed',
    message: reason,
    missing,
  });
}

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
import type { GraphBinding, ImportDiagnostic, ModuleLibraryCategory, ModuleLibraryEntry, ModulePromptAssignmentPreset, ModuleStarterArtifactRef, PromptAssignmentTarget, PromptStripAssignment, PromptStripDefinition, PromptStripMergeMode, PromptStripVariableDefinition, RuntimeSettings, SerializedWorkspaceTab, SurfaceTruthSummary, Tab, WorkspaceTreeSnapshot, SubagentDefinition, SubagentGroupDefinition } from './types';

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

function sanitizeModuleCategory(raw: unknown): ModuleLibraryCategory {
  return raw === 'world' || raw === 'rules' || raw === 'persona' || raw === 'party' || raw === 'utility' ? raw : 'mixed';
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

function sanitizePromptStripAssignment(raw: unknown, index: number, fallbackTabId = 'active_tab'): PromptStripAssignment | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const target = sanitizePromptAssignmentTarget(data.target, fallbackTabId);
  const stripId = typeof data.stripId === 'string' ? data.stripId.trim() : '';
  if (!target || !stripId) return null;
  const mergeMode: PromptStripMergeMode = data.mergeMode === 'append' || data.mergeMode === 'replace_if_empty' ? data.mergeMode : 'prepend';
  return {
    id: typeof data.id === 'string' && data.id.trim() ? data.id.trim() : `prompt_assignment_${index + 1}`,
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
    if (seen.has(sanitized.id)) return;
    seen.add(sanitized.id);
    assignments.push(sanitized);
  });
  return assignments;
}

export function buildPromptAssignmentTargetKey(target: PromptAssignmentTarget): string {
  if (target.kind === 'graph') return `graph:${target.tabId}`;
  if (target.kind === 'node') return `node:${target.tabId}:${target.nodeId}`;
  return `subagent:${target.tabId}:${target.groupName}:${target.agentName}`;
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
  return assignments.flatMap((assignment, index) => {
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
      id: `${moduleEntry.id}__${preset.id || `preset_${index + 1}`}__${targetKey}`.replace(/[^a-zA-Z0-9_:\-]/g, '_'),
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
  return sanitizeRuntimeSettings({
    ...settings,
    promptStripLibrary: mergePromptStripLibraries(settings.promptStripLibrary || [], moduleEntry.promptStrips || []),
    promptStripAssignments: mergePromptAssignmentsFromModule(settings.promptStripAssignments || [], moduleEntry, options.tabId),
    subagentLibrary: mergeSubagentLibraries(settings.subagentLibrary || [], moduleEntry.subagentGroups || []),
    runtimeContext: mergeRuntimeContextLists(settings.runtimeContext || [], moduleEntry.runtimeContext || []),
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

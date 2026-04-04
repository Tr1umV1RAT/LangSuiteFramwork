import type { RuntimeSettings, ModuleLibraryEntry, PromptStripDefinition, SubagentGroupDefinition } from '../store/types';

export interface ObsidianGraphNode {
  id: string;
  label: string;
  path: string;
  group: 'hub' | 'module' | 'prompt' | 'cast' | 'agent' | 'scene';
  x: number;
  y: number;
}

export interface ObsidianGraphEdge {
  source: string;
  target: string;
}

export interface ObsidianGraphModel {
  nodes: ObsidianGraphNode[];
  edges: ObsidianGraphEdge[];
  width: number;
  height: number;
}

function findContextValue(runtimeSettings: RuntimeSettings | null | undefined, key: string): string | null {
  const hit = (runtimeSettings?.runtimeContext || []).find((entry) => entry.key === key);
  return hit?.value || null;
}

function prettify(value: string): string {
  return value.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function getLoadedModules(runtimeSettings?: RuntimeSettings | null): ModuleLibraryEntry[] {
  if (!runtimeSettings) return [];
  const ids = new Set(runtimeSettings.loadedModuleIds || []);
  return (runtimeSettings.moduleLibrary || []).filter((entry) => ids.has(entry.id));
}

function activePromptStrips(runtimeSettings?: RuntimeSettings | null): PromptStripDefinition[] {
  if (!runtimeSettings) return [];
  const activeIds = new Set((runtimeSettings.promptStripAssignments || []).filter((item) => item.enabled !== false).map((item) => item.stripId));
  return (runtimeSettings.promptStripLibrary || []).filter((item) => activeIds.has(item.id));
}

function loadedCastGroups(runtimeSettings?: RuntimeSettings | null): SubagentGroupDefinition[] {
  return runtimeSettings?.subagentLibrary || [];
}

export function buildObsidianGraph(runtimeSettings?: RuntimeSettings | null, graphName = 'Tabletop Session'): ObsidianGraphModel {
  const loadedModules = getLoadedModules(runtimeSettings);
  const prompts = activePromptStrips(runtimeSettings);
  const castGroups = loadedCastGroups(runtimeSettings);
  const currentScene = findContextValue(runtimeSettings, 'current_scene') || findContextValue(runtimeSettings, 'opening_location') || 'current_scene';

  const nodes: ObsidianGraphNode[] = [
    { id: 'session_hub', label: graphName, path: '00 Session Hub.md', group: 'hub', x: 560, y: 48 },
    { id: 'runtime', label: 'Graph Runtime', path: 'Graphs/Graph Runtime.md', group: 'hub', x: 160, y: 156 },
    { id: 'scene', label: prettify(currentScene), path: 'Scenes/Current Scene.md', group: 'scene', x: 560, y: 156 },
    { id: 'modules', label: 'Loaded Modules', path: 'Modules/Loaded Modules.md', group: 'hub', x: 960, y: 156 },
    { id: 'prompts', label: 'Active Prompt Strips', path: 'Prompts/Active Prompt Strips.md', group: 'prompt', x: 160, y: 344 },
  ];
  const edges: ObsidianGraphEdge[] = [
    { source: 'session_hub', target: 'runtime' },
    { source: 'session_hub', target: 'scene' },
    { source: 'session_hub', target: 'modules' },
    { source: 'session_hub', target: 'prompts' },
  ];

  const categoryColumns: Record<string, number> = {
    world: 760,
    rules: 920,
    persona: 1080,
    party: 1240,
    utility: 1400,
    mixed: 1560,
  };
  const categoryRows: Record<string, number> = {};
  loadedModules.forEach((entry) => {
    const row = categoryRows[entry.category] || 0;
    categoryRows[entry.category] = row + 1;
    const x = categoryColumns[entry.category] || categoryColumns.mixed;
    const y = 320 + row * 92;
    const nodeId = `module_${entry.id}`;
    nodes.push({
      id: nodeId,
      label: entry.name,
      path: `${prettify(entry.category)}s/${entry.name}.md`,
      group: 'module',
      x,
      y,
    });
    edges.push({ source: 'modules', target: nodeId });
  });

  prompts.slice(0, 8).forEach((entry, index) => {
    const nodeId = `prompt_${entry.id}`;
    nodes.push({
      id: nodeId,
      label: entry.name,
      path: `Prompts/${entry.name}.md`,
      group: 'prompt',
      x: 160,
      y: 436 + index * 86,
    });
    edges.push({ source: 'prompts', target: nodeId });
  });

  castGroups.forEach((group, groupIndex) => {
    const groupId = `cast_${group.name}`;
    const baseX = 420 + groupIndex * 260;
    const baseY = 344;
    nodes.push({
      id: groupId,
      label: prettify(group.name),
      path: `Cast/${prettify(group.name)}/Index.md`,
      group: 'cast',
      x: baseX,
      y: baseY,
    });
    edges.push({ source: 'session_hub', target: groupId });
    group.agents.forEach((agent, agentIndex) => {
      const agentId = `agent_${group.name}_${agent.name}`;
      nodes.push({
        id: agentId,
        label: prettify(agent.name),
        path: `Cast/${prettify(group.name)}/${prettify(agent.name)}.md`,
        group: 'agent',
        x: baseX,
        y: baseY + 92 + agentIndex * 76,
      });
      edges.push({ source: groupId, target: agentId });
    });
  });

  const width = Math.max(1760, ...nodes.map((node) => node.x + 220));
  const height = Math.max(860, ...nodes.map((node) => node.y + 120));
  return { nodes, edges, width, height };
}

export interface ProjectSummary {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  subgraph_count: number;
}

export interface ProjectFull extends ProjectSummary {
  data: string;
  parent_project_id: string | null;
  parent_node_id: string | null;
  subgraphs: SubgraphSummary[];
}

export interface SubgraphSummary {
  id: string;
  name: string;
  description: string;
  parent_node_id: string | null;
  created_at: string;
  updated_at: string;
}

const API_BASE = '/api';

export async function fetchProjects(): Promise<ProjectSummary[]> {
  const res = await fetch(`${API_BASE}/projects`);
  if (!res.ok) throw new Error('Failed to fetch projects');
  return res.json();
}

export async function fetchProject(id: string): Promise<ProjectFull> {
  const res = await fetch(`${API_BASE}/projects/${id}`);
  if (!res.ok) throw new Error('Project not found');
  return res.json();
}

export async function createProject(name: string, data: string = '{}'): Promise<ProjectFull> {
  const res = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, data }),
  });
  if (!res.ok) throw new Error('Failed to create project');
  return res.json();
}

export async function updateProject(
  id: string,
  updates: { name?: string; data?: string; description?: string },
): Promise<ProjectFull> {
  const res = await fetch(`${API_BASE}/projects/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Failed to update project');
  return res.json();
}

export async function deleteProject(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/projects/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete project');
}

export async function duplicateProject(id: string): Promise<ProjectFull> {
  const res = await fetch(`${API_BASE}/projects/${id}/duplicate`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to duplicate project');
  return res.json();
}

export async function fetchSubgraphs(id: string): Promise<SubgraphSummary[]> {
  const res = await fetch(`${API_BASE}/projects/${id}/subgraphs`);
  if (!res.ok) throw new Error('Failed to fetch subgraphs');
  return res.json();
}


export interface ProjectTreeNode extends ProjectFull {
  subgraphs: ProjectTreeNode[];
}

export async function fetchProjectTree(id: string): Promise<ProjectTreeNode> {
  const res = await fetch(`${API_BASE}/projects/${id}/tree`);
  if (!res.ok) throw new Error('Failed to fetch project tree');
  return res.json();
}

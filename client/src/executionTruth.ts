export type ToolExecutionStatus = 'preview' | 'applied' | 'partially_applied' | 'blocked' | 'failed' | 'succeeded';

export interface ToolObservation {
  toolkit: string;
  operation: string;
  status: ToolExecutionStatus;
  reasonCode: string | null;
  message: string | null;
  mode: string | null;
  path: string | null;
  root: string | null;
  outputKey: string | null;
  filesToModify: string[];
  filesToCreate: string[];
  filesRejected: Array<{ path?: string | null; reason_code?: string | null; message?: string | null }>;
  filesChanged: number | null;
  filesTouched: number | null;
  matchCount: number | null;
  replacementCount: number | null;
  exists: boolean | null;
  wouldCreate: boolean | null;
  wouldOverwrite: boolean | null;
  allowedCommands: string[];
  exitCode: number | null;
  stdout: string | null;
  stderr: string | null;
  raw: Record<string, unknown>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function asRejectedEntries(value: unknown): Array<{ path?: string | null; reason_code?: string | null; message?: string | null }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item) => ({
      path: typeof item.path === 'string' ? item.path : null,
      reason_code: typeof item.reason_code === 'string' ? item.reason_code : null,
      message: typeof item.message === 'string' ? item.message : null,
    }));
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function parseToolObservation(value: unknown): ToolObservation | null {
  const parsed = parseMaybeJson(value);
  const record = asRecord(parsed);
  if (!record) return null;
  if (typeof record.toolkit !== 'string' || typeof record.operation !== 'string' || typeof record.status !== 'string') return null;
  const status = String(record.status) as ToolExecutionStatus;
  if (!['preview', 'applied', 'partially_applied', 'blocked', 'failed', 'succeeded'].includes(status)) return null;

  return {
    toolkit: String(record.toolkit),
    operation: String(record.operation),
    status,
    reasonCode: typeof record.reason_code === 'string' ? String(record.reason_code) : null,
    message: typeof record.message === 'string' ? String(record.message) : null,
    mode: typeof record.mode === 'string' ? String(record.mode) : null,
    path: typeof record.path === 'string' ? String(record.path) : null,
    root: typeof record.root === 'string' ? String(record.root) : null,
    outputKey: typeof record.output_key === 'string' ? String(record.output_key) : null,
    filesToModify: asStringArray(record.files_to_modify),
    filesToCreate: asStringArray(record.files_to_create),
    filesRejected: asRejectedEntries(record.files_rejected),
    filesChanged: asNullableNumber(record.files_changed),
    filesTouched: asNullableNumber(record.files_touched),
    matchCount: asNullableNumber(record.match_count),
    replacementCount: asNullableNumber(record.replacement_count),
    exists: typeof record.exists === 'boolean' ? record.exists : null,
    wouldCreate: typeof record.would_create === 'boolean' ? record.would_create : null,
    wouldOverwrite: typeof record.would_overwrite === 'boolean' ? record.would_overwrite : null,
    allowedCommands: asStringArray(record.allowed_commands),
    exitCode: asNullableNumber(record.exit_code),
    stdout: typeof record.stdout === 'string' ? String(record.stdout) : null,
    stderr: typeof record.stderr === 'string' ? String(record.stderr) : null,
    raw: record,
  };
}

export function isToolObservation(value: unknown): value is ToolObservation {
  return Boolean(parseToolObservation(value));
}

export function summarizeToolObservation(observation: ToolObservation): string {
  const prefix = observation.status.replace(/_/g, ' ');
  if (observation.toolkit === 'filesystem' && observation.operation === 'write_file') {
    const mode = observation.wouldCreate ? 'create' : observation.wouldOverwrite || observation.exists ? 'overwrite' : 'write';
    return `${prefix} · ${mode}${observation.path ? ` · ${observation.path}` : ''}`;
  }
  if (observation.toolkit === 'filesystem' && observation.operation === 'edit_file') {
    const count = observation.matchCount != null ? `${observation.matchCount} match${observation.matchCount === 1 ? '' : 'es'}` : 'match scan';
    return `${prefix} · ${count}${observation.path ? ` · ${observation.path}` : ''}`;
  }
  if (observation.toolkit === 'filesystem' && observation.operation === 'apply_patch') {
    const parts = [
      observation.filesToModify.length > 0 ? `${observation.filesToModify.length} modify` : null,
      observation.filesToCreate.length > 0 ? `${observation.filesToCreate.length} create` : null,
      observation.filesRejected.length > 0 ? `${observation.filesRejected.length} rejected` : null,
    ].filter(Boolean);
    return `${prefix} · patch${parts.length > 0 ? ` · ${parts.join(' · ')}` : ''}`;
  }
  if (observation.toolkit === 'shell' && observation.operation === 'shell_command') {
    const exit = observation.exitCode != null ? ` · exit ${observation.exitCode}` : '';
    return `${prefix} · shell${exit}`;
  }
  return `${prefix} · ${observation.toolkit}.${observation.operation}`;
}

export function describeToolObservationCounts(observation: ToolObservation): string[] {
  const counts: string[] = [];
  if (observation.filesToModify.length > 0) counts.push(`${observation.filesToModify.length} modify`);
  if (observation.filesToCreate.length > 0) counts.push(`${observation.filesToCreate.length} create`);
  if (observation.filesRejected.length > 0) counts.push(`${observation.filesRejected.length} rejected`);
  if (observation.filesChanged != null) counts.push(`${observation.filesChanged} changed`);
  if (observation.matchCount != null) counts.push(`${observation.matchCount} match${observation.matchCount === 1 ? '' : 'es'}`);
  if (observation.replacementCount != null) counts.push(`${observation.replacementCount} replacement${observation.replacementCount === 1 ? '' : 's'}`);
  if (observation.allowedCommands.length > 0 && observation.toolkit === 'shell') counts.push(`${observation.allowedCommands.length} allowed cmd${observation.allowedCommands.length === 1 ? '' : 's'}`);
  return counts;
}

export function collectToolObservationsFromObject(value: unknown, prefix = ''): Array<{ path: string; observation: ToolObservation }> {
  const record = asRecord(value);
  if (!record) return [];
  const results: Array<{ path: string; observation: ToolObservation }> = [];
  Object.entries(record).forEach(([key, child]) => {
    const nextPath = prefix ? `${prefix}.${key}` : key;
    const parsed = parseToolObservation(child);
    if (parsed) {
      results.push({ path: nextPath, observation: parsed });
      return;
    }
    const nested = asRecord(child);
    if (nested && nextPath.split('.').length <= 2) {
      results.push(...collectToolObservationsFromObject(nested, nextPath));
    }
  });
  return results;
}

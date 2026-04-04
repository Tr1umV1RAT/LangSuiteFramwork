type SurfaceTruthLike = {
  artifactType: string | null;
  executionProfile: string | null;
  projectMode: string | null;
  compileSafe: boolean;
  runtimeEnabled: boolean;
  editorOnly: boolean;
  summary: string;
};

type Props = {
  surfaceTruth: SurfaceTruthLike;
  className?: string;
  showArtifact?: boolean;
  showExecutionProfile?: boolean;
  testId?: string;
};

export default function SurfaceTruthBadges({
  surfaceTruth,
  className = '',
  showArtifact = true,
  showExecutionProfile = false,
  testId,
}: Props) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`.trim()} data-testid={testId}>
      <span
        className={`px-1.5 py-0.5 rounded border ${surfaceTruth.compileSafe ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200' : 'border-red-500/20 bg-red-500/10 text-red-200'}`}
      >
        {surfaceTruth.compileSafe ? 'compile-safe' : 'not compile-safe'}
      </span>
      <span
        className={`px-1.5 py-0.5 rounded border ${surfaceTruth.editorOnly ? 'border-amber-500/20 bg-amber-500/10 text-amber-200' : 'border-cyan-500/20 bg-cyan-500/10 text-cyan-200'}`}
      >
        {surfaceTruth.editorOnly ? 'editor-first' : 'runtime-enabled'}
      </span>
      {surfaceTruth.projectMode && (
        <span className="px-1.5 py-0.5 rounded border border-panel-border text-slate-300">
          mode: {surfaceTruth.projectMode}
        </span>
      )}
      {showArtifact && surfaceTruth.artifactType && (
        <span className="px-1.5 py-0.5 rounded border border-panel-border text-slate-300">
          artifact: {surfaceTruth.artifactType}
        </span>
      )}
      {showExecutionProfile && surfaceTruth.executionProfile && (
        <span className="px-1.5 py-0.5 rounded border border-panel-border text-slate-300">
          profile: {surfaceTruth.executionProfile}
        </span>
      )}
    </div>
  );
}

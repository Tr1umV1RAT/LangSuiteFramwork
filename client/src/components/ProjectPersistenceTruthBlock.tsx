import type { ProjectPersistenceSummary } from '../store/workspace';

export default function ProjectPersistenceTruthBlock({
  summary,
  className = '',
  showSave = true,
  showOpen = true,
  showContrast = true,
  testIdPrefix = 'project-persistence',
}: {
  summary: ProjectPersistenceSummary;
  className?: string;
  showSave?: boolean;
  showOpen?: boolean;
  showContrast?: boolean;
  testIdPrefix?: string;
}) {
  return (
    <div className={`space-y-1.5 rounded-lg border border-panel-border bg-black/20 px-3 py-2 text-[11px] leading-5 ${className}`.trim()}>
      {showSave && <p className="text-slate-300" data-testid={`${testIdPrefix}-save-truth`}>{summary.saveEffectSummary}</p>}
      {showOpen && <p className="text-slate-400" data-testid={`${testIdPrefix}-open-truth`}>{summary.openEffectSummary}</p>}
      {showContrast && <p className="text-slate-500" data-testid={`${testIdPrefix}-contrast-truth`}>{summary.contrastSummary}</p>}
    </div>
  );
}

import type { ProblemItem } from '../../types'

type ProblemsPanelProps = {
  problems: ProblemItem[]
  onSelect: (problem: ProblemItem) => void
  onClose: () => void
}

const severityStyles: Record<ProblemItem['severity'], string> = {
  error: 'bg-rose-500/15 text-rose-200 border-rose-400/30',
  warning: 'bg-amber-500/15 text-amber-200 border-amber-400/30',
  info: 'bg-sky-500/15 text-sky-200 border-sky-400/30',
  hint: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30',
}

export function ProblemsPanel({ problems, onSelect, onClose }: ProblemsPanelProps) {
  return (
    <div className="flex h-40 flex-col border-t border-white/10 bg-[#12131a]">
      <div className="flex items-center justify-between border-b border-white/5 px-3 py-2 text-xs uppercase tracking-[0.2em] text-white/50">
        <span>Problems ({problems.length})</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded px-2 py-1 text-[10px] text-white/50 hover:bg-white/10 hover:text-white/80"
        >
          Ocultar
        </button>
      </div>
      <div className="flex-1 overflow-auto px-2 py-2 text-xs text-white/70">
        {problems.length === 0 ? (
          <div className="rounded border border-white/10 bg-white/5 px-3 py-3 text-white/50">
            Sin problemas detectados.
          </div>
        ) : (
          <div className="space-y-2">
            {problems.map((problem, index) => (
              <button
                key={`${problem.filePath}:${problem.line}:${problem.column}:${index}`}
                type="button"
                onClick={() => onSelect(problem)}
                className="flex w-full items-center justify-between gap-3 rounded border border-white/10 bg-white/5 px-3 py-2 text-left hover:border-white/20 hover:bg-white/10"
              >
                <div className="min-w-0">
                  <div className="truncate text-white/80">{problem.message}</div>
                  <div className="mt-1 text-[10px] text-white/40">
                    {problem.filePath.split('/').pop()}:{problem.line}:{problem.column}
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] ${severityStyles[problem.severity]}`}
                >
                  {problem.severity}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

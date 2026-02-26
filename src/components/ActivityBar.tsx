type ActivityTab = 'explorer' | 'git' | 'kanban'

type ActivityBarProps = {
  active: ActivityTab
  onChange: (value: ActivityTab) => void
  gitStatus?: { isRepo: boolean; clean: boolean; changes: string[] } | null
}

export function ActivityBar({ active, onChange, gitStatus }: ActivityBarProps) {
  const hasRepo = Boolean(gitStatus?.isRepo)
  const changeCount = gitStatus?.changes?.length ?? 0
  return (
    <div className="flex h-full w-12 flex-col items-center gap-2 border-r border-white/5 bg-[#0f1015] py-3">
      {/* Explorer */}
      <button
        type="button"
        onClick={() => onChange('explorer')}
        className={`flex h-9 w-9 items-center justify-center rounded-md text-xs font-semibold ${
          active === 'explorer'
            ? 'bg-white/10 text-white'
            : 'text-white/50 hover:bg-white/5 hover:text-white/80'
        }`}
        title="Explorer"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
          <path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v2H3V6z" />
          <path d="M3 10h20v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8z" />
        </svg>
      </button>

      {/* Git */}
      <button
        type="button"
        onClick={() => onChange('git')}
        className={`relative flex h-9 w-9 items-center justify-center rounded-md text-xs font-semibold ${
          active === 'git'
            ? 'bg-white/10 text-white'
            : 'text-white/50 hover:bg-white/5 hover:text-white/80'
        }`}
        title="Git"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
          <path d="M3.5 12.5l6-6a2 2 0 0 1 2.8 0l7.2 7.2a2 2 0 0 1 0 2.8l-6 6a2 2 0 0 1-2.8 0l-7.2-7.2a2 2 0 0 1 0-2.8z" />
          <circle cx="9" cy="9" r="2.2" fill="#0f1015" />
          <circle cx="15" cy="15" r="2.2" fill="#0f1015" />
          <circle cx="12" cy="12" r="1.6" fill="#0f1015" />
        </svg>
        {hasRepo ? (
          changeCount > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-emerald-400 px-1 text-[9px] font-semibold text-black">
              {Math.min(changeCount, 9)}
            </span>
          ) : (
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-emerald-400" />
          )
        ) : null}
      </button>

      {/* Kanban */}
      <button
        type="button"
        onClick={() => onChange('kanban')}
        className={`flex h-9 w-9 items-center justify-center rounded-md text-xs font-semibold ${
          active === 'kanban'
            ? 'bg-white/10 text-white'
            : 'text-white/50 hover:bg-white/5 hover:text-white/80'
        }`}
        title="Agent Kanban"
      >
        {/* Kanban columns icon */}
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
          <rect x="2" y="3" width="5" height="18" rx="1.5" opacity="0.9" />
          <rect x="9.5" y="3" width="5" height="12" rx="1.5" opacity="0.9" />
          <rect x="17" y="3" width="5" height="7" rx="1.5" opacity="0.9" />
        </svg>
      </button>
    </div>
  )
}

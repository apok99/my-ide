import type { ReactNode } from 'react'

type ActivityBarProps = {
  active: 'explorer' | 'git'
  onChange: (value: 'explorer' | 'git') => void
}

export function ActivityBar({ active, onChange }: ActivityBarProps) {
  return (
    <div className="flex h-full w-12 flex-col items-center gap-2 border-r border-white/5 bg-[#0f1015] py-3">
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
      <button
        type="button"
        onClick={() => onChange('git')}
        className={`flex h-9 w-9 items-center justify-center rounded-md text-xs font-semibold ${
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
      </button>
    </div>
  )
}

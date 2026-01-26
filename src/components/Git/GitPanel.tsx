import type { FileNode } from '../../types'

type GitStatus = { isRepo: boolean; clean: boolean; changes: string[]; error?: string }

type GitPanelProps = {
  rootPath: string | null
  status: GitStatus | null
  branch: string
  remote: string
  log: string | null
  message: string
  onMessageChange: (value: string) => void
  onInit: () => void
  onCommit: () => void
  onAutoCommit: () => void
  onPull: () => void
  onPush: () => void
  onRefresh: () => void
  onOpenDiff: (filePath: string) => void
  onOpenRemote: () => void
  isElectron: boolean
}

export function GitPanel({
  rootPath,
  status,
  branch,
  remote,
  log,
  message,
  onMessageChange,
  onInit,
  onCommit,
  onAutoCommit,
  onPull,
  onPush,
  onRefresh,
  onOpenDiff,
  onOpenRemote,
  isElectron,
}: GitPanelProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
          Source Control
        </span>
        <button
          onClick={onAutoCommit}
          className="rounded border border-blue-400/30 bg-blue-500/15 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-200 hover:bg-blue-500/25"
          title="Auto Commit"
        >
          Auto Commit
        </button>
      </div>

      <div className="flex-1 overflow-auto px-4 py-4 text-xs text-white/70">
        <div className="rounded border border-white/10 bg-white/5 px-3 py-4 text-white/60">
          Use Auto Commit to let Codex generate a commit message and push the latest changes.
        </div>
        {log ? (
          <div className="mt-3 rounded border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/60">
            {log}
          </div>
        ) : null}
      </div>
    </div>
  )
}

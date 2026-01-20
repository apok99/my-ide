import type { FileNode } from '../../types'

type GitStatus = { isRepo: boolean; clean: boolean; changes: string[] }

type GitPanelProps = {
  rootPath: string | null
  status: GitStatus | null
  message: string
  onMessageChange: (value: string) => void
  onInit: () => void
  onCommit: () => void
  onAutoCommit: () => void
  onPull: () => void
  onPush: () => void
  onRefresh: () => void
  onOpenDiff: (filePath: string) => void
  isElectron: boolean
}

export function GitPanel({
  rootPath,
  status,
  message,
  onMessageChange,
  onInit,
  onCommit,
  onAutoCommit,
  onPull,
  onPush,
  onRefresh,
  onOpenDiff,
  isElectron,
}: GitPanelProps) {
  const parsePath = (line: string) => {
    const payload = line.slice(3)
    if (payload.includes(' -> ')) {
      return payload.split(' -> ').pop() ?? payload
    }
    return payload
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">Source Control</span>
        {!rootPath || !isElectron ? null : status?.isRepo ? (
          <span className="text-emerald-300/80 text-xs">
            {status.clean ? 'Clean' : `${status.changes.length} changes`}
          </span>
        ) : (
          <span className="text-yellow-300/80 text-xs">No repo</span>
        )}
        <button
          onClick={onRefresh}
          className="rounded px-2 py-1 text-[10px] text-white/50 hover:bg-white/10"
          title="Refresh"
        >
          ⟳
        </button>
      </div>

      <div className="flex-1 overflow-auto px-4 py-3 text-xs text-white/70">
        {!rootPath || !isElectron ? (
          <div className="text-white/40">Open a project to use Git.</div>
        ) : status?.isRepo ? (
          <div className="flex flex-col gap-3">
            <div className="text-[11px] uppercase tracking-wider text-white/40">Message</div>
            <textarea
              className="min-h-[72px] w-full resize-none rounded border border-white/10 bg-transparent px-2 py-2 text-xs text-white/80 outline-none"
              placeholder="Commit message"
              value={message}
              onChange={(event) => onMessageChange(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <button
                onClick={onCommit}
                className="rounded bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/70 hover:bg-white/20"
                disabled={!message}
              >
                Commit
              </button>
              <button
                onClick={onAutoCommit}
                className="rounded bg-blue-600/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-blue-300 hover:bg-blue-600/30"
              >
                Auto Commit
              </button>
              <button
                onClick={onPull}
                className="rounded bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/70 hover:bg-white/20"
              >
                Pull
              </button>
              <button
                onClick={onPush}
                className="rounded bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/70 hover:bg-white/20"
              >
                Push
              </button>
            </div>
            <div className="mt-2 text-[11px] uppercase tracking-wider text-white/40">Changes</div>
            <div className="space-y-1">
              {status.changes.length === 0 ? (
                <div className="text-white/30">No changes</div>
              ) : (
                status.changes.slice(0, 200).map((line) => {
                  const filePath = parsePath(line)
                  return (
                    <button
                      type="button"
                      key={line}
                      onClick={() => onOpenDiff(filePath)}
                      className="flex w-full items-center gap-2 text-left text-white/70 hover:text-white"
                    >
                      <span className="w-6 text-[10px] text-white/40">{line.slice(0, 2)}</span>
                      <span className="truncate">{filePath}</span>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        ) : (
          <div>
            <button
              onClick={onInit}
              className="rounded bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/70 hover:bg-white/20"
            >
              Init Repo
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

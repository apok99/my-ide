import { useState } from 'react'

type GitStatus = { isRepo: boolean; clean: boolean; changes: string[]; error?: string }

type GitPanelProps = {
  rootPath: string | null
  status: GitStatus | null
  branch: string
  branches: string[]
  selectedBranch: string
  mergeSource: string
  remote: string
  log: string | null
  message: string
  onMessageChange: (value: string) => void
  onInit: () => void
  onCommit: () => void
  onAutoCommit: () => void
  onPull: () => void
  onPush: () => void
  onSelectBranch: (value: string) => void
  onCreateBranch: (name: string) => void
  onCheckoutBranch: (name: string) => void
  onSelectMergeSource: (value: string) => void
  onMergeBranches: () => void
  onRefresh: () => void
  onOpenDiff: (filePath: string) => void
  onOpenRemote: () => void
  isElectron: boolean
}

export function GitPanel(props: GitPanelProps) {
  const {
    rootPath,
    status,
    branch,
    branches,
    selectedBranch,
    mergeSource,
    log,
    onOpenDiff,
    onCommit,
    onPull,
    onPush,
    onSelectBranch,
    onCreateBranch,
    onCheckoutBranch,
    onSelectMergeSource,
    onMergeBranches,
    message,
    onMessageChange,
  } = props
  const [newBranch, setNewBranch] = useState('')
  const normalizedRoot = rootPath
    ? rootPath.endsWith('/') || rootPath.endsWith('\\')
      ? rootPath.slice(0, -1)
      : rootPath
    : null
  const pathSeparator = normalizedRoot?.includes('\\') ? '\\' : '/'

  const changes = (status?.changes ?? [])
    .map((line) => {
      const trimmed = line.trim()
      if (!trimmed) {
        return null
      }
      const statusCode = trimmed.slice(0, 2)
      let pathPart = trimmed.slice(2).trim()
      if (!pathPart) {
        return null
      }
      if (pathPart.startsWith('"') && pathPart.endsWith('"')) {
        pathPart = pathPart.slice(1, -1)
      }
      let relativePath = pathPart
      let displayPath = pathPart
      if (pathPart.includes(' -> ')) {
        const [from, to] = pathPart.split(' -> ')
        relativePath = to?.trim() || from?.trim() || pathPart
        displayPath = `${from?.trim() ?? ''} -> ${to?.trim() ?? ''}`.trim()
      }
      const absolutePath = normalizedRoot
        ? `${normalizedRoot}${pathSeparator}${relativePath}`
        : relativePath
      return {
        status: statusCode,
        displayPath,
        absolutePath,
      }
    })
    .filter((item): item is { status: string; displayPath: string; absolutePath: string } =>
      Boolean(item),
    )

  const renderStatusBadge = (code: string) => {
    const normalized = code.trim() || code
    const mainCode = normalized === '??' ? '??' : normalized[0] || normalized
    const labelMap: Record<string, string> = {
      M: 'Modificado',
      A: 'Agregado',
      D: 'Eliminado',
      R: 'Renombrado',
      C: 'Copiado',
      U: 'Conflicto',
      '??': 'Nuevo',
    }
    const label = labelMap[mainCode] ?? normalized
    const colorMap: Record<string, string> = {
      M: 'bg-amber-500/20 text-amber-200 border-amber-400/30',
      A: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30',
      D: 'bg-rose-500/20 text-rose-200 border-rose-400/30',
      R: 'bg-sky-500/20 text-sky-200 border-sky-400/30',
      C: 'bg-sky-500/20 text-sky-200 border-sky-400/30',
      U: 'bg-rose-500/20 text-rose-200 border-rose-400/30',
      '??': 'bg-indigo-500/20 text-indigo-200 border-indigo-400/30',
    }
    const classes = colorMap[mainCode] ?? 'bg-white/5 text-white/70 border-white/10'
    return (
      <span className={`rounded border px-1.5 py-0.5 text-[10px] uppercase ${classes}`}>
        {label}
      </span>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
          Source Control
        </span>
        {status?.isRepo ? (
          <span className="text-[10px] text-white/50">{branch || 'Git'}</span>
        ) : null}
      </div>

      <div className="flex-1 overflow-auto px-4 py-4 text-xs text-white/70">
        <div className="mb-4 rounded border border-white/10 bg-white/5 px-3 py-3">
          <label className="text-[10px] uppercase tracking-[0.2em] text-white/50">Mensaje</label>
          <textarea
            className="mt-2 min-h-[72px] w-full resize-none rounded border border-white/10 bg-transparent px-2 py-2 text-xs text-white/80 outline-none focus:border-emerald-500/40"
            placeholder="Escribe el mensaje del commit"
            value={message}
            onChange={(event) => onMessageChange(event.target.value)}
          />
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            onClick={onCommit}
            className="rounded border border-emerald-400/30 bg-emerald-500/15 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-100 hover:bg-emerald-500/25"
            title="Commit"
            disabled={!message}
          >
            Commit
          </button>
          <button
            onClick={onPull}
            className="rounded border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70 hover:bg-white/10"
            title="Pull"
          >
            Pull
          </button>
          <button
            onClick={onPush}
            className="rounded border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70 hover:bg-white/10"
            title="Push"
          >
            Push
          </button>
        </div>

        {!rootPath ? (
          <div className="rounded border border-white/10 bg-white/5 px-3 py-4 text-white/60">
            Abre una carpeta para ver el estado de Git.
          </div>
        ) : status?.error ? (
          <div className="rounded border border-rose-400/30 bg-rose-500/10 px-3 py-4 text-rose-200">
            Error de Git: {status.error}
          </div>
        ) : status && !status.isRepo ? (
          <div className="rounded border border-white/10 bg-white/5 px-3 py-4 text-white/60">
            No se detecto un repositorio Git en esta carpeta.
          </div>
        ) : null}

        {status?.isRepo ? (
          <div className="space-y-3">
            <div className="text-[11px] uppercase tracking-[0.2em] text-white/40">
              Cambios
            </div>
            {changes.length === 0 ? (
              <div className="rounded border border-white/10 bg-white/5 px-3 py-4 text-white/60">
                No hay cambios por ahora.
              </div>
            ) : (
              <div className="space-y-2">
                {changes.map((change) => (
                  <button
                    key={`${change.status}-${change.absolutePath}`}
                    type="button"
                    onClick={() => onOpenDiff(change.absolutePath)}
                    className="flex w-full items-center justify-between gap-3 rounded border border-white/10 bg-white/5 px-3 py-2 text-left text-[12px] text-white/80 hover:border-white/20 hover:bg-white/10"
                  >
                    <span className="truncate">{change.displayPath}</span>
                    {renderStatusBadge(change.status)}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {log ? (
          <div className="mb-4 mt-3 rounded border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/60">
            {log}
          </div>
        ) : null}

        <div className="mb-4 rounded border border-white/10 bg-white/5 px-3 py-3">
          <label className="text-[10px] uppercase tracking-[0.2em] text-white/50">Ramas</label>
          <div className="mt-2 flex flex-col gap-2">
            <div className="flex flex-col gap-2">
              <select
                className="w-full rounded border border-white/10 bg-transparent px-2 py-1 text-xs text-white/80 outline-none focus:border-emerald-500/40"
                value={selectedBranch}
                onChange={(event) => onSelectBranch(event.target.value)}
                disabled={!status?.isRepo || branches.length === 0}
              >
                {branches.length === 0 ? (
                  <option value="">Sin ramas</option>
                ) : (
                  branches.map((item) => (
                    <option key={item} value={item}>
                      {item}
                      {item === branch ? ' (actual)' : ''}
                    </option>
                  ))
                )}
              </select>
              <button
                onClick={() => onCheckoutBranch(selectedBranch)}
                className="w-full rounded border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                title="Checkout"
                disabled={!status?.isRepo || !selectedBranch || selectedBranch === branch}
              >
                Checkout
              </button>
            </div>
            <div className="flex flex-col gap-2">
              <input
                className="w-full rounded border border-white/10 bg-transparent px-2 py-1 text-xs text-white/80 outline-none focus:border-emerald-500/40"
                placeholder="Nueva rama"
                value={newBranch}
                onChange={(event) => setNewBranch(event.target.value)}
                disabled={!status?.isRepo}
              />
              <button
                onClick={() => {
                  const trimmed = newBranch.trim()
                  if (!trimmed) {
                    return
                  }
                  onCreateBranch(trimmed)
                  setNewBranch('')
                }}
                className="w-full rounded border border-emerald-400/30 bg-emerald-500/15 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-100 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                title="Crear rama"
                disabled={!status?.isRepo || !newBranch.trim()}
              >
                Crear
              </button>
            </div>
            <div className="flex items-center gap-2">
              <select
                className="flex-1 rounded border border-white/10 bg-transparent px-2 py-1 text-xs text-white/80 outline-none focus:border-emerald-500/40"
                value={mergeSource}
                onChange={(event) => onSelectMergeSource(event.target.value)}
                disabled={!status?.isRepo || branches.length === 0}
              >
                {branches.length === 0 ? (
                  <option value="">Sin ramas</option>
                ) : (
                  branches
                    .filter((item) => item !== selectedBranch)
                    .map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))
                )}
              </select>
              <button
                onClick={onMergeBranches}
                className="rounded border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                title="Merge"
                disabled={!status?.isRepo || !mergeSource || !selectedBranch || mergeSource === selectedBranch}
              >
                Merge
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

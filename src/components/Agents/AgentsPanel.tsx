import { useCallback, useEffect, useMemo, useState } from 'react'

type AgentStatus = 'pending' | 'in_progress' | 'blocked' | 'completed'

type AgentItem = {
  id: string
  name: string
  status: AgentStatus
  task: string
  repo?: string
  branch?: string
  activeFile?: string | null
  blocker?: string
  etaMinutes?: number | null
  updatedAt?: string
}

type AgentSnapshot = {
  seed?: {
    agents?: AgentItem[]
  }
}

type IdeAgentsReader = {
  readAgentsWork?: () => Promise<
    | { ok: true; content: string; sourcePath: string }
    | { ok: false; error: string }
  >
}

const statusLabel: Record<AgentStatus, string> = {
  pending: 'Pendiente',
  in_progress: 'En progreso',
  blocked: 'Bloqueado',
  completed: 'Completado',
}

const statusClass: Record<AgentStatus, string> = {
  pending: 'bg-slate-500/20 text-slate-200',
  in_progress: 'bg-blue-500/20 text-blue-200',
  blocked: 'bg-red-500/20 text-red-200',
  completed: 'bg-emerald-500/20 text-emerald-200',
}

const formatUpdatedAt = (value?: string) => {
  if (!value) {
    return 'Sin fecha'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Sin fecha'
  }
  const now = Date.now()
  const diffMs = Math.max(0, now - date.getTime())
  const diffMinutes = Math.floor(diffMs / (60 * 1000))
  if (diffMinutes < 1) {
    return 'Hace menos de 1 min'
  }
  if (diffMinutes < 60) {
    return `Hace ${diffMinutes} min`
  }
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) {
    return `Hace ${diffHours} h`
  }
  const diffDays = Math.floor(diffHours / 24)
  return `Hace ${diffDays} d`
}

export function AgentsPanel() {
  const [items, setItems] = useState<AgentItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | AgentStatus>('all')

  const loadAgentsFromFetch = useCallback(async (): Promise<AgentSnapshot> => {
    const baseUrl = import.meta.env.BASE_URL || './'
    const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
    const response = await fetch(`${normalizedBaseUrl}agents-work.json?t=${Date.now()}`)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    return (await response.json()) as AgentSnapshot
  }, [])

  const loadAgents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const ideReader = (window as Window & { ide?: IdeAgentsReader }).ide
      let data: AgentSnapshot
      if (ideReader) {
        if (!ideReader.readAgentsWork) {
          throw new Error(
            "El proceso principal de Electron no tiene 'ide:read-agents-work'. Reinicia Electron.",
          )
        }
        const result = await ideReader.readAgentsWork()
        if (!result.ok) {
          throw new Error(result.error || 'No se pudo leer agents-work.json')
        }
        data = JSON.parse(result.content) as AgentSnapshot
      } else {
        data = await loadAgentsFromFetch()
      }
      const nextItems = data.seed?.agents ?? []
      setItems(nextItems)
      setSelectedId((prev) => {
        if (prev && nextItems.some((item) => item.id === prev)) {
          return prev
        }
        return nextItems[0]?.id ?? null
      })
    } catch (err) {
      setError(`No se pudo cargar agents-work.json (${String(err)})`)
    } finally {
      setLoading(false)
    }
  }, [loadAgentsFromFetch])

  useEffect(() => {
    loadAgents()
  }, [loadAgents])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadAgents()
    }, 5000)
    return () => {
      window.clearInterval(intervalId)
    }
  }, [loadAgents])

  const filteredItems = useMemo(() => {
    if (filter === 'all') {
      return items
    }
    return items.filter((item) => item.status === filter)
  }, [filter, items])

  const selected = useMemo(
    () => filteredItems.find((item) => item.id === selectedId) ?? filteredItems[0] ?? null,
    [filteredItems, selectedId],
  )

  return (
    <div className="flex h-full flex-col bg-[#0f0f0f] text-white/90">
      <div className="border-b border-white/10 px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Agentes</p>
          <button
            type="button"
            onClick={loadAgents}
            className="rounded border border-white/15 px-2 py-1 text-[11px] text-white/80 hover:bg-white/10"
          >
            {loading ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {(['all', 'pending', 'in_progress', 'blocked', 'completed'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded px-2 py-1 text-[11px] ${
                filter === value
                  ? 'bg-white/20 text-white'
                  : 'bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            >
              {value === 'all' ? 'Todos' : statusLabel[value]}
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="px-3 py-2 text-xs text-red-300">{error}</p> : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {filteredItems.length === 0 ? (
          <p className="px-3 py-3 text-xs text-white/60">No hay agentes para este filtro.</p>
        ) : (
          <div className="space-y-2 p-3">
            {filteredItems.map((agent) => (
              <button
                key={agent.id}
                type="button"
                onClick={() => setSelectedId(agent.id)}
                className={`w-full rounded border p-2 text-left transition ${
                  selected?.id === agent.id
                    ? 'border-blue-400/60 bg-blue-500/10'
                    : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.07]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs font-semibold text-white">{agent.name}</p>
                  <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${statusClass[agent.status]}`}>
                    {statusLabel[agent.status]}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] text-white/70">{agent.task}</p>
                <p className="mt-1 text-[10px] text-white/50">{formatUpdatedAt(agent.updatedAt)}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected ? (
        <div className="border-t border-white/10 px-3 py-3 text-[11px] text-white/80">
          <p className="font-semibold text-white">{selected.name}</p>
          <p className="mt-1 text-white/70">{selected.task}</p>
          {selected.repo ? <p className="mt-2">Repo: <span className="text-white">{selected.repo}</span></p> : null}
          {selected.branch ? <p>Rama: <span className="text-white">{selected.branch}</span></p> : null}
          {selected.activeFile ? <p className="mt-1 truncate">Archivo: <span className="text-white">{selected.activeFile}</span></p> : null}
          {typeof selected.etaMinutes === 'number' ? <p className="mt-1">ETA: {selected.etaMinutes} min</p> : null}
          {selected.blocker ? <p className="mt-1 text-red-300">Bloqueo: {selected.blocker}</p> : null}
        </div>
      ) : null}
    </div>
  )
}

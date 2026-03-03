import { useState, useEffect, useCallback, useMemo, useRef } from 'react'

// Task board types
export type TaskStatus = 'todo' | 'doing' | 'review' | 'done' | 'blocked'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface KanbanTask {
  id: string
  title: string
  description?: string
  status: TaskStatus
  agent?: string
  priority?: TaskPriority
  tags?: string[]
  createdAt?: string
  updatedAt?: string
  blockedBy?: string
}

export interface KanbanData {
  version?: string
  updatedAt?: string
  tasks: KanbanTask[]
}

// Mission control types
export type AgentStatus = 'pending' | 'in_progress' | 'blocked' | 'completed'

export interface AgentItem {
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

interface AgentSnapshot {
  seed?: {
    agents?: AgentItem[]
  }
}

type AgentEventKind = 'started' | 'updated' | 'blocked' | 'completed' | 'removed' | 'snapshot'

interface AgentEvent {
  id: string
  kind: AgentEventKind
  agentId: string
  agentName: string
  message: string
  at: number
}

const TASK_COLUMNS: {
  id: TaskStatus
  label: string
  dotClass: string
  headerClass: string
  emptyClass: string
  pulseClass: string
}[] = [
  {
    id: 'todo',
    label: 'Todo',
    dotClass: 'bg-slate-400',
    headerClass: 'text-slate-300',
    emptyClass: 'border-slate-700/40',
    pulseClass: '',
  },
  {
    id: 'doing',
    label: 'Doing',
    dotClass: 'bg-blue-400',
    headerClass: 'text-blue-300',
    emptyClass: 'border-blue-700/40',
    pulseClass: 'animate-pulse',
  },
  {
    id: 'review',
    label: 'Review',
    dotClass: 'bg-yellow-400',
    headerClass: 'text-yellow-300',
    emptyClass: 'border-yellow-700/40',
    pulseClass: '',
  },
  {
    id: 'blocked',
    label: 'Blocked',
    dotClass: 'bg-red-500',
    headerClass: 'text-red-300',
    emptyClass: 'border-red-700/40',
    pulseClass: '',
  },
  {
    id: 'done',
    label: 'Done',
    dotClass: 'bg-emerald-400',
    headerClass: 'text-emerald-300',
    emptyClass: 'border-emerald-700/40',
    pulseClass: '',
  },
]

const MISSION_COLUMNS: {
  id: AgentStatus
  label: string
  countClass: string
  cardClass: string
}[] = [
  {
    id: 'pending',
    label: 'Pending',
    countClass: 'text-slate-300',
    cardClass: 'border-slate-400/20 bg-slate-400/5',
  },
  {
    id: 'in_progress',
    label: 'In Progress',
    countClass: 'text-blue-300',
    cardClass: 'border-blue-400/20 bg-blue-400/5',
  },
  {
    id: 'blocked',
    label: 'Blocked',
    countClass: 'text-red-300',
    cardClass: 'border-red-400/20 bg-red-400/5',
  },
  {
    id: 'completed',
    label: 'Completed',
    countClass: 'text-emerald-300',
    cardClass: 'border-emerald-400/20 bg-emerald-400/5',
  },
]

const AGENT_STATUS_LABEL: Record<AgentStatus, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  blocked: 'Blocked',
  completed: 'Completed',
}

const AGENT_STATUS_PILL: Record<AgentStatus, string> = {
  pending: 'bg-slate-500/20 text-slate-200 border-slate-500/40',
  in_progress: 'bg-blue-500/20 text-blue-200 border-blue-500/40',
  blocked: 'bg-red-500/20 text-red-200 border-red-500/40',
  completed: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40',
}

const EVENT_STYLE: Record<AgentEventKind, string> = {
  started: 'border-blue-500/30 bg-blue-500/10 text-blue-200',
  updated: 'border-white/15 bg-white/[0.04] text-white/80',
  blocked: 'border-red-500/40 bg-red-500/10 text-red-200',
  completed: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  removed: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  snapshot: 'border-violet-500/30 bg-violet-500/10 text-violet-200',
}

const PRIORITY_STYLE: Record<TaskPriority, string> = {
  high: 'bg-red-500/15 text-red-300 border-red-500/30',
  medium: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  low: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
}

const PRIORITY_ICON: Record<TaskPriority, string> = {
  high: '^',
  medium: '>',
  low: 'v',
}

const POLL_MS = 1500
const TASK_COL_WIDTH = 200

function timeAgo(dateStr?: string): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  if (diff < 0) return 'just now'
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function timeAgoFromTimestamp(timestamp: number): string {
  const diff = Date.now() - timestamp
  if (diff <= 0) return 'just now'
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function initials(name?: string): string {
  if (!name) return '?'
  return name
    .split(/[-_\s]/)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('')
}

function resolvePath(rootPath: string | null | undefined, path: string): string | null {
  if (!rootPath) return null
  const isAbsoluteUnix = path.startsWith('/')
  const isAbsoluteWin = /^[A-Za-z]:\\/.test(path)
  if (isAbsoluteUnix || isAbsoluteWin) {
    return path
  }
  const sep = rootPath.includes('\\') ? '\\' : '/'
  const normalizedPath = path.replace(/[\\/]/g, sep)
  return `${rootPath}${rootPath.endsWith(sep) ? '' : sep}${normalizedPath}`
}

function trimEvents(events: AgentEvent[]): AgentEvent[] {
  return events
    .sort((a, b) => b.at - a.at)
    .slice(0, 80)
}

function TaskCard({ task }: { task: KanbanTask }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      onClick={() => setExpanded((v) => !v)}
      className="cursor-pointer rounded-lg border border-white/[0.07] bg-white/[0.04] p-3 transition-all hover:border-white/[0.14] hover:bg-white/[0.07] active:scale-[0.98]"
    >
      <div className="mb-2 flex min-w-0 items-center justify-between gap-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          {task.agent && (
            <>
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/10 text-[8px] font-bold text-white/60">
                {initials(task.agent)}
              </span>
              <span className="truncate font-mono text-[9px] text-white/35">{task.agent}</span>
            </>
          )}
        </div>
        {task.priority && (
          <span
            className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-semibold ${PRIORITY_STYLE[task.priority]}`}
          >
            {PRIORITY_ICON[task.priority]} {task.priority}
          </span>
        )}
      </div>

      <p className="text-[11px] font-medium leading-snug text-white/85">{task.title}</p>

      {expanded && task.description && (
        <p className="mt-2 text-[10px] leading-relaxed text-white/45">{task.description}</p>
      )}

      {task.blockedBy && (
        <p className="mt-1.5 flex items-start gap-1 text-[10px] text-red-400/80">
          <span className="shrink-0">!</span>
          <span>{task.blockedBy}</span>
        </p>
      )}

      {task.tags && task.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.tags.map((tag) => (
            <span
              key={tag}
              className="rounded border border-white/[0.08] bg-white/[0.06] px-1.5 py-0.5 text-[9px] text-white/30"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {task.updatedAt && <p className="mt-2 text-[9px] text-white/20">{timeAgo(task.updatedAt)}</p>}
    </div>
  )
}

function TaskColumn({
  col,
  tasks,
}: {
  col: (typeof TASK_COLUMNS)[number]
  tasks: KanbanTask[]
}) {
  return (
    <div className="flex flex-col" style={{ width: TASK_COL_WIDTH, flexShrink: 0 }}>
      <div className="mb-3 flex items-center gap-2 px-0.5">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${col.dotClass} ${
            col.id === 'doing' && tasks.length > 0 ? col.pulseClass : ''
          }`}
        />
        <span className={`text-[10px] font-semibold uppercase tracking-wider ${col.headerClass}`}>
          {col.label}
        </span>
        <span className="ml-auto font-mono text-[10px] text-white/20">{tasks.length}</span>
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto pr-0.5">
        {tasks.length === 0 ? (
          <div className={`rounded-lg border border-dashed py-8 text-center ${col.emptyClass}`}>
            <span className="text-[10px] text-white/15">-</span>
          </div>
        ) : (
          tasks.map((task) => <TaskCard key={task.id} task={task} />)
        )}
      </div>
    </div>
  )
}

function AgentMiniCard({
  agent,
  isSelected,
  onSelect,
}: {
  agent: AgentItem
  isSelected: boolean
  onSelect: (id: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(agent.id)}
      className={`w-full rounded-md border p-2 text-left transition ${
        isSelected
          ? 'border-blue-400/60 bg-blue-500/15'
          : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.08]'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[11px] font-semibold text-white">{agent.name}</p>
        <span className={`rounded border px-1.5 py-0.5 text-[9px] ${AGENT_STATUS_PILL[agent.status]}`}>
          {AGENT_STATUS_LABEL[agent.status]}
        </span>
      </div>
      <p className="mt-1 line-clamp-2 text-[10px] text-white/70">{agent.task}</p>
      {agent.activeFile ? (
        <p className="mt-1 truncate font-mono text-[9px] text-white/45">{agent.activeFile}</p>
      ) : (
        <p className="mt-1 text-[9px] text-white/35">No active file</p>
      )}
    </button>
  )
}

function MissionStatusColumn({
  column,
  agents,
  selectedId,
  onSelect,
}: {
  column: (typeof MISSION_COLUMNS)[number]
  agents: AgentItem[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <section className={`flex min-h-[220px] flex-col rounded-lg border p-2 ${column.cardClass}`}>
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">{column.label}</p>
        <span className={`text-[11px] font-semibold ${column.countClass}`}>{agents.length}</span>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {agents.length === 0 ? (
          <div className="rounded-md border border-dashed border-white/10 py-6 text-center text-[10px] text-white/30">
            No agents
          </div>
        ) : (
          agents.map((agent) => (
            <AgentMiniCard
              key={agent.id}
              agent={agent}
              isSelected={selectedId === agent.id}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </section>
  )
}

interface KanbanPanelProps {
  rootPath?: string | null
}

export function KanbanPanel({ rootPath }: KanbanPanelProps) {
  const storageKey = rootPath ? `dms.kanban.path.${rootPath}` : 'dms.kanban.path'
  const viewStorageKey = rootPath ? `dms.kanban.view.${rootPath}` : 'dms.kanban.view'
  const [filePath, setFilePath] = useState(
    () => localStorage.getItem(rootPath ? `dms.kanban.path.${rootPath}` : 'dms.kanban.path') ?? 'agents-kanban.json',
  )
  const [view, setView] = useState<'mission' | 'tasks'>(() => {
    const saved = localStorage.getItem(rootPath ? `dms.kanban.view.${rootPath}` : 'dms.kanban.view')
    return saved === 'tasks' ? 'tasks' : 'mission'
  })
  const [editingPath, setEditingPath] = useState(false)
  const [pathInput, setPathInput] = useState(filePath)

  const [data, setData] = useState<KanbanData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [agents, setAgents] = useState<AgentItem[]>([])
  const [agentsError, setAgentsError] = useState<string | null>(null)
  const [events, setEvents] = useState<AgentEvent[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)

  const [lastPoll, setLastPoll] = useState<Date | null>(null)
  const [taskLive, setTaskLive] = useState(false)
  const [agentsLive, setAgentsLive] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const previousAgentsRef = useRef<Map<string, AgentItem>>(new Map())

  const agentsPath = 'agents-work.json'
  const resolvedTaskPath = resolvePath(rootPath, filePath)
  const resolvedAgentsPath = resolvePath(rootPath, agentsPath)
  const isLive = taskLive || agentsLive

  const pushEvents = useCallback((nextEvents: AgentEvent[]) => {
    if (nextEvents.length === 0) {
      return
    }
    setEvents((prev) => trimEvents([...nextEvents, ...prev]))
  }, [])

  const readTaskBoard = useCallback(async () => {
    if (!resolvedTaskPath) return
    try {
      const content = await window.ide.readFile(resolvedTaskPath)
      const parsed = JSON.parse(content) as KanbanData
      setData(parsed)
      setError(null)
      setTaskLive(true)
    } catch {
      setTaskLive(false)
      setError(`Cannot read ${filePath}`)
    }
  }, [resolvedTaskPath, filePath])

  const readAgentsSnapshot = useCallback(async () => {
    if (!resolvedAgentsPath) return
    try {
      const content = await window.ide.readFile(resolvedAgentsPath)
      const parsed = JSON.parse(content) as AgentSnapshot
      const nextAgents = parsed.seed?.agents ?? []
      setAgents(nextAgents)
      setAgentsError(null)
      setAgentsLive(true)

      setSelectedAgentId((prev) => {
        if (prev && nextAgents.some((agent) => agent.id === prev)) {
          return prev
        }
        return nextAgents[0]?.id ?? null
      })

      const now = Date.now()
      const previous = previousAgentsRef.current
      const nextMap = new Map(nextAgents.map((agent) => [agent.id, agent]))
      const nextEvents: AgentEvent[] = []

      if (previous.size === 0 && nextAgents.length > 0) {
        nextEvents.push({
          id: crypto.randomUUID(),
          kind: 'snapshot',
          agentId: 'system',
          agentName: 'System',
          message: `Snapshot loaded with ${nextAgents.length} agents`,
          at: now,
        })
      } else {
        nextAgents.forEach((agent) => {
          const prevAgent = previous.get(agent.id)
          if (!prevAgent) {
            nextEvents.push({
              id: crypto.randomUUID(),
              kind: 'started',
              agentId: agent.id,
              agentName: agent.name,
              message: 'Agent joined mission control',
              at: now,
            })
            return
          }

          if (prevAgent.status !== agent.status) {
            const eventKind: AgentEventKind =
              agent.status === 'completed'
                ? 'completed'
                : agent.status === 'blocked'
                  ? 'blocked'
                  : agent.status === 'in_progress'
                    ? 'started'
                    : 'updated'

            nextEvents.push({
              id: crypto.randomUUID(),
              kind: eventKind,
              agentId: agent.id,
              agentName: agent.name,
              message: `Status changed to ${AGENT_STATUS_LABEL[agent.status]}`,
              at: now,
            })
          }

          if (prevAgent.activeFile !== agent.activeFile && agent.activeFile) {
            nextEvents.push({
              id: crypto.randomUUID(),
              kind: 'updated',
              agentId: agent.id,
              agentName: agent.name,
              message: `Switched file to ${agent.activeFile}`,
              at: now,
            })
          }

          if (prevAgent.task !== agent.task) {
            nextEvents.push({
              id: crypto.randomUUID(),
              kind: 'updated',
              agentId: agent.id,
              agentName: agent.name,
              message: `Task updated: ${agent.task}`,
              at: now,
            })
          }

          if (agent.blocker && prevAgent.blocker !== agent.blocker) {
            nextEvents.push({
              id: crypto.randomUUID(),
              kind: 'blocked',
              agentId: agent.id,
              agentName: agent.name,
              message: `Blocker: ${agent.blocker}`,
              at: now,
            })
          }
        })

        previous.forEach((prevAgent, prevId) => {
          if (!nextMap.has(prevId)) {
            nextEvents.push({
              id: crypto.randomUUID(),
              kind: 'removed',
              agentId: prevAgent.id,
              agentName: prevAgent.name,
              message: 'Agent left mission control',
              at: now,
            })
          }
        })
      }

      if (nextEvents.length > 0) {
        pushEvents(nextEvents)
      }

      previousAgentsRef.current = nextMap
    } catch {
      setAgentsLive(false)
      setAgentsError(`Cannot read ${agentsPath}`)
    }
  }, [resolvedAgentsPath, agentsPath, pushEvents])

  const refreshAll = useCallback(async () => {
    await Promise.all([readTaskBoard(), readAgentsSnapshot()])
    setLastPoll(new Date())
  }, [readTaskBoard, readAgentsSnapshot])

  useEffect(() => {
    void refreshAll()
    pollRef.current = setInterval(() => {
      void refreshAll()
    }, POLL_MS)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [refreshAll])

  useEffect(() => {
    localStorage.setItem(viewStorageKey, view)
  }, [viewStorageKey, view])

  const savePath = useCallback(
    (path: string) => {
      const trimmed = path.trim()
      if (!trimmed) return
      setFilePath(trimmed)
      localStorage.setItem(storageKey, trimmed)
      setEditingPath(false)
      setData(null)
      setError(null)
      setTaskLive(false)
    },
    [storageKey],
  )

  const tasks = data?.tasks ?? []
  const doneCount = tasks.filter((t) => t.status === 'done').length
  const doingCount = tasks.filter((t) => t.status === 'doing').length

  const countsByStatus = useMemo(() => {
    const counts: Record<AgentStatus, number> = {
      pending: 0,
      in_progress: 0,
      blocked: 0,
      completed: 0,
    }
    agents.forEach((agent) => {
      counts[agent.status] += 1
    })
    return counts
  }, [agents])

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId) ?? null,
    [agents, selectedAgentId],
  )

  const fileMap = useMemo(() => {
    const buckets = new Map<string, AgentItem[]>()
    agents.forEach((agent) => {
      const key = agent.activeFile?.trim() || '(no active file)'
      const list = buckets.get(key) ?? []
      list.push(agent)
      buckets.set(key, list)
    })
    return [...buckets.entries()]
      .sort((a, b) => {
        const byCount = b[1].length - a[1].length
        if (byCount !== 0) return byCount
        return a[0].localeCompare(b[0])
      })
      .slice(0, 24)
  }, [agents])

  const agentsByStatus = useMemo(() => {
    return MISSION_COLUMNS.map((column) => ({
      column,
      items: agents.filter((agent) => agent.status === column.id),
    }))
  }, [agents])

  const noTaskSource = Boolean(rootPath && error && !data)
  const noMissionSource = Boolean(rootPath && agentsError && agents.length === 0)

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#0f0f0f] text-white">
      <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-white/60">Agent Mission</span>
          <span
            className={`h-1.5 w-1.5 rounded-full transition-colors ${isLive ? 'bg-emerald-400' : 'bg-white/20'}`}
            title={isLive ? 'Live' : 'Not connected'}
          />
          <span className="text-[10px] text-white/35">{countsByStatus.in_progress} active</span>
          <span className="text-[10px] text-white/35">{countsByStatus.blocked} blocked</span>
        </div>

        <div className="flex items-center gap-1">
          <div className="flex rounded-md border border-white/10 bg-white/[0.04] p-0.5">
            <button
              type="button"
              onClick={() => setView('mission')}
              className={`rounded px-2 py-1 text-[10px] font-semibold transition ${
                view === 'mission' ? 'bg-blue-500/20 text-blue-300' : 'text-white/60 hover:bg-white/10'
              }`}
            >
              Mission
            </button>
            <button
              type="button"
              onClick={() => setView('tasks')}
              className={`rounded px-2 py-1 text-[10px] font-semibold transition ${
                view === 'tasks' ? 'bg-blue-500/20 text-blue-300' : 'text-white/60 hover:bg-white/10'
              }`}
            >
              Tasks
            </button>
          </div>

          <button
            onClick={() => {
              void refreshAll()
            }}
            className="rounded p-1 text-white/30 transition-colors hover:bg-white/5 hover:text-white/60"
            title="Refresh now"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor">
              <path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41zm-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9z" />
              <path
                fillRule="evenodd"
                d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5.002 5.002 0 0 0 8 3zM3.1 9a5.002 5.002 0 0 0 8.757 2.182.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9H3.1z"
              />
            </svg>
          </button>

          <button
            onClick={() => {
              setPathInput(filePath)
              setEditingPath((v) => !v)
            }}
            className={`rounded p-1 transition-colors hover:bg-white/5 ${
              editingPath ? 'text-blue-400' : 'text-white/30 hover:text-white/60'
            }`}
            title="Configure tasks JSON path"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor">
              <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z" />
              <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.375l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z" />
            </svg>
          </button>
        </div>
      </div>

      {editingPath && (
        <div className="flex shrink-0 items-center gap-1.5 border-b border-white/5 bg-[#1a1a1a] px-3 py-2">
          <input
            className="flex-1 rounded border border-white/15 bg-white/8 px-2 py-1.5 font-mono text-[11px] text-white outline-none focus:border-blue-500/60"
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') savePath(pathInput)
              if (e.key === 'Escape') setEditingPath(false)
            }}
            placeholder="agents-kanban.json"
            autoFocus
          />
          <button
            onClick={() => savePath(pathInput)}
            className="rounded bg-blue-600/30 px-2 py-1.5 text-[11px] text-blue-300 transition-colors hover:bg-blue-600/50"
          >
            Save
          </button>
          <button
            onClick={() => setEditingPath(false)}
            className="rounded px-2 py-1.5 text-[11px] text-white/40 transition-colors hover:bg-white/10"
          >
            X
          </button>
        </div>
      )}

      <div className="shrink-0 border-b border-white/[0.04] px-3 py-1">
        <span className="font-mono text-[9px] text-white/20">tasks: {filePath}</span>
        <span className="mx-2 text-[9px] text-white/15">|</span>
        <span className="font-mono text-[9px] text-white/20">agents: {agentsPath}</span>
        {lastPoll && <span className="ml-2 text-[9px] text-white/15">{timeAgo(lastPoll.toISOString())}</span>}
      </div>

      {!rootPath && (
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <p className="text-xs text-white/30">Open a project folder first</p>
        </div>
      )}

      {rootPath && view === 'mission' && (
        <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
          {noMissionSource ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-white/15 p-6 text-center">
              <p className="text-[11px] text-white/35">Mission source not found</p>
              <code className="font-mono text-[10px] text-white/45">{agentsPath}</code>
            </div>
          ) : (
            <>
              <div className="grid shrink-0 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-2">
                  <p className="text-[10px] uppercase tracking-wider text-blue-200/70">Active</p>
                  <p className="mt-1 text-xl font-semibold text-blue-200">{countsByStatus.in_progress}</p>
                </div>
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-2">
                  <p className="text-[10px] uppercase tracking-wider text-red-200/70">Blocked</p>
                  <p className="mt-1 text-xl font-semibold text-red-200">{countsByStatus.blocked}</p>
                </div>
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2">
                  <p className="text-[10px] uppercase tracking-wider text-emerald-200/70">Completed</p>
                  <p className="mt-1 text-xl font-semibold text-emerald-200">{countsByStatus.completed}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                  <p className="text-[10px] uppercase tracking-wider text-white/50">Total</p>
                  <p className="mt-1 text-xl font-semibold text-white/85">{agents.length}</p>
                </div>
              </div>

              <div className="grid min-h-[220px] shrink-0 gap-3 md:grid-cols-2 xl:grid-cols-4">
                {agentsByStatus.map(({ column, items }) => (
                  <MissionStatusColumn
                    key={column.id}
                    column={column}
                    agents={items}
                    selectedId={selectedAgentId}
                    onSelect={setSelectedAgentId}
                  />
                ))}
              </div>

              <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[1.2fr_0.8fr]">
                <section className="flex min-h-0 flex-col rounded-lg border border-white/10 bg-white/[0.03] p-2">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60">Agent File Map</p>
                    <span className="text-[10px] text-white/40">{fileMap.length} files</span>
                  </div>
                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                    {fileMap.length === 0 ? (
                      <p className="rounded border border-dashed border-white/10 py-6 text-center text-[10px] text-white/30">
                        No file activity
                      </p>
                    ) : (
                      fileMap.map(([file, fileAgents]) => (
                        <div key={file} className="rounded-md border border-white/10 bg-black/20 p-2">
                          <p className="truncate font-mono text-[10px] text-white/70">{file}</p>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {fileAgents.map((agent) => (
                              <button
                                key={agent.id}
                                type="button"
                                onClick={() => setSelectedAgentId(agent.id)}
                                className={`rounded border px-1.5 py-0.5 text-[9px] transition ${AGENT_STATUS_PILL[agent.status]} ${
                                  selectedAgentId === agent.id ? 'ring-1 ring-blue-300/70' : ''
                                }`}
                              >
                                {agent.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section className="flex min-h-0 flex-col rounded-lg border border-white/10 bg-white/[0.03] p-2">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60">Event Feed</p>
                    <span className="text-[10px] text-white/40">{events.length}</span>
                  </div>
                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                    {events.length === 0 ? (
                      <p className="rounded border border-dashed border-white/10 py-6 text-center text-[10px] text-white/30">
                        Waiting for changes
                      </p>
                    ) : (
                      events.map((event) => (
                        <div key={event.id} className={`rounded-md border p-2 ${EVENT_STYLE[event.kind]}`}>
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-[10px] font-semibold">{event.agentName}</p>
                            <span className="text-[9px] opacity-75">{timeAgoFromTimestamp(event.at)}</span>
                          </div>
                          <p className="mt-1 text-[10px] opacity-90">{event.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>

              {selectedAgent ? (
                <section className="shrink-0 rounded-lg border border-white/10 bg-black/20 p-2 text-[11px] text-white/80">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-white">{selectedAgent.name}</p>
                      <p className="mt-1 text-white/70">{selectedAgent.task}</p>
                    </div>
                    <span className={`rounded border px-2 py-1 text-[10px] ${AGENT_STATUS_PILL[selectedAgent.status]}`}>
                      {AGENT_STATUS_LABEL[selectedAgent.status]}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-white/60">
                    {selectedAgent.repo ? <span>repo: {selectedAgent.repo}</span> : null}
                    {selectedAgent.branch ? <span>branch: {selectedAgent.branch}</span> : null}
                    {selectedAgent.activeFile ? <span>file: {selectedAgent.activeFile}</span> : null}
                    {typeof selectedAgent.etaMinutes === 'number' ? <span>eta: {selectedAgent.etaMinutes}m</span> : null}
                    {selectedAgent.updatedAt ? <span>updated: {timeAgo(selectedAgent.updatedAt)}</span> : null}
                  </div>
                  {selectedAgent.blocker ? (
                    <p className="mt-2 rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-[10px] text-red-200">
                      blocker: {selectedAgent.blocker}
                    </p>
                  ) : null}
                </section>
              ) : null}
            </>
          )}
        </div>
      )}

      {rootPath && view === 'tasks' && (
        <>
          {noTaskSource ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <svg viewBox="0 0 24 24" className="h-8 w-8 text-white/10" fill="currentColor">
                <path d="M9 2a1 1 0 0 0-1 1v1H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3V3a1 1 0 0 0-1-1H9zm0 2h6v1H9V4zm6 5H9v2h6V9zm0 4H9v2h6v-2z" />
              </svg>
              <div>
                <p className="text-[11px] text-white/30">File not found</p>
                <code className="mt-1 block font-mono text-[10px] text-white/40">{filePath}</code>
              </div>
              <p className="text-[10px] text-white/20">
                Create this file in your project root.
                <br />
                Agents will update it automatically.
              </p>
            </div>
          ) : null}

          {data !== null && (
            <>
              <div className="shrink-0 border-b border-white/[0.04] px-3 py-1 text-[10px] text-white/35">
                {doingCount > 0 ? <span className="text-blue-300/80">{doingCount} active</span> : null}
                <span className="ml-2">{doneCount}/{tasks.length} done</span>
              </div>

              <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
                <div className="flex h-full gap-3" style={{ minWidth: TASK_COLUMNS.length * (TASK_COL_WIDTH + 12) }}>
                  {TASK_COLUMNS.map((col) => (
                    <TaskColumn key={col.id} col={col} tasks={tasks.filter((t) => t.status === col.id)} />
                  ))}
                </div>
              </div>
            </>
          )}

          {data && tasks.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
              <p className="text-[11px] text-white/20">No tasks yet</p>
              <p className="text-[10px] text-white/15">Agents will populate this board</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

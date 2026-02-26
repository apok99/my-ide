import { useState, useEffect, useCallback, useRef } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Constants ────────────────────────────────────────────────────────────────

const COLUMNS: {
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

const PRIORITY_STYLE: Record<TaskPriority, string> = {
    high: 'bg-red-500/15 text-red-300 border-red-500/30',
    medium: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
    low: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
}

const PRIORITY_ICON: Record<TaskPriority, string> = {
    high: '↑',
    medium: '→',
    low: '↓',
}

const PATH_KEY = 'dms.kanban.path'
const POLL_MS = 3000
const COL_WIDTH = 200

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function initials(name?: string): string {
    if (!name) return '?'
    return name
        .split(/[-_\s]/)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .slice(0, 2)
        .join('')
}

// ─── TaskCard ─────────────────────────────────────────────────────────────────

function TaskCard({ task }: { task: KanbanTask }) {
    const [expanded, setExpanded] = useState(false)

    return (
        <div
            onClick={() => setExpanded((v) => !v)}
            className="cursor-pointer rounded-lg border border-white/[0.07] bg-white/[0.04] p-3 transition-all hover:border-white/[0.14] hover:bg-white/[0.07] active:scale-[0.98]"
        >
            {/* Top row: agent avatar + priority */}
            <div className="mb-2 flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                    {task.agent && (
                        <>
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/10 text-[8px] font-bold text-white/60">
                                {initials(task.agent)}
                            </span>
                            <span className="truncate text-[9px] text-white/35 font-mono">
                                {task.agent}
                            </span>
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

            {/* Title */}
            <p className="text-[11px] font-medium leading-snug text-white/85">{task.title}</p>

            {/* Description — shown on expand */}
            {expanded && task.description && (
                <p className="mt-2 text-[10px] leading-relaxed text-white/45">{task.description}</p>
            )}

            {/* Blocked reason */}
            {task.blockedBy && (
                <p className="mt-1.5 flex items-start gap-1 text-[10px] text-red-400/80">
                    <span className="shrink-0">⚠</span>
                    <span>{task.blockedBy}</span>
                </p>
            )}

            {/* Tags */}
            {task.tags && task.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                    {task.tags.map((tag) => (
                        <span
                            key={tag}
                            className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[9px] text-white/30 border border-white/[0.08]"
                        >
                            {tag}
                        </span>
                    ))}
                </div>
            )}

            {/* Timestamp */}
            {task.updatedAt && (
                <p className="mt-2 text-[9px] text-white/20">{timeAgo(task.updatedAt)}</p>
            )}
        </div>
    )
}

// ─── KanbanColumn ─────────────────────────────────────────────────────────────

function KanbanColumn({
    col,
    tasks,
}: {
    col: (typeof COLUMNS)[number]
    tasks: KanbanTask[]
}) {
    return (
        <div
            className="flex flex-col"
            style={{ width: COL_WIDTH, flexShrink: 0 }}
        >
            {/* Header */}
            <div className="mb-3 flex items-center gap-2 px-0.5">
                <span
                    className={`h-2 w-2 rounded-full shrink-0 ${col.dotClass} ${col.id === 'doing' && tasks.length > 0 ? col.pulseClass : ''}`}
                />
                <span className={`text-[10px] font-semibold uppercase tracking-wider ${col.headerClass}`}>
                    {col.label}
                </span>
                <span className="ml-auto font-mono text-[10px] text-white/20">{tasks.length}</span>
            </div>

            {/* Cards */}
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto pr-0.5">
                {tasks.length === 0 ? (
                    <div
                        className={`rounded-lg border border-dashed py-8 text-center ${col.emptyClass}`}
                    >
                        <span className="text-[10px] text-white/15">—</span>
                    </div>
                ) : (
                    tasks.map((task) => <TaskCard key={task.id} task={task} />)
                )}
            </div>
        </div>
    )
}

// ─── KanbanPanel ──────────────────────────────────────────────────────────────

interface KanbanPanelProps {
    rootPath?: string | null
}

export function KanbanPanel({ rootPath }: KanbanPanelProps) {
    const [filePath, setFilePath] = useState(
        () => localStorage.getItem(PATH_KEY) ?? 'agents-kanban.json',
    )
    const [editingPath, setEditingPath] = useState(false)
    const [pathInput, setPathInput] = useState(filePath)
    const [data, setData] = useState<KanbanData | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [lastPoll, setLastPoll] = useState<Date | null>(null)
    const [isLive, setIsLive] = useState(false)
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const resolvedPath = filePath.startsWith('/')
        ? filePath
        : rootPath
          ? `${rootPath}/${filePath}`
          : null

    const readFile = useCallback(async () => {
        if (!resolvedPath) return
        try {
            const content = await window.ide.readFile(resolvedPath)
            const parsed = JSON.parse(content) as KanbanData
            setData(parsed)
            setError(null)
            setIsLive(true)
            setLastPoll(new Date())
        } catch {
            setIsLive(false)
            setError(`Cannot read ${filePath}`)
        }
    }, [resolvedPath, filePath])

    // Poll for changes
    useEffect(() => {
        readFile()
        pollRef.current = setInterval(readFile, POLL_MS)
        return () => {
            if (pollRef.current) clearInterval(pollRef.current)
        }
    }, [readFile])

    const savePath = useCallback(
        (path: string) => {
            const trimmed = path.trim()
            if (!trimmed) return
            setFilePath(trimmed)
            localStorage.setItem(PATH_KEY, trimmed)
            setEditingPath(false)
            setData(null)
            setError(null)
            setIsLive(false)
        },
        [],
    )

    const tasks = data?.tasks ?? []
    const doneCount = tasks.filter((t) => t.status === 'done').length
    const doingCount = tasks.filter((t) => t.status === 'doing').length
    const total = tasks.length

    return (
        <div className="flex h-full flex-col overflow-hidden bg-[#0f0f0f] text-white">
            {/* ── Header ── */}
            <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-3 py-2">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
                        Agent Kanban
                    </span>
                    {/* live dot */}
                    <span
                        className={`h-1.5 w-1.5 rounded-full transition-colors ${
                            isLive ? 'bg-emerald-400' : 'bg-white/20'
                        }`}
                        title={isLive ? 'Live' : 'Not connected'}
                    />
                </div>

                <div className="flex items-center gap-1">
                    {/* Stats */}
                    {total > 0 && (
                        <div className="mr-2 flex items-center gap-2 text-[10px] text-white/30">
                            {doingCount > 0 && (
                                <span className="text-blue-400/70">{doingCount} active</span>
                            )}
                            <span>{doneCount}/{total} done</span>
                        </div>
                    )}

                    {/* Refresh */}
                    <button
                        onClick={readFile}
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

                    {/* Settings */}
                    <button
                        onClick={() => {
                            setPathInput(filePath)
                            setEditingPath((v) => !v)
                        }}
                        className={`rounded p-1 transition-colors hover:bg-white/5 ${
                            editingPath ? 'text-blue-400' : 'text-white/30 hover:text-white/60'
                        }`}
                        title="Configure JSON path"
                    >
                        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor">
                            <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z" />
                            <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.375l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* ── Path editor ── */}
            {editingPath && (
                <div className="flex shrink-0 items-center gap-1.5 border-b border-white/5 bg-[#1a1a1a] px-3 py-2">
                    <input
                        className="flex-1 rounded bg-white/8 px-2 py-1.5 text-[11px] text-white outline-none border border-white/15 focus:border-blue-500/60 font-mono"
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
                        ✕
                    </button>
                </div>
            )}

            {/* ── File path indicator ── */}
            <div className="shrink-0 border-b border-white/[0.04] px-3 py-1">
                <span className="font-mono text-[9px] text-white/20">{filePath}</span>
                {lastPoll && (
                    <span className="ml-2 text-[9px] text-white/15">
                        · {timeAgo(lastPoll.toISOString())}
                    </span>
                )}
            </div>

            {/* ── No rootPath ── */}
            {!rootPath && (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
                    <p className="text-xs text-white/30">Open a project folder first</p>
                </div>
            )}

            {/* ── Error / no file ── */}
            {rootPath && error && !data && (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                    <svg
                        viewBox="0 0 24 24"
                        className="h-8 w-8 text-white/10"
                        fill="currentColor"
                    >
                        <path d="M9 2a1 1 0 0 0-1 1v1H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3V3a1 1 0 0 0-1-1H9zm0 2h6v1H9V4zm6 5H9v2h6V9zm0 4H9v2h6v-2z" />
                    </svg>
                    <div>
                        <p className="text-[11px] text-white/30">File not found</p>
                        <code className="mt-1 block font-mono text-[10px] text-white/40">
                            {filePath}
                        </code>
                    </div>
                    <p className="text-[10px] text-white/20">
                        Create this file in your project root.
                        <br />
                        Agents will update it automatically.
                    </p>
                </div>
            )}

            {/* ── Kanban board ── */}
            {rootPath && (error ? data : true) && data !== null && (
                <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
                    <div
                        className="flex h-full gap-3"
                        style={{ minWidth: COLUMNS.length * (COL_WIDTH + 12) }}
                    >
                        {COLUMNS.map((col) => (
                            <KanbanColumn
                                key={col.id}
                                col={col}
                                tasks={tasks.filter((t) => t.status === col.id)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* ── Empty state (file exists but no tasks) ── */}
            {rootPath && data && tasks.length === 0 && (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
                    <p className="text-[11px] text-white/20">No tasks yet</p>
                    <p className="text-[10px] text-white/15">
                        Agents will populate this board
                    </p>
                </div>
            )}
        </div>
    )
}

import { useEffect, useState, useCallback, useRef } from 'react'
import { TerminalWindow } from './TerminalWindow'

interface TerminalSession {
    id: string
    zIndex: number
}

interface CellDef {
    col: number
    row: number
    colSpan?: number
    rowSpan?: number
}

interface LayoutConfig {
    id: string
    label: string
    cols: number
    rows: number
    cells: CellDef[]
}

const LAYOUTS: LayoutConfig[] = [
    // 1 terminal
    { id: 'solo', label: '1', cols: 1, rows: 1, cells: [{ col: 0, row: 0 }] },

    // 2 terminals
    { id: '2v', label: '2↕', cols: 1, rows: 2, cells: [{ col: 0, row: 0 }, { col: 0, row: 1 }] },
    { id: '2h', label: '2⟺', cols: 2, rows: 1, cells: [{ col: 0, row: 0 }, { col: 1, row: 0 }] },

    // 3 terminals
    {
        id: '3ml', label: '3L', cols: 2, rows: 2,
        cells: [{ col: 0, row: 0, rowSpan: 2 }, { col: 1, row: 0 }, { col: 1, row: 1 }]
    },
    {
        id: '3mr', label: '3R', cols: 2, rows: 2,
        cells: [{ col: 0, row: 0 }, { col: 0, row: 1 }, { col: 1, row: 0, rowSpan: 2 }]
    },
    {
        id: '3mt', label: '3T', cols: 2, rows: 2,
        cells: [{ col: 0, row: 0, colSpan: 2 }, { col: 0, row: 1 }, { col: 1, row: 1 }]
    },
    {
        id: '3mb', label: '3B', cols: 2, rows: 2,
        cells: [{ col: 0, row: 0 }, { col: 1, row: 0 }, { col: 0, row: 1, colSpan: 2 }]
    },
    {
        id: '3h', label: '3H', cols: 3, rows: 1,
        cells: [{ col: 0, row: 0 }, { col: 1, row: 0 }, { col: 2, row: 0 }]
    },
    {
        id: '3v', label: '3V', cols: 1, rows: 3,
        cells: [{ col: 0, row: 0 }, { col: 0, row: 1 }, { col: 0, row: 2 }]
    },

    // 4 terminals
    {
        id: '4grid', label: '4⊞', cols: 2, rows: 2,
        cells: [{ col: 0, row: 0 }, { col: 1, row: 0 }, { col: 0, row: 1 }, { col: 1, row: 1 }]
    },
    {
        id: '4ml', label: '4L', cols: 3, rows: 3,
        cells: [
            { col: 0, row: 0, colSpan: 2, rowSpan: 3 },
            { col: 2, row: 0 }, { col: 2, row: 1 }, { col: 2, row: 2 }
        ]
    },
    {
        id: '4mt', label: '4T', cols: 3, rows: 2,
        cells: [
            { col: 0, row: 0, colSpan: 3 },
            { col: 0, row: 1 }, { col: 1, row: 1 }, { col: 2, row: 1 }
        ]
    },
    {
        id: '4h', label: '4H', cols: 4, rows: 1,
        cells: [{ col: 0, row: 0 }, { col: 1, row: 0 }, { col: 2, row: 0 }, { col: 3, row: 0 }]
    },

    // 6 terminals
    {
        id: '6grid', label: '6⊞', cols: 3, rows: 2,
        cells: [
            { col: 0, row: 0 }, { col: 1, row: 0 }, { col: 2, row: 0 },
            { col: 0, row: 1 }, { col: 1, row: 1 }, { col: 2, row: 1 }
        ]
    },
    {
        id: '6v', label: '6V', cols: 2, rows: 3,
        cells: [
            { col: 0, row: 0 }, { col: 1, row: 0 },
            { col: 0, row: 1 }, { col: 1, row: 1 },
            { col: 0, row: 2 }, { col: 1, row: 2 }
        ]
    },

    // 8 terminals
    {
        id: '8grid', label: '8⊞', cols: 4, rows: 2,
        cells: [
            { col: 0, row: 0 }, { col: 1, row: 0 }, { col: 2, row: 0 }, { col: 3, row: 0 },
            { col: 0, row: 1 }, { col: 1, row: 1 }, { col: 2, row: 1 }, { col: 3, row: 1 }
        ]
    },
    {
        id: '8v', label: '8V', cols: 2, rows: 4,
        cells: [
            { col: 0, row: 0 }, { col: 1, row: 0 },
            { col: 0, row: 1 }, { col: 1, row: 1 },
            { col: 0, row: 2 }, { col: 1, row: 2 },
            { col: 0, row: 3 }, { col: 1, row: 3 }
        ]
    },

    // 9 terminals
    {
        id: '9grid', label: '9⊞', cols: 3, rows: 3,
        cells: [
            { col: 0, row: 0 }, { col: 1, row: 0 }, { col: 2, row: 0 },
            { col: 0, row: 1 }, { col: 1, row: 1 }, { col: 2, row: 1 },
            { col: 0, row: 2 }, { col: 1, row: 2 }, { col: 2, row: 2 }
        ]
    },
]

const LAYOUT_GROUPS = [
    { label: '1 terminal', layouts: LAYOUTS.filter(l => l.cells.length === 1) },
    { label: '2 terminals', layouts: LAYOUTS.filter(l => l.cells.length === 2) },
    { label: '3 terminals', layouts: LAYOUTS.filter(l => l.cells.length === 3) },
    { label: '4 terminals', layouts: LAYOUTS.filter(l => l.cells.length === 4) },
    { label: '6 terminals', layouts: LAYOUTS.filter(l => l.cells.length === 6) },
    { label: '8 terminals', layouts: LAYOUTS.filter(l => l.cells.length === 8) },
    { label: '9 terminals', layouts: LAYOUTS.filter(l => l.cells.length === 9) },
]

function LayoutPreview({ layout, isActive }: { layout: LayoutConfig; isActive: boolean }) {
    const W = 36, H = 26, GAP = 1.5
    const cellW = (W - GAP * (layout.cols - 1)) / layout.cols
    const cellH = (H - GAP * (layout.rows - 1)) / layout.rows
    return (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
            {layout.cells.map((cell, i) => {
                const cSpan = cell.colSpan || 1
                const rSpan = cell.rowSpan || 1
                return (
                    <rect
                        key={i}
                        x={cell.col * (cellW + GAP)}
                        y={cell.row * (cellH + GAP)}
                        width={cSpan * cellW + (cSpan - 1) * GAP}
                        height={rSpan * cellH + (rSpan - 1) * GAP}
                        rx={1}
                        fill={isActive ? 'rgba(59,130,246,0.35)' : 'rgba(255,255,255,0.12)'}
                        stroke={isActive ? 'rgba(96,165,250,0.8)' : 'rgba(255,255,255,0.28)'}
                        strokeWidth={0.5}
                    />
                )
            })}
        </svg>
    )
}

function GridPicker({ currentLayoutId, onSelect }: { currentLayoutId: string; onSelect: (layout: LayoutConfig) => void }) {
    const [isOpen, setIsOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!isOpen) return
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [isOpen])

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setIsOpen(v => !v)}
                className={`flex items-center gap-1.5 rounded px-2 py-1 text-[10px] font-semibold transition-colors ${
                    isOpen ? 'bg-blue-500/20 text-blue-400' : 'text-white/60 hover:bg-white/10 hover:text-white'
                }`}
                title="Choose grid layout"
            >
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <rect x="0" y="0" width="4" height="4" rx="0.8" fill="currentColor" opacity="0.85" />
                    <rect x="7" y="0" width="4" height="4" rx="0.8" fill="currentColor" opacity="0.85" />
                    <rect x="0" y="7" width="4" height="4" rx="0.8" fill="currentColor" opacity="0.85" />
                    <rect x="7" y="7" width="4" height="4" rx="0.8" fill="currentColor" opacity="0.85" />
                </svg>
                Grid
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 z-[100] mt-1.5 w-[280px] max-h-[460px] overflow-y-auto rounded-xl bg-[#181818] border border-white/10 shadow-2xl p-3">
                    <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-3">Terminal Layout</p>
                    <div className="space-y-3.5">
                        {LAYOUT_GROUPS.map(group => (
                            group.layouts.length > 0 && (
                                <div key={group.label}>
                                    <p className="text-[9px] text-white/25 uppercase tracking-wider mb-1.5 px-0.5">{group.label}</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {group.layouts.map(layout => (
                                            <button
                                                key={layout.id}
                                                onClick={() => { onSelect(layout); setIsOpen(false) }}
                                                className={`rounded-md p-1.5 border transition-all ${
                                                    layout.id === currentLayoutId
                                                        ? 'bg-blue-500/15 border-blue-500/40 shadow-sm shadow-blue-500/20'
                                                        : 'bg-white/[0.04] border-white/10 hover:bg-white/[0.08] hover:border-white/20'
                                                }`}
                                                title={layout.label}
                                            >
                                                <LayoutPreview layout={layout} isActive={layout.id === currentLayoutId} />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

interface TerminalManagerProps {
    isActive: boolean
    rootPath?: string | null
}

export function TerminalManager({ isActive, rootPath }: TerminalManagerProps) {
    const [terminals, setTerminals] = useState<TerminalSession[]>([])
    const [activeId, setActiveId] = useState<string | null>(null)
    const [selectedLayout, setSelectedLayout] = useState<LayoutConfig>(LAYOUTS[0])

    const createTerminal = useCallback(() => {
        setTerminals((prev) => {
            if (prev.length >= 12) return prev
            const id = crypto.randomUUID()
            setActiveId(id)
            return [...prev, { id, zIndex: prev.length + 1 }]
        })
    }, [])

    const closeTerminal = useCallback((id: string) => {
        setTerminals((prev) => prev.filter((t) => t.id !== id))
        setActiveId((prev) => (prev === id ? null : prev))
    }, [])

    const focusTerminal = useCallback((id: string) => {
        setActiveId(id)
        setTerminals((prev) => {
            const maxZ = Math.max(...prev.map((t) => t.zIndex), 0)
            return prev.map((t) => t.id === id ? { ...t, zIndex: maxZ + 1 } : t)
        })
    }, [])

    useEffect(() => {
        if (!isActive) return
        const handle = setTimeout(() => window.dispatchEvent(new Event('resize')), 0)
        return () => clearTimeout(handle)
    }, [isActive])

    const ensureTerminalCount = useCallback((count: number) => {
        setTerminals((prev) => {
            if (prev.length >= count) return prev
            const needed = count - prev.length
            const newTerminals: TerminalSession[] = Array.from({ length: needed }).map((_, i) => ({
                id: crypto.randomUUID(),
                zIndex: prev.length + 1 + i,
            }))
            setActiveId(newTerminals[newTerminals.length - 1].id)
            return [...prev, ...newTerminals]
        })
    }, [])

    const applyLayout = useCallback((layout: LayoutConfig) => {
        setSelectedLayout(layout)
        ensureTerminalCount(layout.cells.length)
    }, [ensureTerminalCount])

    const minRowH = selectedLayout.rows >= 4 ? 150 : selectedLayout.rows >= 3 ? 180 : selectedLayout.rows >= 2 ? 240 : 300

    return (
        <div className="relative h-full w-full overflow-hidden bg-[#0b0d12] p-4 text-white">
            {/* Header / Controls */}
            <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between bg-[#1f1f1f]/80 p-2 backdrop-blur-sm">
                <span className="text-sm font-medium uppercase tracking-wider text-white/50">Terminals</span>
                <div className="flex items-center gap-2">
                    <div className="flex bg-white/5 rounded-md p-0.5 border border-white/5 items-center">
                        <GridPicker currentLayoutId={selectedLayout.id} onSelect={applyLayout} />
                    </div>

                    <div className="h-4 w-px bg-white/10 mx-1" />

                    <button
                        onClick={createTerminal}
                        className="rounded-md bg-blue-600/20 px-3 py-1 text-xs font-semibold text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 transition-colors disabled:opacity-50"
                        disabled={terminals.length >= 12}
                        title={terminals.length >= 12 ? 'Max 12 terminals' : 'New terminal'}
                    >
                        + New
                    </button>
                </div>
            </div>

            {/* Terminal Area */}
            <div className="relative mt-10 h-[calc(100%-2.5rem)] w-full overflow-y-auto">
                {terminals.length === 0 ? (
                    <div className="flex h-full w-full flex-col items-center justify-center text-white/20">
                        <p>No active terminals</p>
                        <div className="mt-4 flex gap-3 text-sm">
                            <button onClick={() => applyLayout(LAYOUTS.find(l => l.id === '2v')!)} className="hover:text-blue-400 transition-colors">Open 2</button>
                            <button onClick={() => applyLayout(LAYOUTS.find(l => l.id === '3ml')!)} className="hover:text-blue-400 transition-colors">Open 3</button>
                        </div>
                    </div>
                ) : (
                    <div
                        className="grid w-full gap-3 min-h-full"
                        style={{
                            gridTemplateColumns: `repeat(${selectedLayout.cols}, minmax(0, 1fr))`,
                            gridTemplateRows: `repeat(${selectedLayout.rows}, minmax(${minRowH}px, 1fr))`,
                        }}
                    >
                        {terminals.map((term, index) => {
                            const cell = selectedLayout.cells[index]
                            const style = cell ? {
                                gridColumn: `${cell.col + 1} / span ${cell.colSpan || 1}`,
                                gridRow: `${cell.row + 1} / span ${cell.rowSpan || 1}`,
                            } : {}
                            return (
                                <div
                                    key={term.id}
                                    style={style}
                                    className="h-full w-full overflow-hidden rounded-md border border-white/10 bg-[#1e1e1e]"
                                >
                                    <TerminalWindow
                                        id={term.id}
                                        isActive={term.id === activeId}
                                        onFocus={() => focusTerminal(term.id)}
                                        onClose={() => closeTerminal(term.id)}
                                        cwd={rootPath ?? undefined}
                                    />
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}

import { useEffect, useMemo, useState, useCallback } from 'react'
import { TerminalWindow } from './TerminalWindow'

interface TerminalSession {
    id: string
    zIndex: number
}

type LayoutMode = 'auto' | 1 | 2 | 3 | 4 | 8

interface TerminalManagerProps {
    isActive: boolean
    rootPath?: string | null
}

export function TerminalManager({ isActive, rootPath }: TerminalManagerProps) {
    const [terminals, setTerminals] = useState<TerminalSession[]>([])
    const [activeId, setActiveId] = useState<string | null>(null)
    const [layoutMode, setLayoutMode] = useState<LayoutMode>('auto')

    const createTerminal = useCallback(() => {
        setTerminals((prev) => {
            if (prev.length >= 12) {
                return prev
            }
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
            return prev.map((t) =>
                t.id === id ? { ...t, zIndex: maxZ + 1 } : t
            )
        })
    }, [])

    useEffect(() => {
        if (!isActive) {
            return
        }
        const handle = setTimeout(() => {
            window.dispatchEvent(new Event('resize'))
        }, 0)
        return () => clearTimeout(handle)
    }, [isActive])

    const columns = useMemo(() => {
        if (layoutMode === 8) {
            return 4
        }
        if (layoutMode !== 'auto') {
            return layoutMode
        }
        const count = terminals.length
        if (count == 1) return 1
        if (count == 2) return 1 // User requested 2 terminals to be one on top of the other (1 column)
        if (count == 3) return 2 // User requested 1 main + 2 stacked (2 columns)
        if (count == 4) return 2 // User requested 2 top + 2 bottom (2 columns)
        if (count <= 6) return 2
        if (count <= 9) return 3
        return 4
    }, [layoutMode, terminals.length])

    const rows = useMemo(() => {
        if (layoutMode === 8) {
            return 2
        }
        const count = terminals.length || 1
        return Math.max(1, Math.ceil(count / columns))
    }, [terminals.length, columns, layoutMode])

    return (
        <div className="relative h-full w-full overflow-hidden bg-[#0b0d12] p-4 text-white">
            {/* Header / Controls */}
            <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between bg-[#1f1f1f]/80 p-2 backdrop-blur-sm">
                <span className="text-sm font-medium uppercase tracking-wider text-white/50">Terminals</span>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setLayoutMode('auto')}
                        className={`rounded-md border border-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${layoutMode === 'auto' ? 'text-blue-300' : 'text-white/60'} hover:bg-white/10`}
                        title="Smart Auto Layout"
                    >
                        Auto
                    </button>
                    <button
                        onClick={() => setLayoutMode(1)}
                        className={`rounded-md border border-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${layoutMode === 1 ? 'text-blue-300' : 'text-white/60'} hover:bg-white/10`}
                        title="Vertical Stack"
                    >
                        Stack
                    </button>
                    <button
                        onClick={() => setLayoutMode(2)}
                        className={`rounded-md border border-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${layoutMode === 2 ? 'text-blue-300' : 'text-white/60'} hover:bg-white/10`}
                        title="Grid View"
                    >
                        Grid
                    </button>
                    <button
                        onClick={() => setLayoutMode(8)}
                        className={`rounded-md border border-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${layoutMode === 8 ? 'text-blue-300' : 'text-white/60'} hover:bg-white/10`}
                        title="8 Terminal Overview"
                    >
                        Overview
                    </button>
                    <button
                        onClick={createTerminal}
                        className="rounded-md bg-blue-600/20 px-3 py-1 text-xs font-semibold text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 transition-colors disabled:opacity-50"
                        disabled={terminals.length >= 12}
                        title={terminals.length >= 12 ? 'Max 12 terminals' : 'New terminal'}
                    >
                        + New Terminal
                    </button>
                </div>
            </div>

            {/* Terminal Area */}
            <div className="relative mt-10 h-[calc(100%-2.5rem)] w-full">
                {terminals.length === 0 ? (
                    <div className="flex h-full w-full flex-col items-center justify-center text-white/20">
                        <p>No active terminals</p>
                        <button
                            onClick={createTerminal}
                            className="mt-2 text-sm text-blue-500 hover:underline"
                        >
                            Open one now
                        </button>
                    </div>
                ) : (
                    <div
                        className={`grid w-full gap-3 overflow-hidden ${layoutMode === 8 ? 'h-1/2' : 'h-full'}`}
                        style={(() => {
                            if (layoutMode === 8) {
                                return {
                                    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                                    gridTemplateRows: 'repeat(2, minmax(0, 1fr))'
                                }
                            }
                            if (layoutMode === 'auto') {
                                const count = terminals.length
                                if (count <= 1) return {
                                    gridTemplateColumns: 'minmax(0, 1fr)',
                                    gridTemplateRows: 'minmax(0, 1fr)'
                                }
                                if (count === 2) return {
                                    gridTemplateColumns: 'minmax(0, 1fr)',
                                    gridTemplateRows: 'repeat(2, minmax(0, 1fr))'
                                }
                                if (count === 3) return {
                                    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                                    gridTemplateRows: 'repeat(2, minmax(0, 1fr))'
                                }
                                if (count === 4) return {
                                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                                    gridTemplateRows: 'repeat(2, minmax(0, 1fr))'
                                }
                                // Fallback generic
                                return {
                                    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                                    gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`
                                }
                            }
                            // Manual modes
                            return {
                                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                                gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`
                            }
                        })()}
                    >
                        {terminals.map((term, index) => {
                            // Custom styles for specific layouts (item level)
                            let style = {}
                            if (layoutMode === 'auto' && terminals.length === 3 && index === 0) {
                                style = { gridRow: 'span 2' }
                            }

                            return (
                                <div
                                    key={term.id}
                                    style={style}
                                    className="h-full w-full overflow-hidden"
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
        </div >
    )
}

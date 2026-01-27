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

    const ensureTerminalCount = useCallback((count: number) => {
        setTerminals((prev) => {
            if (prev.length >= count) return prev
            const needed = count - prev.length
            const newTerminals: TerminalSession[] = Array.from({ length: needed }).map((_, i) => ({
                id: crypto.randomUUID(),
                zIndex: prev.length + 1 + i,
            }))
            // Set active to the last new terminal
            setActiveId(newTerminals[newTerminals.length - 1].id)
            return [...prev, ...newTerminals]
        })
    }, [])

    const handlePreset = useCallback((count: number) => {
        if (count === 8) {
            setLayoutMode(8)
        } else {
            setLayoutMode('auto')
        }
        ensureTerminalCount(count)
    }, [ensureTerminalCount])

    const handleStackLayout = useCallback(() => {
        setLayoutMode(1)
    }, [])

    return (
        <div className="relative h-full w-full overflow-hidden bg-[#0b0d12] p-4 text-white">
            {/* Header / Controls */}
            <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between bg-[#1f1f1f]/80 p-2 backdrop-blur-sm">
                <span className="text-sm font-medium uppercase tracking-wider text-white/50">Terminals</span>
                <div className="flex items-center gap-2">
                    <div className="flex bg-white/5 rounded-md p-0.5 border border-white/5">
                        <button
                            onClick={handleStackLayout}
                            className="rounded px-2 py-0.5 text-[10px] font-semibold text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                            title="Stack terminals (1 column)"
                        >
                            V
                        </button>
                        <button
                            onClick={() => handlePreset(2)}
                            className="rounded px-2 py-0.5 text-[10px] font-semibold text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                            title="2 Terminals (Split)"
                        >
                            2
                        </button>
                        <button
                            onClick={() => handlePreset(3)}
                            className="rounded px-2 py-0.5 text-[10px] font-semibold text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                            title="3 Terminals (Layout)"
                        >
                            3
                        </button>
                        <button
                            onClick={() => handlePreset(4)}
                            className="rounded px-2 py-0.5 text-[10px] font-semibold text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                            title="4 Terminals (Grid)"
                        >
                            4
                        </button>
                        <button
                            onClick={() => handlePreset(8)}
                            className="rounded px-2 py-0.5 text-[10px] font-semibold text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                            title="8 Terminals (Overview)"
                        >
                            8
                        </button>
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
                        <div className="mt-4 flex gap-2">
                            <button onClick={() => handlePreset(2)} className="hover:text-blue-400 transition-colors">Open 2</button>
                            <button onClick={() => handlePreset(3)} className="hover:text-blue-400 transition-colors">Open 3</button>
                        </div>
                    </div>
                ) : (
                    <div
                        className={`grid w-full gap-3 min-h-full ${layoutMode === 8 ? 'h-1/2' : ''}`}
                        style={(() => {
                            if (layoutMode === 8) {
                                return {
                                    gridTemplateColumns: 'repeat(4, minmax(300px, 1fr))',
                                    gridTemplateRows: 'repeat(2, minmax(200px, 1fr))'
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
                                    gridTemplateRows: 'repeat(2, minmax(300px, 1fr))'
                                }
                                if (count === 3) return {
                                    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                                    gridTemplateRows: 'repeat(2, minmax(300px, 1fr))'
                                }
                                if (count === 4) return {
                                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                                    gridTemplateRows: 'repeat(2, minmax(300px, 1fr))'
                                }
                                // Fallback generic
                                return {
                                    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                                    gridTemplateRows: `repeat(${rows}, minmax(300px, 1fr))`
                                }
                            }
                            // Manual modes
                            return {
                                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                                gridTemplateRows: `repeat(${rows}, minmax(300px, 1fr))`
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
        </div >
    )
}

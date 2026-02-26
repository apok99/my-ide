import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

interface LayoutProps {
    activityBar: ReactNode
    sidePanel: ReactNode
    editor: ReactNode
    terminal: ReactNode
}

export function Layout({ activityBar, sidePanel, editor, terminal }: LayoutProps) {
    const workspaceRef = useRef<HTMLDivElement | null>(null)
    const rightRef = useRef<HTMLDivElement | null>(null)
    const terminalDraggingRef = useRef(false)
    const sidePanelDraggingRef = useRef(false)
    const [split, setSplit] = useState(0.5)
    const [sidePanelWidth, setSidePanelWidth] = useState(240)
    const [sidePanelHidden, setSidePanelHidden] = useState(false)
    const [editorHidden, setEditorHidden] = useState(false)
    const [editorFullscreen, setEditorFullscreen] = useState(false)
    const splitKey = 'dms.terminalSplit'
    const sidePanelWidthKey = 'dms.sidePanelWidth'
    const sidePanelHiddenKey = 'dms.sidePanelHidden'
    const editorHiddenKey = 'dms.editorHidden'

    const clamp = (value: number, min: number, max: number) =>
        Math.max(min, Math.min(max, value))

    const handleTerminalPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        event.preventDefault()
        terminalDraggingRef.current = true
        document.body.style.userSelect = 'none'

        const handleMove = (moveEvent: PointerEvent) => {
            if (!terminalDraggingRef.current || !rightRef.current) {
                return
            }
            const rect = rightRef.current.getBoundingClientRect()
            const minPx = 240
            const maxPx = Math.max(minPx, rect.width - minPx)
            const nextPx = clamp(moveEvent.clientX - rect.left, minPx, maxPx)
            setSplit(nextPx / rect.width)
        }

        const handleUp = () => {
            terminalDraggingRef.current = false
            document.body.style.userSelect = ''
            window.removeEventListener('pointermove', handleMove)
            window.removeEventListener('pointerup', handleUp)
        }

        window.addEventListener('pointermove', handleMove)
        window.addEventListener('pointerup', handleUp)
    }

    const handleSidePanelPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        event.preventDefault()
        sidePanelDraggingRef.current = true
        document.body.style.userSelect = 'none'

        const handleMove = (moveEvent: PointerEvent) => {
            if (!sidePanelDraggingRef.current || !workspaceRef.current) {
                return
            }
            const rect = workspaceRef.current.getBoundingClientRect()
            const minPx = 180
            const maxPx = Math.max(minPx, rect.width - 320)
            const nextWidth = clamp(moveEvent.clientX - rect.left, minPx, maxPx)
            setSidePanelWidth(nextWidth)
        }

        const handleUp = () => {
            sidePanelDraggingRef.current = false
            document.body.style.userSelect = ''
            window.removeEventListener('pointermove', handleMove)
            window.removeEventListener('pointerup', handleUp)
        }

        window.addEventListener('pointermove', handleMove)
        window.addEventListener('pointerup', handleUp)
    }

    useEffect(() => {
        const saved = localStorage.getItem(splitKey)
        if (!saved) {
            return
        }
        const next = Number.parseFloat(saved)
        if (Number.isFinite(next)) {
            setSplit(clamp(next, 0.2, 0.8))
        }
    }, [])

    useEffect(() => {
        const savedWidth = localStorage.getItem(sidePanelWidthKey)
        if (!savedWidth) {
            return
        }
        const next = Number.parseFloat(savedWidth)
        if (Number.isFinite(next)) {
            setSidePanelWidth(clamp(next, 180, 520))
        }
    }, [])

    useEffect(() => {
        const savedHidden = localStorage.getItem(sidePanelHiddenKey)
        if (savedHidden === '1') {
            setSidePanelHidden(true)
        }

        const savedEditorHidden = localStorage.getItem(editorHiddenKey)
        if (savedEditorHidden === '1') {
            setEditorHidden(true)
        }
    }, [])

    useEffect(() => {
        localStorage.setItem(splitKey, String(split))
    }, [split])

    useEffect(() => {
        localStorage.setItem(sidePanelWidthKey, String(sidePanelWidth))
    }, [sidePanelWidth])

    useEffect(() => {
        localStorage.setItem(sidePanelHiddenKey, sidePanelHidden ? '1' : '0')
    }, [sidePanelHidden])

    useEffect(() => {
        localStorage.setItem(editorHiddenKey, editorHidden ? '1' : '0')
    }, [editorHidden])

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const key = event.key.toLowerCase()
            if (event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey && key === 'c') {
                event.preventDefault()
                setEditorFullscreen((prev) => !prev)
                return
            }
            if (event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey && key === 'e') {
                event.preventDefault()
                setSidePanelHidden((prev) => !prev)
                return
            }
            if (event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey && key === 'w') {
                event.preventDefault()
                setEditorHidden((prev) => !prev)
                return
            }
            const isMod = event.metaKey || event.ctrlKey
            if (!isMod || !event.altKey) {
                return
            }

            if (event.key === '1') {
                event.preventDefault()
                setSplit(0.4)
            } else if (event.key === '2') {
                event.preventDefault()
                setSplit(0.5)
            } else if (event.key === '3') {
                event.preventDefault()
                setSplit(0.6)
            } else if (event.key === 'ArrowLeft') {
                event.preventDefault()
                setSplit((prev) => clamp(prev - 0.05, 0.2, 0.8))
            } else if (event.key === 'ArrowRight') {
                event.preventDefault()
                setSplit((prev) => clamp(prev + 0.05, 0.2, 0.8))
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    useEffect(() => {
        const handleSplitEvent = (event: Event) => {
            const detail = (event as CustomEvent<number>).detail
            if (!Number.isFinite(detail)) {
                return
            }
            setSplit(clamp(detail, 0.2, 0.8))
        }

        window.addEventListener('dms:split', handleSplitEvent)
        return () => window.removeEventListener('dms:split', handleSplitEvent)
    }, [])

    const rightGridColumns = editorFullscreen || editorHidden
        ? '100%'
        : `${split * 100}% 6px ${100 - split * 100}%`

    return (
        <div className="h-full w-full overflow-hidden bg-[#0b0d12] text-[#d4d4d4]">
            <div className="flex h-full w-full">
                {/* Activity Bar */}
                <div
                    className={`flex h-full overflow-hidden transition-[width,opacity] duration-300 ease-out ${
                        editorFullscreen ? 'w-0 opacity-0 pointer-events-none' : 'w-12'
                    }`}
                >
                    {activityBar}
                </div>

                <div ref={workspaceRef} className="flex h-full min-w-0 flex-1 overflow-hidden">
                    {/* Side Panel (Explorer or Git) */}
                    {!editorFullscreen && !sidePanelHidden ? (
                        <>
                            <aside
                                className="relative flex h-full flex-col overflow-hidden border-r border-white/5 bg-[#0f0f0f] transition-[width,opacity] duration-200 ease-out"
                                style={{ width: sidePanelWidth }}
                            >
                                <button
                                    type="button"
                                    className="absolute right-2 top-2 z-10 rounded border border-white/15 bg-black/40 px-2 py-1 text-[11px] leading-none text-white/80 hover:bg-white/10 hover:text-white"
                                    onClick={() => setSidePanelHidden(true)}
                                    title="Ocultar panel lateral (Shift+E)"
                                >
                                    ×
                                </button>
                                {sidePanel}
                            </aside>
                            <div
                                className="w-2 cursor-col-resize bg-[#2a2a2a] hover:bg-blue-500/50"
                                onPointerDown={handleSidePanelPointerDown}
                                onDoubleClick={() => setSidePanelHidden(true)}
                                title="Redimensionar Explorer"
                            />
                        </>
                    ) : null}

                    <div
                        ref={rightRef}
                        className="relative grid h-full flex-1 transition-[grid-template-columns] duration-300 ease-out"
                        style={{ gridTemplateColumns: rightGridColumns }}
                    >
                        {!editorFullscreen && sidePanelHidden ? (
                            <button
                                type="button"
                                className="absolute left-2 top-2 z-20 rounded border border-white/15 bg-black/40 px-2 py-1 text-[11px] text-white/70 hover:bg-white/10 hover:text-white"
                                onClick={() => setSidePanelHidden(false)}
                                title="Mostrar panel lateral (Shift+E)"
                            >
                                Explorer
                            </button>
                        ) : null}

                        {editorFullscreen ? (
                            <main className="relative h-full w-full overflow-hidden bg-[#1e1e1e]">
                                {editor}
                            </main>
                        ) : (
                            <>
                                {/* Column 2: Terminal */}
                                <section className="relative h-full w-full overflow-hidden border-r border-white/5 bg-[#0b0d12]">
                                    {editorHidden ? (
                                        <button
                                            type="button"
                                            className="absolute right-2 top-2 z-20 rounded border border-white/15 bg-black/40 px-2 py-1 text-[11px] text-white/70 hover:bg-white/10 hover:text-white"
                                            onClick={() => setEditorHidden(false)}
                                            title="Mostrar editor (Shift+W)"
                                        >
                                            Editor
                                        </button>
                                    ) : null}
                                    {terminal}
                                </section>

                                {/* Resizer */}
                                {!editorHidden ? (
                                    <div
                                        className="cursor-col-resize bg-[#1f1f1f] hover:bg-blue-500/40"
                                        onPointerDown={handleTerminalPointerDown}
                                        title="Redimensionar terminal/editor"
                                    />
                                ) : null}

                                {/* Column 3: Code Editor */}
                                {!editorHidden ? (
                                    <main className="relative h-full w-full overflow-hidden bg-[#1e1e1e]">
                                        <button
                                            type="button"
                                            className="absolute right-2 top-2 z-20 rounded border border-white/15 bg-black/40 px-2 py-1 text-[11px] text-white/70 hover:bg-white/10 hover:text-white"
                                            onClick={() => setEditorHidden(true)}
                                            title="Ocultar editor (Shift+W)"
                                        >
                                            Hide
                                        </button>
                                        {editor}
                                    </main>
                                ) : null}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

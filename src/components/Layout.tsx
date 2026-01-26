import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

interface LayoutProps {
    activityBar: ReactNode
    sidePanel: ReactNode
    editor: ReactNode
    terminal: ReactNode
}

export function Layout({ activityBar, sidePanel, editor, terminal }: LayoutProps) {
    const rightRef = useRef<HTMLDivElement | null>(null)
    const draggingRef = useRef(false)
    const [split, setSplit] = useState(0.5)
    const splitKey = 'dms.terminalSplit'

    const clamp = (value: number, min: number, max: number) =>
        Math.max(min, Math.min(max, value))

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        event.preventDefault()
        draggingRef.current = true
        document.body.style.userSelect = 'none'
        event.currentTarget.setPointerCapture(event.pointerId)
    }

    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!draggingRef.current || !rightRef.current) {
            return
        }

        const rect = rightRef.current.getBoundingClientRect()
        const minPx = 240
        const maxPx = rect.width - minPx
        const nextPx = clamp(event.clientX - rect.left, minPx, maxPx)
        setSplit(nextPx / rect.width)
    }

    const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
        draggingRef.current = false
        document.body.style.userSelect = ''
        event.currentTarget.releasePointerCapture(event.pointerId)
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
        localStorage.setItem(splitKey, String(split))
    }, [split])

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
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

    return (
        <div className="h-full w-full overflow-hidden bg-[#0b0d12] text-[#d4d4d4]">
            <div className="flex h-full w-full">
                {/* Activity Bar */}
                {activityBar}

                {/* Side Panel (Explorer or Git) */}
                <aside className="flex h-full w-[240px] flex-col overflow-hidden border-r border-white/5 bg-[#0f0f0f]">
                    {sidePanel}
                </aside>

                <div
                    ref={rightRef}
                    className="grid h-full flex-1"
                    style={{
                        gridTemplateColumns: `${split * 100}% 6px ${100 - split * 100}%`,
                    }}
                >
                    {/* Column 2: Terminal */}
                    <section className="relative h-full w-full overflow-hidden border-r border-white/5 bg-[#0b0d12]">
                        {terminal}
                    </section>

                    {/* Resizer */}
                    <div
                        className="cursor-col-resize bg-[#1f1f1f] hover:bg-blue-500/40"
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                    />

                    {/* Column 3: Code Editor */}
                    <main className="relative h-full w-full overflow-hidden bg-[#1e1e1e]">
                        {editor}
                    </main>
                </div>
            </div>
        </div>
    )
}

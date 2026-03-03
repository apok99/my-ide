import { useRef, useEffect, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'

interface TerminalWindowProps {
    id: string
    isActive: boolean
    onFocus: () => void
    onClose: () => void
    cwd?: string
    title?: string
    initialCommand?: string
}

export function TerminalWindow({
    id,
    isActive,
    onFocus,
    onClose,
    cwd,
    title,
    initialCommand,
}: TerminalWindowProps) {
    const terminalRef = useRef<HTMLDivElement>(null)
    const terminalInstanceRef = useRef<Terminal | null>(null)
    const fitAddonRef = useRef<FitAddon | null>(null)
    const mountedRef = useRef(false)
    const commandSentRef = useRef<string | null>(null)

    // Mount Terminal - SOLO UNA VEZ
    useEffect(() => {
        if (!window.ide || !terminalRef.current || mountedRef.current) {
            return
        }

        console.log(`[Terminal ${id.slice(0, 8)}] 🚀 MOUNTING`)
        mountedRef.current = true

        const term = new Terminal({
            fontFamily: '"JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            fontSize: 14,
            cursorBlink: true,
            cursorStyle: 'block',
            theme: {
                background: '#1e1e1e00',
                foreground: '#d4d4d4',
            },
            allowTransparency: true,
        })

        const fitAddon = new FitAddon()
        fitAddonRef.current = fitAddon
        term.loadAddon(fitAddon)
        term.open(terminalRef.current)

        terminalInstanceRef.current = term

        // Start terminal
        window.ide.terminalStart(id, cwd)

        // ── Resize logic ────────────────────────────────────────────────────────
        //
        // safeFit: the ONLY place we call fitAddon.fit(). Always guards against
        // calling fit() when the element is invisible (display:none → 0x0), which
        // is what causes one terminal to collapse while others grow.
        //
        const safeFit = () => {
            const el = terminalRef.current
            const fit = fitAddonRef.current
            const tty = terminalInstanceRef.current
            if (!el || !fit || !tty) return
            // Guard: skip when element has no real dimensions
            if (el.offsetWidth === 0 || el.offsetHeight === 0) return
            try {
                fit.fit()
                window.ide.terminalResize(id, tty.cols, tty.rows)
            } catch {
                // ignore rare fit errors during rapid resizing
            }
        }

        // Debounced wrapper so rapid events coalesce into a single call.
        // 100ms is long enough to let CSS transitions (300ms) emit their last
        // ResizeObserver event before we call fit().
        let resizeTimer: ReturnType<typeof setTimeout> | null = null
        const schedFit = () => {
            if (resizeTimer) clearTimeout(resizeTimer)
            resizeTimer = setTimeout(safeFit, 100)
        }

        // Layer 1 – global resize events (also fired manually on panel/project switch)
        window.addEventListener('resize', schedFit)

        // Layer 2 – ResizeObserver on the terminal div: catches explorer/editor
        // panel resizes that don't produce a window resize event
        const resizeObserver = new ResizeObserver(schedFit)
        resizeObserver.observe(terminalRef.current)

        // Layer 3 – IntersectionObserver: fires when the element transitions from
        // hidden → visible (project switch, kanban toggle, editor hide/show).
        // This is the most reliable way to catch display:none → block cases.
        const intersectionObserver = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    schedFit()
                }
            }
        }, { threshold: 0 })
        intersectionObserver.observe(terminalRef.current)

        // Initial fit – delayed slightly so the layout has had a chance to paint
        setTimeout(safeFit, 150)

        // Handle Input
        term.onData((data) => {
            window.ide.terminalInput(id, data)
        })

        // Force focus
        setTimeout(() => {
            term.focus()
            console.log(`[Terminal ${id.slice(0, 8)}] 🎯 Focused`)
        }, 200)

        // Cleanup - DON'T reset mountedRef to prevent StrictMode remount issues
        return () => {
            console.log(`[Terminal ${id.slice(0, 8)}] 🧹 Unmounting`)
            window.removeEventListener('resize', schedFit)
            resizeObserver.disconnect()
            intersectionObserver.disconnect()
            if (resizeTimer) clearTimeout(resizeTimer)
            // Don't dispose or kill - React StrictMode may remount
            // term.dispose()
            // window.ide.terminalKill(id)
        }
    }, [id])

    useEffect(() => {
        if (!window.ide || !initialCommand || !mountedRef.current) {
            return
        }
        if (commandSentRef.current === initialCommand) {
            return
        }
        const timer = setTimeout(() => {
            window.ide.terminalInput(id, `${initialCommand}\r`)
            commandSentRef.current = initialCommand
        }, 220)
        return () => clearTimeout(timer)
    }, [id, initialCommand])

    // Handle Incoming Data
    useEffect(() => {
        if (!window.ide) return

        const unsubscribe = window.ide.onTerminalData((targetId: string, data: string) => {
            if (targetId === id && terminalInstanceRef.current) {
                terminalInstanceRef.current.write(data)
            }
        })

        return () => unsubscribe()
    }, [id])

    // Focus when active - let React handle this with proper timing
    useEffect(() => {
        if (isActive && terminalInstanceRef.current) {
            const timer = setTimeout(() => {
                terminalInstanceRef.current?.focus()
            }, 50)
            return () => clearTimeout(timer)
        }
    }, [isActive])

    // Simple click handler - notify parent AND force focus on terminal
    const handleClick = useCallback(() => {
        onFocus()
        setTimeout(() => {
            terminalInstanceRef.current?.focus()
        }, 0)
    }, [onFocus])

    return (
        <div
            className={`flex h-full w-full flex-col overflow-hidden rounded-xl border border-white/10 bg-[#1e1e1e]/90 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] backdrop-blur-md transition-shadow duration-200 ${isActive ? 'ring-1 ring-blue-500/50 shadow-blue-500/10' : 'opacity-80 grayscale-[0.3] hover:opacity-100 hover:grayscale-0'
                }`}
            onClick={handleClick}
        >
            <div
                className="flex select-none items-center justify-between border-b border-white/5 bg-white/[0.03] px-4 py-2.5"
            >
                <div className="flex items-center gap-2">
                    <div
                        className="group flex h-3 w-3 cursor-pointer items-center justify-center rounded-full bg-[#FF5F56] text-[8px] text-black/50 opacity-80 hover:opacity-100"
                        onClick={(e) => { e.stopPropagation(); onClose(); }}
                    >
                        <span className="opacity-0 group-hover:opacity-100">×</span>
                    </div>
                    <div className="h-3 w-3 rounded-full bg-[#FFBD2E] opacity-80" />
                    <div className="h-3 w-3 rounded-full bg-[#27C93F] opacity-80" />
                </div>
                <div className="flex items-center gap-2 text-[11px] font-medium text-white/40">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                        <path fillRule="evenodd" d="M2 4.25A2.25 2.25 0 014.25 2h11.5A2.25 2.25 0 0118 4.25v11.5A2.25 2.25 0 0115.75 18H4.25A2.25 2.25 0 012 15.75V4.25zm4.03 6.28a.75.75 0 00-1.06-1.06L2.47 12l2.5 2.53a.75.75 0 001.06-1.06L4.53 12l1.5-1.47zM12 12l2.5 2.53a.75.75 0 001.06-1.06L14.53 12l1.5-1.47a.75.75 0 00-1.06-1.06L12.47 12l2.53-2.53z" clipRule="evenodd" />
                        <path d="M7 6a1 1 0 000 2h6a1 1 0 100-2H7z" />
                    </svg>
                    <span>{title ?? 'zsh'}</span>
                </div>
            </div>

            <div className="flex-1 p-2">
                <div ref={terminalRef} className="h-full w-full" />
            </div>
        </div>
    )
}

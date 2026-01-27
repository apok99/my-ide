import type { MouseEvent } from 'react'
import { useEffect, useState } from 'react'
import type { FileNode } from '../../types'

const getFileBadge = (name: string) => {
    const lower = name.toLowerCase()
    if (lower === '.env' || lower.endsWith('.env')) {
        return { label: 'ENV', className: 'bg-emerald-500/20 text-emerald-300' }
    }
    if (lower.endsWith('.vue')) {
        return { label: 'VUE', className: 'bg-emerald-500/20 text-emerald-300' }
    }
    if (lower.endsWith('.tsx')) {
        return { label: 'TSX', className: 'bg-sky-500/20 text-sky-300' }
    }
    if (lower.endsWith('.ts')) {
        return { label: 'TS', className: 'bg-sky-500/20 text-sky-300' }
    }
    if (lower.endsWith('.jsx')) {
        return { label: 'JSX', className: 'bg-amber-500/20 text-amber-300' }
    }
    if (lower.endsWith('.js')) {
        return { label: 'JS', className: 'bg-amber-500/20 text-amber-300' }
    }
    return { label: 'FILE', className: 'bg-white/10 text-white/50' }
}

interface FileTreeProps {
    rootPath: string | null
    tree: FileNode[]
    expandedPaths: Set<string>
    activeFilePath: string | null
    onToggle: (node: FileNode) => void
    onSelect: (node: FileNode) => void
    onCreateFile: (dirPath: string, name: string) => void
    onCreateFolder: (dirPath: string, name: string) => void
    onRename: (node: FileNode) => void
    onDelete: (node: FileNode) => void
    onOpenFolder: () => void
    onOpenSearch: () => void
    onRevealActive: () => void
    codexStatus: string | null
    isElectron: boolean
}

const renderTree = (
    nodes: FileNode[],
    expanded: Set<string>,
    onToggle: (node: FileNode) => void,
    onSelect: (node: FileNode) => void,
    onContextMenu: (event: MouseEvent<HTMLButtonElement>, node: FileNode) => void,
) => {
    return nodes.map((node) => {
        if (node.kind === 'dir') {
            const isOpen = expanded.has(node.path)
            return (
                <div key={node.path}>
                    <button
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm text-[#d4d4d4] hover:bg-white/5 active:bg-white/10"
                        type="button"
                        onClick={() => onToggle(node)}
                        onContextMenu={(event) => onContextMenu(event, node)}
                        data-file-node
                    >
                        <span
                            className={`transform transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
                        >
                            ▶
                        </span>
                        <span className="truncate">{node.name}</span>
                    </button>
                    {isOpen && node.children && (
                        <div className="ml-3 border-l border-white/10 pl-2">
                            {renderTree(
                                node.children,
                                expanded,
                                onToggle,
                                onSelect,
                                onContextMenu,
                            )}
                        </div>
                    )}
                </div>
            )
        }

        return (
            <button
                className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm text-[#9da2a8] hover:bg-white/5 hover:text-[#d4d4d4]"
                type="button"
                onClick={() => onSelect(node)}
                key={node.path}
                onContextMenu={(event) => onContextMenu(event, node)}
                data-file-node
            >
                {(() => {
                    const badge = getFileBadge(node.name)
                    return (
                        <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ${badge.className}`}
                        >
                            {badge.label}
                        </span>
                    )
                })()}
                <span className="truncate">{node.name}</span>
            </button>
        )
    })
}

export function FileTree({
    rootPath,
    tree,
    expandedPaths,
    activeFilePath,
    onToggle,
    onSelect,
    onCreateFile,
    onCreateFolder,
    onRename,
    onDelete,
    onOpenFolder,
    onOpenSearch,
    onRevealActive,
    codexStatus,
    isElectron,
}: FileTreeProps) {
    const [contextMenu, setContextMenu] = useState<{
        x: number
        y: number
        node: FileNode | null
        targetDir: string | null
    } | null>(null)
    const [createDialog, setCreateDialog] = useState<{
        type: 'file' | 'folder'
        dirPath: string
        name: string
    } | null>(null)

    useEffect(() => {
        if (!contextMenu) {
            return
        }
        const handleClose = () => setContextMenu(null)
        window.addEventListener('click', handleClose)
        window.addEventListener('blur', handleClose)
        window.addEventListener('resize', handleClose)
        return () => {
            window.removeEventListener('click', handleClose)
            window.removeEventListener('blur', handleClose)
            window.removeEventListener('resize', handleClose)
        }
    }, [contextMenu])

    const openContextMenu = (event: MouseEvent<HTMLButtonElement>, node: FileNode) => {
        if (!isElectron) {
            return
        }
        event.preventDefault()
        event.stopPropagation()
        setContextMenu({
            x: event.clientX,
            y: event.clientY,
            node,
            targetDir: node.kind === 'dir' ? node.path : null,
        })
    }

    const openRootContextMenu = (event: MouseEvent<HTMLDivElement>) => {
        if (!isElectron || !rootPath) {
            return
        }
        const target = event.target as HTMLElement | null
        if (target && target.closest('[data-file-node]')) {
            return
        }
        event.preventDefault()
        setContextMenu({
            x: event.clientX,
            y: event.clientY,
            node: null,
            targetDir: rootPath,
        })
    }

    const handleCreateFile = (dirPath: string | null) => {
        if (!dirPath) {
            return
        }
        setContextMenu(null)
        setCreateDialog({ type: 'file', dirPath, name: '' })
    }

    const handleCreateFolder = (dirPath: string | null) => {
        if (!dirPath) {
            return
        }
        setContextMenu(null)
        setCreateDialog({ type: 'folder', dirPath, name: '' })
    }

    const handleRename = (node: FileNode | null) => {
        if (!node) {
            return
        }
        setContextMenu(null)
        onRename(node)
    }

    const handleDelete = (node: FileNode | null) => {
        if (!node) {
            return
        }
        setContextMenu(null)
        onDelete(node)
    }

    const getDefaultDir = () => {
        if (!rootPath) {
            return null
        }
        if (!activeFilePath) {
            return rootPath
        }
        const lastSlash = activeFilePath.lastIndexOf('/')
        if (lastSlash <= 0) {
            return rootPath
        }
        return activeFilePath.slice(0, lastSlash)
    }

    const handleCreateFileDefault = () => {
        handleCreateFile(getDefaultDir())
    }

    const handleCreateFolderDefault = () => {
        handleCreateFolder(getDefaultDir())
    }

    const handleOpen = (node: FileNode | null) => {
        if (!node) {
            return
        }
        setContextMenu(null)
        if (node.kind === 'file') {
            onSelect(node)
            return
        }
        onToggle(node)
    }

    const handleToggleFolder = (node: FileNode | null) => {
        if (!node || node.kind !== 'dir') {
            return
        }
        setContextMenu(null)
        onToggle(node)
    }

    const handleCopyPath = async (path: string | null) => {
        if (!path) {
            return
        }
        setContextMenu(null)
        if (navigator.clipboard?.writeText) {
            try {
                await navigator.clipboard.writeText(path)
                return
            } catch {
                // Fall through to prompt.
            }
        }
        window.prompt('Ruta', path)
    }

    const handleSubmitCreate = () => {
        if (!createDialog) {
            return
        }
        const name = createDialog.name.trim()
        if (!name) {
            return
        }
        const { type, dirPath } = createDialog
        setCreateDialog(null)
        if (type === 'file') {
            onCreateFile(dirPath, name)
        } else {
            onCreateFolder(dirPath, name)
        }
    }

    return (
        <div className="flex h-full flex-col" onContextMenu={openRootContextMenu}>
            <div className="flex flex-col gap-3 border-b border-white/5 p-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
                    Explorer
                </span>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={onOpenSearch}
                        className="rounded hover:bg-white/10 p-1 text-white/60 transition-colors"
                        title="Search in Files"
                        disabled={!isElectron || !rootPath}
                    >
                        🔍
                    </button>
                    <button
                        onClick={handleCreateFileDefault}
                        className="rounded hover:bg-white/10 p-1 text-white/60 transition-colors"
                        title="New File"
                        disabled={!isElectron || !rootPath}
                    >
                        ➕📄
                    </button>
                    <button
                        onClick={handleCreateFolderDefault}
                        className="rounded hover:bg-white/10 p-1 text-white/60 transition-colors"
                        title="New Folder"
                        disabled={!isElectron || !rootPath}
                    >
                        ➕📁
                    </button>
                    <button
                        onClick={onRevealActive}
                        className="rounded hover:bg-white/10 p-1 text-white/60 transition-colors"
                        title="Reveal Active File"
                        disabled={!isElectron || !rootPath || !activeFilePath}
                    >
                        🎯
                    </button>
                </div>
            </div>
            {codexStatus && (
                <div className="border-b border-white/5 px-4 py-2 text-[11px] text-white/60">
                    {codexStatus}
                </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto p-2 font-mono">
                {rootPath ? (
                    <div className="space-y-1">
                        <div className="px-2 py-1 text-xs font-bold text-blue-400 opacity-80 mb-2">
                            {rootPath.split('/').pop()}
                        </div>
                        {renderTree(tree, expandedPaths, onToggle, onSelect, openContextMenu)}
                    </div>
                ) : (
                    <div className="flex h-full flex-col items-center justify-center p-4 text-center text-sm text-white/30">
                        <p className="mb-4">No folder opened</p>
                        <button
                            onClick={onOpenFolder}
                            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-500"
                        >
                            Open Folder
                        </button>
                        {!isElectron && (
                            <p className="mt-4 text-xs text-red-400">
                                (Requires Electron)
                            </p>
                        )}
                    </div>
                )}
            </div>
            {contextMenu && (
                <div
                    className="fixed z-50 w-44 rounded-md border border-white/10 bg-[#0f111a] py-1 text-xs text-white/80 shadow-xl"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    {contextMenu.node?.kind === 'file' && (
                        <button
                            type="button"
                            className="flex w-full items-center px-3 py-2 text-left hover:bg-white/10"
                            onClick={() => handleOpen(contextMenu.node)}
                        >
                            Abrir
                        </button>
                    )}
                    {contextMenu.node?.kind === 'dir' && (
                        <button
                            type="button"
                            className="flex w-full items-center px-3 py-2 text-left hover:bg-white/10"
                            onClick={() => handleToggleFolder(contextMenu.node)}
                        >
                            {expandedPaths.has(contextMenu.node.path) ? 'Colapsar' : 'Expandir'}
                        </button>
                    )}
                    {contextMenu.targetDir && (
                        <>
                            <button
                                type="button"
                                className="flex w-full items-center px-3 py-2 text-left hover:bg-white/10"
                                onClick={() => handleCreateFile(contextMenu.targetDir)}
                            >
                                Nuevo archivo
                            </button>
                            <button
                                type="button"
                                className="flex w-full items-center px-3 py-2 text-left hover:bg-white/10"
                                onClick={() => handleCreateFolder(contextMenu.targetDir)}
                            >
                                Nueva carpeta
                            </button>
                        </>
                    )}
                    {(contextMenu.node || contextMenu.targetDir) && (
                        <>
                            <div className="mx-2 my-1 border-t border-white/10" />
                            <button
                                type="button"
                                className="flex w-full items-center px-3 py-2 text-left hover:bg-white/10"
                                onClick={() =>
                                    handleCopyPath(contextMenu.node?.path ?? contextMenu.targetDir)
                                }
                            >
                                Copiar ruta
                            </button>
                        </>
                    )}
                    {contextMenu.node && (
                        <>
                            <div className="mx-2 my-1 border-t border-white/10" />
                            <button
                                type="button"
                                className="flex w-full items-center px-3 py-2 text-left hover:bg-white/10"
                                onClick={() => handleRename(contextMenu.node)}
                            >
                                Renombrar
                            </button>
                            <button
                                type="button"
                                className="flex w-full items-center px-3 py-2 text-left text-red-300 hover:bg-white/10"
                                onClick={() => handleDelete(contextMenu.node)}
                            >
                                Eliminar
                            </button>
                        </>
                    )}
                </div>
            )}
            {createDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-xs rounded-md border border-white/10 bg-[#0f111a] p-4 text-sm text-white/80 shadow-xl">
                        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/50">
                            {createDialog.type === 'file' ? 'Nuevo archivo' : 'Nueva carpeta'}
                        </div>
                        <input
                            autoFocus
                            className="mb-3 w-full rounded-md border border-white/10 bg-[#0b0d12] px-3 py-2 text-sm text-white outline-none focus:border-blue-500/60"
                            placeholder={
                                createDialog.type === 'file'
                                    ? 'Nombre de archivo'
                                    : 'Nombre de carpeta'
                            }
                            value={createDialog.name}
                            onChange={(event) =>
                                setCreateDialog((prev) =>
                                    prev ? { ...prev, name: event.target.value } : prev,
                                )
                            }
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    handleSubmitCreate()
                                }
                                if (event.key === 'Escape') {
                                    setCreateDialog(null)
                                }
                            }}
                        />
                        <div className="flex items-center justify-end gap-2 text-xs">
                            <button
                                type="button"
                                className="rounded px-2 py-1 text-white/60 hover:bg-white/10"
                                onClick={() => setCreateDialog(null)}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className="rounded bg-blue-600/20 px-2 py-1 font-semibold text-blue-300 hover:bg-blue-600/30"
                                onClick={handleSubmitCreate}
                            >
                                Crear
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

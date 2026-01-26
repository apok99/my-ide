import type { FileNode } from '../../types'

interface FileTreeProps {
    rootPath: string | null
    tree: FileNode[]
    expandedPaths: Set<string>
    onToggle: (node: FileNode) => void
    onSelect: (node: FileNode) => void
    onOpenFolder: () => void
    onOpenFile: () => void
    onOpenSearch: () => void
    onCodexCommit: () => void
    codexStatus: string | null
    codexRunning: boolean
    isElectron: boolean
}

const renderTree = (
    nodes: FileNode[],
    expanded: Set<string>,
    onToggle: (node: FileNode) => void,
    onSelect: (node: FileNode) => void,
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
                            {renderTree(node.children, expanded, onToggle, onSelect)}
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
            >
                <span className="opacity-50">📄</span>
                <span className="truncate">{node.name}</span>
            </button>
        )
    })
}

export function FileTree({
    rootPath,
    tree,
    expandedPaths,
    onToggle,
    onSelect,
    onOpenFolder,
    onOpenFile,
    onOpenSearch,
    onCodexCommit,
    codexStatus,
    codexRunning,
    isElectron,
}: FileTreeProps) {
    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-white/5 p-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
                    Explorer
                </span>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onOpenFolder}
                        className="rounded hover:bg-white/10 p-1 text-white/60 transition-colors"
                        title="Open Folder"
                        disabled={!isElectron}
                    >
                        📂
                    </button>
                    <button
                        onClick={onOpenFile}
                        className="rounded hover:bg-white/10 p-1 text-white/60 transition-colors"
                        title="Open File"
                        disabled={!isElectron}
                    >
                        📄
                    </button>
                    <button
                        onClick={onOpenSearch}
                        className="rounded hover:bg-white/10 p-1 text-white/60 transition-colors"
                        title="Search in Files"
                        disabled={!isElectron || !rootPath}
                    >
                        🔍
                    </button>
                    <button
                        onClick={onCodexCommit}
                        className="rounded bg-blue-600/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-blue-300 hover:bg-blue-600/30 disabled:opacity-50"
                        disabled={!isElectron || codexRunning}
                        title="Codex: create commit and push"
                    >
                        {codexRunning ? 'Codex…' : 'Codex Commit'}
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
                        {renderTree(tree, expandedPaths, onToggle, onSelect)}
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
        </div>
    )
}

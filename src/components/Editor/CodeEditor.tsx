import Editor, { DiffEditor, type Monaco } from '@monaco-editor/react'
import type { DiffTarget, LoadedFile } from '../../types'

interface CodeEditorProps {
    openFiles: LoadedFile[]
    activeFilePath: string | null
    isLoading: boolean
    onSave: () => void
    onChange: (value: string | undefined) => void
    onSelectTab: (path: string) => void
    onCloseTab: (path: string) => void
    diffTarget: DiffTarget | null
    onCloseDiff: () => void
}

const languageByExtension: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    css: 'css',
    html: 'html',
    md: 'markdown',
    php: 'php',
}

const getLanguage = (filename: string) => {
    const parts = filename.split('.')
    const ext = parts[parts.length - 1]?.toLowerCase()
    return (ext && languageByExtension[ext]) || 'plaintext'
}

export function CodeEditor({
    openFiles,
    activeFilePath,
    isLoading,
    onSave,
    onChange,
    onSelectTab,
    onCloseTab,
    diffTarget,
    onCloseDiff,
}: CodeEditorProps) {
    const activeFile = openFiles.find((file) => file.path === activeFilePath) ?? null

    const handleBeforeMount = (monaco: Monaco) => {
        monaco.editor.defineTheme('vscode-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [],
            colors: {
                'editor.background': '#1e1e1e',
                'editor.lineHighlightBackground': '#2a2d2e',
                'editorLineNumber.foreground': '#5a5a5a',
                'editorLineNumber.activeForeground': '#c6c6c6',
                'editorCursor.foreground': '#aeafad',
                'editor.selectionBackground': '#264f78',
                'editor.inactiveSelectionBackground': '#3a3d41',
                'editorWhitespace.foreground': '#2a2a2a',
            },
        })
    }

    return (
        <div className="flex h-full flex-col bg-[#1e1e1e]">
            {/* Tab Bar */}
            <div className="flex h-10 items-center border-b border-black/20 bg-[#1e1e1e]">
                {openFiles.length > 0 ? (
                    <div className="flex h-full w-full items-center overflow-x-auto">
                        {openFiles.map((file) => {
                            const isActive = file.path === activeFilePath
                            return (
                                <button
                                    key={file.path}
                                    type="button"
                                    onClick={() => onSelectTab(file.path)}
                                    className={`group relative flex h-full min-w-[150px] items-center justify-between gap-2 border-r border-black/20 px-3 text-xs font-medium ${isActive
                                        ? 'bg-[#252526] text-slate-200 before:absolute before:top-0 before:left-0 before:h-[2px] before:w-full before:bg-blue-500'
                                        : 'bg-[#1e1e1e] text-slate-400 hover:bg-[#2a2a2a]'
                                        }`}
                                >
                                    <span className="flex items-center gap-2 truncate">
                                        <span className="opacity-70">📝</span>
                                        {file.name}
                                        {file.dirty ? <span className="text-blue-300">*</span> : null}
                                    </span>
                                    <span
                                        className="flex h-5 w-5 items-center justify-center rounded-md text-slate-500 hover:bg-white/10 hover:text-slate-200"
                                        onClick={(event) => {
                                            event.stopPropagation()
                                            onCloseTab(file.path)
                                        }}
                                    >
                                        ×
                                    </span>
                                </button>
                            )
                        })}
                        {diffTarget ? (
                            <div className="ml-2 flex items-center gap-2 rounded-md bg-[#252526] px-3 py-1 text-xs text-slate-200">
                                <span className="opacity-70">Δ</span>
                                <span className="truncate max-w-[200px]">
                                    Diff: {diffTarget.filePath.split('/').pop()}
                                </span>
                                <button
                                    type="button"
                                    onClick={onCloseDiff}
                                    className="text-slate-400 hover:text-white"
                                >
                                    ×
                                </button>
                            </div>
                        ) : null}
                    </div>
                ) : (
                    <div className="px-4 text-xs italic text-white/20">No active editor</div>
                )}
            </div>

            {/* Editor Surface */}
            <div className="relative flex-1 min-h-0 overflow-hidden bg-[#1e1e1e]">
                {diffTarget ? (
                    <DiffEditor
                        height="100%"
                        width="100%"
                        theme="vscode-dark"
                        original={diffTarget.original}
                        modified={diffTarget.modified}
                        language={getLanguage(diffTarget.filePath)}
                        beforeMount={handleBeforeMount}
                        options={{
                            renderSideBySide: true,
                            readOnly: false,
                            automaticLayout: true,
                            minimap: { enabled: false },
                        }}
                    />
                ) : activeFile ? (
                    <Editor
                        height="100%"
                        width="100%"
                        theme="vscode-dark"
                        language={getLanguage(activeFile.name)}
                        value={activeFile.content}
                        beforeMount={handleBeforeMount}
                        options={{
                            fontSize: 15,
                            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                            minimap: { enabled: false },
                            padding: { top: 16, bottom: 16 },
                            wordWrap: 'on',
                            scrollBeyondLastLine: false,
                            automaticLayout: true,
                            smoothScrolling: true,
                            cursorBlinking: 'smooth',
                            cursorSmoothCaretAnimation: 'on',
                            renderLineHighlight: 'line',
                            lineNumbers: 'on',
                            tabSize: 2,
                        }}
                        onChange={onChange}
                    />
                ) : (
                    <div className="flex h-full flex-col items-center justify-center text-white/20">
                        <div className="mb-4 text-4xl opacity-20">⌨️</div>
                        <p className="font-medium">{isLoading ? 'Loading...' : 'Select a file to edit'}</p>
                        <p className="text-xs opacity-50 mt-2">⌘S to save</p>
                    </div>
                )}
            </div>
        </div>
    )
}

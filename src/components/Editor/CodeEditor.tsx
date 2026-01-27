import { useRef } from 'react'
import Editor, { DiffEditor, type Monaco } from '@monaco-editor/react'
import type { editor as MonacoEditor } from 'monaco-editor'
import type { DiffTarget, LoadedFile, ProblemItem } from '../../types'

interface CodeEditorProps {
    openFiles: LoadedFile[]
    activeFilePath: string | null
    isLoading: boolean
    onChange: (value: string | undefined) => void
    onSelectTab: (path: string) => void
    onCloseTab: (path: string) => void
    onRequestRefresh: () => void
    diffTarget: DiffTarget | null
    onCloseDiff: () => void
    onEditorReady?: (editor: MonacoEditor.IStandaloneCodeEditor, monaco: Monaco) => void
    onProblemsChange?: (problems: ProblemItem[]) => void
    onOpenToken?: (token: string, line: string, column: number) => void
}

const languageByExtension: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    vue: 'html',
    env: 'ini',
    json: 'json',
    css: 'css',
    html: 'html',
    md: 'markdown',
    php: 'php',
}

const getTabBadge = (name: string) => {
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

const getLanguage = (filename: string) => {
    const lower = filename.toLowerCase()
    if (lower === '.env' || lower.startsWith('.env.')) {
        return 'ini'
    }
    const parts = filename.split('.')
    const ext = parts[parts.length - 1]?.toLowerCase()
    return (ext && languageByExtension[ext]) || 'plaintext'
}

export function CodeEditor({
    openFiles,
    activeFilePath,
    isLoading,
    onChange,
    onSelectTab,
    onCloseTab,
    onRequestRefresh,
    diffTarget,
    onCloseDiff,
    onEditorReady,
    onProblemsChange,
    onOpenToken,
}: CodeEditorProps) {
    const activeFile = openFiles.find((file) => file.path === activeFilePath) ?? null
    const methodDecorationsRef = useRef<string[]>([])

    const handleBeforeMount = (monaco: Monaco) => {
        monaco.editor.defineTheme('vscode-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [
                { token: 'type.identifier', foreground: '56d1b2' },
                { token: 'type.identifier.php', foreground: '56d1b2' },
                { token: 'entity.name.function', foreground: 'ffeeb0' },
                { token: 'entity.name.function.php', foreground: 'ffeeb0' },
                { token: 'support.function', foreground: 'ffeeb0' },
                { token: 'support.function.php', foreground: 'ffeeb0' },
                { token: 'variable', foreground: '96e8ff' },
                { token: 'variable.other', foreground: '96e8ff' },
                { token: 'variable.other.readwrite', foreground: '96e8ff' },
                { token: 'variable.php', foreground: '96e8ff' },
                { token: 'identifier.php', foreground: '56d1b2' },
            ],
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
        monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
            noSemanticValidation: false,
            noSyntaxValidation: false,
        })
        monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
            noSemanticValidation: false,
            noSyntaxValidation: false,
        })
    }

    const getProblems = (monaco: Monaco) => {
        const markers = monaco.editor.getModelMarkers({})
        return markers.map<ProblemItem>((marker: MonacoEditor.IMarker) => {
            const rawPath = marker.resource?.fsPath || decodeURIComponent(marker.resource?.path ?? '')
            return {
                filePath: rawPath,
                line: marker.startLineNumber,
                column: marker.startColumn,
                message: marker.message,
                severity:
                    marker.severity === monaco.MarkerSeverity.Error
                        ? 'error'
                        : marker.severity === monaco.MarkerSeverity.Warning
                            ? 'warning'
                            : marker.severity === monaco.MarkerSeverity.Info
                                ? 'info'
                                : 'hint',
                source: marker.source,
            }
        })
    }

    const applyPhpMethodDecorations = (
        editor: MonacoEditor.IStandaloneCodeEditor,
        monaco: Monaco,
    ) => {
        const model = editor.getModel()
        if (!model || model.getLanguageId() !== 'php') {
            methodDecorationsRef.current = editor.deltaDecorations(methodDecorationsRef.current, [])
            return
        }
        const text = model.getValue()
        const regex = /(?:->|::)\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(/g
        const decorations: MonacoEditor.IModelDeltaDecoration[] = []
        let match: RegExpExecArray | null
        while ((match = regex.exec(text))) {
            const name = match[1]
            const nameIndex = match.index + match[0].lastIndexOf(name)
            const start = model.getPositionAt(nameIndex)
            const end = model.getPositionAt(nameIndex + name.length)
            decorations.push({
                range: new monaco.Range(
                    start.lineNumber,
                    start.column,
                    end.lineNumber,
                    end.column,
                ),
                options: { inlineClassName: 'monaco-php-method' },
            })
        }
        methodDecorationsRef.current = editor.deltaDecorations(
            methodDecorationsRef.current,
            decorations,
        )
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
                                        {(() => {
                                            const badge = getTabBadge(file.name)
                                            return (
                                                <span
                                                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ${badge.className}`}
                                                >
                                                    {badge.label}
                                                </span>
                                            )
                                        })()}
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
                        key={`${diffTarget.filePath}:${diffTarget.original.length}:${diffTarget.modified.length}`}
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
                        path={activeFile.path}
                        value={activeFile.content}
                        beforeMount={handleBeforeMount}
                        onMount={(editor, monaco) => {
                            editor.onDidFocusEditorWidget(() => {
                                onRequestRefresh()
                            })
                            onEditorReady?.(editor, monaco)
                            const update = () => {
                                onProblemsChange?.(getProblems(monaco))
                            }
                            update()
                            const markerListener = monaco.editor.onDidChangeMarkers(update)
                            applyPhpMethodDecorations(editor, monaco)
                            const modelListener = editor.onDidChangeModel(() => {
                                applyPhpMethodDecorations(editor, monaco)
                            })
                            const contentListener = editor.onDidChangeModelContent(() => {
                                applyPhpMethodDecorations(editor, monaco)
                            })
                            const clickListener = editor.onMouseDown((event) => {
                                if (!onOpenToken) {
                                    return
                                }
                                if (!event.event.ctrlKey && !event.event.metaKey) {
                                    return
                                }
                                const position = event.target.position
                                const model = editor.getModel()
                                if (!position || !model) {
                                    return
                                }
                                const word = model.getWordAtPosition(position)
                                const lineContent = model.getLineContent(position.lineNumber)
                                onOpenToken(word?.word ?? '', lineContent, position.column)
                            })
                            editor.onDidDispose(() => {
                                markerListener.dispose()
                                modelListener.dispose()
                                contentListener.dispose()
                                clickListener.dispose()
                            })
                        }}
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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FileItem, FileNode, LoadedFile, SearchResult } from './types'
import { Layout } from './components/Layout'
import { FileTree } from './components/FileTree/FileTree'
import { CodeEditor } from './components/Editor/CodeEditor'
import { TerminalManager } from './components/Terminal/TerminalManager'
import { SearchPalette } from './components/Search/SearchPalette'
import { ActivityBar } from './components/ActivityBar'
import { GitPanel } from './components/Git/GitPanel'

type ProjectState = {
  id: string
  name: string
  rootPath: string
  tree: FileNode[]
  expandedPaths: Set<string>
  openFiles: LoadedFile[]
  openFilePaths: string[]
  activeFilePath: string | null
  gitStatus: { isRepo: boolean; clean: boolean; changes: string[] } | null
  gitMessage: string
}

type PersistedProject = {
  id: string
  name?: string
  rootPath: string
  openFilePaths: string[]
  activeFilePath: string | null
  expandedPaths: string[]
}

const projectsKey = 'dms.projects'
const activeProjectKey = 'dms.activeProjectId'
const sidePanelKey = 'dms.sidePanel'

function App() {
  const [projects, setProjects] = useState<ProjectState[]>([])
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [codexStatus, setCodexStatus] = useState<string | null>(null)
  const [codexRunning, setCodexRunning] = useState(false)
  const [paletteMode, setPaletteMode] = useState<'file' | 'search' | null>(null)
  const [paletteQuery, setPaletteQuery] = useState('')
  const [paletteResults, setPaletteResults] = useState<Array<FileItem | SearchResult>>([])
  const [paletteIndex, setPaletteIndex] = useState(0)
  const [sidePanel, setSidePanel] = useState<'explorer' | 'git'>('explorer')
  const lastShiftTimeRef = useRef<number | null>(null)

  const isElectron = Boolean(window.ide)

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) ?? null,
    [projects, activeProjectId],
  )

  const fileList = useMemo(() => {
    const items: FileItem[] = []
    if (!activeProject) {
      return items
    }
    const walk = (nodes: FileNode[]) => {
      nodes.forEach((node) => {
        if (node.kind === 'file') {
          items.push({ path: node.path, name: node.name })
        } else if (node.children) {
          walk(node.children)
        }
      })
    }
    walk(activeProject.tree)
    return items
  }, [activeProject])

  const updateProject = useCallback((id: string, updater: (project: ProjectState) => ProjectState) => {
    setProjects((prev) => prev.map((project) => (project.id === id ? updater(project) : project)))
  }, [])

  const handleOpenFolder = useCallback(async () => {
    if (!window.ide) {
      alert('This feature requires the app to terminate in Electron.')
      return
    }

    const result = await window.ide.selectFolder()
    if (!result) {
      return
    }

    const existing = projects.find((project) => project.rootPath === result.rootPath)
    if (existing) {
      setActiveProjectId(existing.id)
      return
    }

    const name = result.rootPath.split('/').pop() ?? result.rootPath
    const id = crypto.randomUUID()
    setProjects((prev) => [
      ...prev,
      {
        id,
        name,
        rootPath: result.rootPath,
        tree: result.tree,
        expandedPaths: new Set([result.rootPath]),
        openFiles: [],
        openFilePaths: [],
        activeFilePath: null,
        gitStatus: null,
        gitMessage: '',
      },
    ])
    setActiveProjectId(id)
  }, [projects])

  const handleToggle = useCallback(
    (node: FileNode) => {
      if (!activeProject) {
        return
      }
      updateProject(activeProject.id, (project) => {
        const next = new Set(project.expandedPaths)
        if (next.has(node.path)) {
          next.delete(node.path)
        } else {
          next.add(node.path)
        }
        return { ...project, expandedPaths: next }
      })
    },
    [activeProject, updateProject],
  )

  const handleSelect = useCallback(
    async (node: FileNode) => {
      if (!window.ide || node.kind !== 'file' || !activeProject) {
        return
      }

      setIsLoading(true)
      try {
        const content = await window.ide.readFile(node.path)
        updateProject(activeProject.id, (project) => {
          const existing = project.openFiles.find((file) => file.path === node.path)
          if (existing) {
            return { ...project, activeFilePath: node.path }
          }
          const nextOpenFiles = [
            ...project.openFiles,
            { path: node.path, name: node.name, content, dirty: false },
          ]
          return {
            ...project,
            openFiles: nextOpenFiles,
            openFilePaths: nextOpenFiles.map((file) => file.path),
            activeFilePath: node.path,
          }
        })
      } finally {
        setIsLoading(false)
      }
    },
    [activeProject, updateProject],
  )

  const openFileByPath = useCallback(
    async (filePath: string) => {
      if (!window.ide || !activeProject) {
        return
      }

      setIsLoading(true)
      try {
        const content = await window.ide.readFile(filePath)
        const name = filePath.split('/').pop() ?? filePath
        updateProject(activeProject.id, (project) => {
          const existing = project.openFiles.find((file) => file.path === filePath)
          if (existing) {
            return { ...project, activeFilePath: filePath }
          }
          const nextOpenFiles = [
            ...project.openFiles,
            { path: filePath, name, content, dirty: false },
          ]
          return {
            ...project,
            openFiles: nextOpenFiles,
            openFilePaths: nextOpenFiles.map((file) => file.path),
            activeFilePath: filePath,
          }
        })
      } finally {
        setIsLoading(false)
      }
    },
    [activeProject, updateProject],
  )

  const handleOpenFileDialog = useCallback(async () => {
    if (!window.ide) {
      return
    }

    const result = await window.ide.openFile()
    if (!result) {
      return
    }

    const existing = projects.find((project) => project.rootPath === result.rootPath)
    if (existing) {
      setActiveProjectId(existing.id)
      await openFileByPath(result.filePath)
      return
    }

    const name = result.rootPath.split('/').pop() ?? result.rootPath
    const id = crypto.randomUUID()
    setProjects((prev) => [
      ...prev,
      {
        id,
        name,
        rootPath: result.rootPath,
        tree: result.tree,
        expandedPaths: new Set([result.rootPath]),
        openFiles: [
          {
            path: result.filePath,
            name: result.filePath.split('/').pop() ?? result.filePath,
            content: result.content,
            dirty: false,
          },
        ],
        openFilePaths: [result.filePath],
        activeFilePath: result.filePath,
        gitStatus: null,
        gitMessage: '',
      },
    ])
    setActiveProjectId(id)
  }, [openFileByPath, projects])

  const handleNewProject = useCallback(() => {
    const id = crypto.randomUUID()
    const name = `Proyecto sin titulo ${projects.length + 1}`
    setProjects((prev) => [
      ...prev,
      {
        id,
        name,
        rootPath: '',
        tree: [],
        expandedPaths: new Set(),
        openFiles: [],
        openFilePaths: [],
        activeFilePath: null,
        gitStatus: null,
        gitMessage: '',
      },
    ])
    setActiveProjectId(id)
  }, [projects.length])

  const handleSave = useCallback(async () => {
    if (!window.ide || !activeProject) {
      return
    }

    const target = activeProject.openFiles.find((file) => file.path === activeProject.activeFilePath)
    if (!target) {
      return
    }

    try {
      await window.ide.writeFile(target.path, target.content)
      updateProject(activeProject.id, (project) => {
        const nextOpenFiles = project.openFiles.map((file) =>
          file.path === target.path ? { ...file, dirty: false } : file,
        )
        return { ...project, openFiles: nextOpenFiles }
      })
    } catch (err) {
      console.error('Failed to save', err)
    }
  }, [activeProject, updateProject])

  const handleGitRefresh = useCallback(async () => {
    if (!window.ide || !activeProject?.rootPath) {
      return
    }
    const status = await window.ide.gitStatus(activeProject.rootPath)
    updateProject(activeProject.id, (project) => ({ ...project, gitStatus: status }))
  }, [activeProject, updateProject])

  const handleGitInit = useCallback(async () => {
    if (!window.ide || !activeProject?.rootPath) {
      return
    }
    await window.ide.gitInit(activeProject.rootPath)
    handleGitRefresh()
  }, [activeProject, handleGitRefresh])

  const handleGitCommit = useCallback(async () => {
    if (!window.ide || !activeProject?.rootPath) {
      return
    }
    const message = activeProject.gitMessage || 'Update'
    await window.ide.gitCommit(activeProject.rootPath, message)
    handleGitRefresh()
  }, [activeProject, handleGitRefresh])

  const handleGitPull = useCallback(async () => {
    if (!window.ide || !activeProject?.rootPath) {
      return
    }
    await window.ide.gitPull(activeProject.rootPath)
    handleGitRefresh()
  }, [activeProject, handleGitRefresh])

  const handleGitPush = useCallback(async () => {
    if (!window.ide || !activeProject?.rootPath) {
      return
    }
    await window.ide.gitPush(activeProject.rootPath)
    handleGitRefresh()
  }, [activeProject, handleGitRefresh])

  const handleAutoCommit = useCallback(async () => {
    if (!window.ide || !activeProject?.rootPath) {
      return
    }
    setCodexRunning(true)
    setCodexStatus('Ejecutando Codex: creando commit y push...')
    try {
      const result = await window.ide.codexCommit(
        'Haz git add -A, crea un commit con un mensaje claro segun los cambios y haz git push.',
        activeProject.rootPath,
      )
      if (result.ok) {
        setCodexStatus('Codex completado: commit y push realizados.')
      } else {
        setCodexStatus(`Codex error: ${result.error ?? 'fallo desconocido'}`)
      }
    } catch (error) {
      setCodexStatus(`Codex fallo: ${String(error)}`)
    } finally {
      setCodexRunning(false)
      handleGitRefresh()
    }
  }, [activeProject, handleGitRefresh])

  const handleCodexCommit = useCallback(async () => {
    if (!window.ide) {
      setCodexStatus('Codex requiere ejecutar en Electron.')
      return
    }

    setCodexRunning(true)
    setCodexStatus('Ejecutando Codex: creando commit y push...')
    try {
      const result = await window.ide.codexCommit(
        'Crea un commit con los cambios actuales y haz push al remoto por defecto.',
        activeProject?.rootPath,
      )
      if (result.ok) {
        setCodexStatus('Codex completado: commit y push realizados.')
      } else {
        setCodexStatus(`Codex error: ${result.error ?? 'fallo desconocido'}`)
      }
    } catch (error) {
      setCodexStatus(`Codex fallo: ${String(error)}`)
    } finally {
      setCodexRunning(false)
    }
  }, [activeProject])

  const openSearchPalette = useCallback(() => {
    setPaletteMode('search')
    setPaletteQuery('')
    setPaletteResults([])
    setPaletteIndex(0)
  }, [])

  const closeProject = useCallback((projectId: string) => {
    setProjects((prev) => {
      const remaining = prev.filter((project) => project.id !== projectId)
      setActiveProjectId((current) => {
        if (current && current !== projectId) {
          return current
        }
        return remaining.length ? remaining[remaining.length - 1].id : null
      })
      return remaining
    })
  }, [])

  useEffect(() => {
    const savedPanel = localStorage.getItem(sidePanelKey)
    if (savedPanel === 'git' || savedPanel === 'explorer') {
      setSidePanel(savedPanel)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(sidePanelKey, sidePanel)
  }, [sidePanel])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if (key === 'shift') {
        const now = Date.now()
        if (lastShiftTimeRef.current && now - lastShiftTimeRef.current < 350) {
          event.preventDefault()
          setPaletteMode('file')
          setPaletteQuery('')
          setPaletteResults(fileList)
          setPaletteIndex(0)
        }
        lastShiftTimeRef.current = now
      }
      const isMod = event.metaKey || event.ctrlKey
      if (isMod && event.shiftKey && key === 'o') {
        event.preventDefault()
        setPaletteMode('file')
        setPaletteQuery('')
        setPaletteResults(fileList)
        setPaletteIndex(0)
        return
      }
      if (isMod && event.shiftKey && key === 'f') {
        event.preventDefault()
        setPaletteMode('search')
        setPaletteQuery('')
        setPaletteResults([])
        setPaletteIndex(0)
        return
      }
      if (key === 'escape' && paletteMode) {
        event.preventDefault()
        setPaletteMode(null)
        return
      }
      if (isMod && event.key.toLowerCase() === 's') {
        event.preventDefault()
        handleSave()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSave, fileList, paletteMode])

  useEffect(() => {
    if (!window.ide) {
      return
    }

    const raw = localStorage.getItem(projectsKey)
    if (!raw) {
      return
    }

    let saved: PersistedProject[] | null = null
    try {
      saved = JSON.parse(raw) as PersistedProject[]
    } catch {
      saved = null
    }

    if (!saved || saved.length === 0) {
      return
    }

    setProjects(
      saved.map((project) => ({
        id: project.id,
        name: project.name ?? project.rootPath.split('/').pop() ?? project.rootPath,
        rootPath: project.rootPath,
        tree: [],
        expandedPaths: new Set(project.expandedPaths ?? []),
        openFiles: [],
        openFilePaths: project.openFilePaths ?? [],
        activeFilePath: project.activeFilePath ?? null,
        gitStatus: null,
        gitMessage: '',
      })),
    )

    const savedActive = localStorage.getItem(activeProjectKey)
    if (savedActive && saved.some((project) => project.id === savedActive)) {
      setActiveProjectId(savedActive)
    } else {
      setActiveProjectId(saved[0].id)
    }
  }, [])

  useEffect(() => {
    if (!window.ide || !activeProject) {
      return
    }

    const loadProject = async () => {
      if (!activeProject.rootPath) {
        return
      }
      if (activeProject.tree.length === 0) {
        const result = await window.ide.openFolderByPath(activeProject.rootPath)
        if (result) {
          updateProject(activeProject.id, (project) => ({
            ...project,
            tree: result.tree,
            expandedPaths: project.expandedPaths.size
              ? project.expandedPaths
              : new Set([result.rootPath]),
          }))
        }
      }

      if (activeProject.openFiles.length === 0 && activeProject.openFilePaths.length > 0) {
        const unique = Array.from(new Set(activeProject.openFilePaths)).slice(0, 12)
        const loaded = await Promise.allSettled(
          unique.map(async (filePath) => {
            const content = await window.ide.readFile(filePath)
            return {
              path: filePath,
              name: filePath.split('/').pop() ?? filePath,
              content,
              dirty: false,
            }
          }),
        )
        const opened = loaded
          .filter((item): item is PromiseFulfilledResult<LoadedFile> => item.status === 'fulfilled')
          .map((item) => item.value)
        updateProject(activeProject.id, (project) => ({
          ...project,
          openFiles: opened,
          openFilePaths: opened.map((file) => file.path),
          activeFilePath:
            project.activeFilePath && opened.some((file) => file.path === project.activeFilePath)
              ? project.activeFilePath
              : opened[0]?.path ?? null,
        }))
      }

      handleGitRefresh()
    }

    loadProject()
  }, [activeProject, updateProject, handleGitRefresh])

  useEffect(() => {
    const payload: PersistedProject[] = projects.map((project) => ({
      id: project.id,
      name: project.name,
      rootPath: project.rootPath,
      openFilePaths: project.openFilePaths,
      activeFilePath: project.activeFilePath,
      expandedPaths: Array.from(project.expandedPaths),
    }))
    localStorage.setItem(projectsKey, JSON.stringify(payload))
    if (activeProjectId) {
      localStorage.setItem(activeProjectKey, activeProjectId)
    }
  }, [projects, activeProjectId])

  useEffect(() => {
    if (!paletteMode) {
      return
    }

    if (paletteMode === 'file') {
      const query = paletteQuery.toLowerCase()
      const filtered = fileList.filter((item) => item.path.toLowerCase().includes(query))
      setPaletteResults(filtered.slice(0, 100))
      setPaletteIndex(0)
      return
    }

    if (!activeProject?.rootPath || !window.ide) {
      setPaletteResults([])
      return
    }

    const handle = setTimeout(async () => {
      const results = await window.ide.searchInFiles(activeProject.rootPath, paletteQuery)
      setPaletteResults(results)
      setPaletteIndex(0)
    }, 200)

    return () => clearTimeout(handle)
  }, [paletteMode, paletteQuery, fileList, activeProject])

  return (
    <div className="flex h-screen w-screen flex-col bg-[#0b0d12] text-[#d4d4d4]">
      <div className="flex h-10 items-center gap-2 border-b border-white/5 bg-[#111217] px-3">
        <div className="flex flex-1 items-center gap-1 overflow-x-auto">
          {projects.map((project) => {
            const name = project.name || project.rootPath.split('/').pop() || 'Proyecto'
            const isActive = project.id === activeProjectId
            return (
              <button
                key={project.id}
                type="button"
                onClick={() => setActiveProjectId(project.id)}
                className={`group flex items-center gap-2 rounded-t-md border border-white/10 px-3 py-1 text-xs ${
                  isActive
                    ? 'bg-[#1e1e1e] text-white'
                    : 'bg-[#14161c] text-white/50 hover:text-white/80'
                }`}
              >
                <span className="truncate max-w-[160px]">{name}</span>
                <span
                  className="text-white/40 hover:text-white"
                  onClick={(event) => {
                    event.stopPropagation()
                    closeProject(project.id)
                  }}
                >
                  ×
                </span>
              </button>
            )
          })}
          <button
            onClick={handleOpenFolder}
            className="ml-1 rounded-md border border-white/10 px-2 py-1 text-xs text-white/60 hover:bg-white/10"
            title="Add project"
          >
            +
          </button>
        </div>
        <button
          onClick={handleOpenFolder}
          className="rounded-md border border-white/10 px-3 py-1 text-xs text-white/70 hover:bg-white/10"
          title="Cargar otro proyecto"
        >
          Cargar proyecto
        </button>
        <button
          onClick={handleNewProject}
          className="rounded-md border border-white/10 px-3 py-1 text-xs text-white/70 hover:bg-white/10"
          title="Nuevo proyecto"
        >
          Nuevo proyecto
        </button>
      </div>
      <div className="flex-1">
        <Layout
          activityBar={<ActivityBar active={sidePanel} onChange={setSidePanel} />}
          sidePanel={
            sidePanel === 'git' ? (
              <GitPanel
                rootPath={activeProject?.rootPath || null}
                status={activeProject?.gitStatus ?? null}
                message={activeProject?.gitMessage ?? ''}
                onMessageChange={(value) => {
                  if (!activeProject) {
                    return
                  }
                  updateProject(activeProject.id, (project) => ({ ...project, gitMessage: value }))
                }}
                onInit={handleGitInit}
                onCommit={handleGitCommit}
                onAutoCommit={handleAutoCommit}
                onPull={handleGitPull}
                onPush={handleGitPush}
                onRefresh={handleGitRefresh}
                isElectron={isElectron}
              />
            ) : (
              <FileTree
                rootPath={activeProject?.rootPath || null}
                tree={activeProject?.tree ?? []}
                expandedPaths={activeProject?.expandedPaths ?? new Set()}
                onToggle={handleToggle}
                onSelect={handleSelect}
                onOpenFolder={handleOpenFolder}
                onOpenFile={handleOpenFileDialog}
                onOpenSearch={openSearchPalette}
                onCodexCommit={handleCodexCommit}
                codexStatus={codexStatus}
                codexRunning={codexRunning}
                isElectron={isElectron}
              />
            )
          }
          editor={
            <CodeEditor
              openFiles={activeProject?.openFiles ?? []}
              activeFilePath={activeProject?.activeFilePath ?? null}
              isLoading={isLoading}
              onSave={handleSave}
              onChange={(value) => {
                if (!activeProject || !activeProject.activeFilePath) {
                  return
                }
                updateProject(activeProject.id, (project) => {
                  const nextOpenFiles = project.openFiles.map((file) =>
                    file.path === project.activeFilePath
                      ? { ...file, content: value ?? '', dirty: true }
                      : file,
                  )
                  return {
                    ...project,
                    openFiles: nextOpenFiles,
                    openFilePaths: nextOpenFiles.map((file) => file.path),
                  }
                })
              }}
              onSelectTab={(path) => {
                if (!activeProject) {
                  return
                }
                updateProject(activeProject.id, (project) => ({
                  ...project,
                  activeFilePath: path,
                }))
              }}
              onCloseTab={(path) => {
                if (!activeProject) {
                  return
                }
                updateProject(activeProject.id, (project) => {
                  const remaining = project.openFiles.filter((file) => file.path !== path)
                  const nextActive =
                    project.activeFilePath && project.activeFilePath !== path
                      ? project.activeFilePath
                      : remaining[remaining.length - 1]?.path ?? null
                  return {
                    ...project,
                    openFiles: remaining,
                    openFilePaths: remaining.map((file) => file.path),
                    activeFilePath: nextActive,
                  }
                })
              }}
            />
          }
          terminal={
            <div className="h-full w-full">
              {projects.length === 0 ? (
                <TerminalManager isActive />
              ) : (
                projects.map((project) => (
                  <div
                    key={project.id}
                    className={`h-full w-full ${project.id === activeProjectId ? 'block' : 'hidden'}`}
                  >
                    <TerminalManager isActive={project.id === activeProjectId} />
                  </div>
                ))
              )}
            </div>
          }
        />
      </div>
      {paletteMode && (
        <SearchPalette
          mode={paletteMode}
          query={paletteQuery}
          results={paletteResults}
          selectedIndex={paletteIndex}
          onQueryChange={setPaletteQuery}
          onMoveSelection={setPaletteIndex}
          onClose={() => setPaletteMode(null)}
          onSelect={(item) => {
            if ('line' in item) {
              openFileByPath(item.filePath)
            } else {
              openFileByPath(item.path)
            }
            setPaletteMode(null)
          }}
        />
      )}
    </div>
  )
}

export default App

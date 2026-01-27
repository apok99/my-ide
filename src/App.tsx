import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { editor as MonacoEditor, languages } from 'monaco-editor'
import type { Monaco } from '@monaco-editor/react'
import type { DiffTarget, FileItem, FileNode, LoadedFile, ProblemItem, SearchResult, SymbolItem } from './types'
import { Layout } from './components/Layout'
import { FileTree } from './components/FileTree/FileTree'
import { CodeEditor } from './components/Editor/CodeEditor'
import { TerminalManager } from './components/Terminal/TerminalManager'
import { SearchPalette } from './components/Search/SearchPalette'
import { ActivityBar } from './components/ActivityBar'
import { GitPanel } from './components/Git/GitPanel'
import { ProblemsPanel } from './components/Problems/ProblemsPanel'

type ProjectState = {
  id: string
  name: string
  rootPath: string
  tree: FileNode[]
  expandedPaths: Set<string>
  openFiles: LoadedFile[]
  openFilePaths: string[]
  activeFilePath: string | null
  gitStatus: { isRepo: boolean; clean: boolean; changes: string[]; error?: string } | null
  gitMessage: string
  gitBranch: string
  gitRemote: string
  gitLog: string | null
  diffTarget: DiffTarget | null
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

const getPathSeparator = (value: string) => (value.includes('\\') ? '\\' : '/')

const getBaseName = (value: string) => {
  const sep = getPathSeparator(value)
  const parts = value.split(sep)
  return parts[parts.length - 1] || value
}

const normalizeToken = (value: string) => value.replace(/[^A-Za-z0-9_./\\-]/g, '')
const getExtension = (value: string) => {
  const base = getBaseName(value)
  const dotIndex = base.lastIndexOf('.')
  if (dotIndex <= 0) {
    return ''
  }
  return base.slice(dotIndex + 1).toLowerCase()
}

const getBaseNameWithoutExt = (value: string) => {
  const base = getBaseName(value)
  const dotIndex = base.lastIndexOf('.')
  if (dotIndex <= 0) {
    return base
  }
  return base.slice(0, dotIndex)
}

const getNamespaceBaseName = (value: string) => {
  const cleaned = value.replace(/\\/g, '/')
  return getBaseNameWithoutExt(cleaned)
}

const normalizePathKey = (value: string) => value.replace(/\\/g, '/').toLowerCase()

const parsePhpUseStatements = (content: string) => {
  const map = new Map<string, string>()
  if (!content) {
    return map
  }
  const lines = content.split('\n')
  lines.forEach((line) => {
    const trimmed = line.trim()
    if (!/^use\s+/i.test(trimmed)) {
      return
    }
    if (/^use\s+(function|const)\s+/i.test(trimmed)) {
      return
    }
    const body = trimmed.replace(/^use\s+/i, '').replace(/;$/, '').trim()
    if (!body) {
      return
    }
    const handleEntry = (entry: string, prefix?: string) => {
      const raw = entry.trim()
      if (!raw) {
        return
      }
      const parts = raw.split(/\s+as\s+/i)
      const base = parts[0]?.trim()
      if (!base) {
        return
      }
      const full = `${prefix ?? ''}${base}`.replace(/^\\+/, '')
      const alias = (parts[1]?.trim() || getNamespaceBaseName(full)).trim()
      if (!alias) {
        return
      }
      map.set(alias, full)
    }

    const groupMatch = body.match(/^(.*)\{(.*)\}$/)
    if (groupMatch) {
      const prefix = groupMatch[1]?.trim().replace(/\\?$/, '\\')
      const inner = groupMatch[2] ?? ''
      inner.split(',').forEach((entry) => handleEntry(entry, prefix))
      return
    }
    body.split(',').forEach((entry) => handleEntry(entry))
  })
  return map
}

const parsePhpNamespace = (content: string) => {
  const match = content.match(/^\s*namespace\s+([^;]+);/m)
  return match?.[1]?.trim() ?? null
}

const parsePhpClassInfo = (content: string) => {
  const match = content.match(
    /^\s*(?:abstract\s+|final\s+)?class\s+([A-Za-z0-9_]+)(?:\s+extends\s+([\\A-Za-z0-9_]+))?/m,
  )
  if (!match) {
    return { className: null, parentName: null }
  }
  return {
    className: match[1] ?? null,
    parentName: match[2] ?? null,
  }
}

const parsePhpPropertyTypes = (content: string) => {
  const map = new Map<string, string>()
  if (!content) {
    return map
  }
  const propertyRegex = /^\s*(?:public|protected|private)\s+(?:readonly\s+)?(?:static\s+)?([\\A-Za-z0-9_]+)\s+\$([A-Za-z0-9_]+)\s*[;=]/gm
  let match: RegExpExecArray | null
  while ((match = propertyRegex.exec(content))) {
    const type = match[1]
    const name = match[2]
    if (type && name) {
      map.set(name, type)
    }
  }
  const ctorRegex = /function\s+__construct\s*\(([^)]*)\)/m
  const ctorMatch = content.match(ctorRegex)
  if (!ctorMatch) {
    return map
  }
  const params = ctorMatch[1]
  const paramRegex =
    /(?:public|protected|private)\s+(?:readonly\s+)?([\\A-Za-z0-9_]+)\s+\$([A-Za-z0-9_]+)/g
  while ((match = paramRegex.exec(params))) {
    const type = match[1]
    const name = match[2]
    if (type && name) {
      map.set(name, type)
    }
  }
  return map
}

  const findMethodCallInLine = (line: string, column: number) => {
    const cursorIndex = Math.max(0, column - 1)
    const regex = /([A-Za-z0-9_\\$]+(?:->\w+)?)\s*(::|->)\s*([A-Za-z0-9_]+)\s*\(/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(line))) {
    const receiver = match[1]
    const operator = match[2]
    const methodName = match[3]
    const methodIndex = match.index + match[0].lastIndexOf(methodName)
    const end = methodIndex + methodName.length
    if (cursorIndex >= methodIndex && cursorIndex <= end) {
      return { receiver, operator, methodName }
    }
  }
  return null
}

const findMethodDefinition = (content: string, methodName: string) => {
  if (!content || !methodName) {
    return null
  }
  const regex = new RegExp(`function\\s+${methodName}\\s*\\(`, 'i')
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const index = line.search(regex)
    if (index >= 0) {
      return { line: i + 1, column: index + 1 }
    }
  }
  return null
}

const replacePathPrefix = (value: string, fromPrefix: string, toPrefix: string) => {
  if (value === fromPrefix) {
    return toPrefix
  }
  const sep = getPathSeparator(fromPrefix)
  const prefix = fromPrefix.endsWith(sep) ? fromPrefix : `${fromPrefix}${sep}`
  if (!value.startsWith(prefix)) {
    return value
  }
  return toPrefix + value.slice(fromPrefix.length)
}

const isWithinPath = (value: string, base: string) => {
  if (value === base) {
    return true
  }
  const sep = getPathSeparator(base)
  const prefix = base.endsWith(sep) ? base : `${base}${sep}`
  return value.startsWith(prefix)
}

function App() {
  const [projects, setProjects] = useState<ProjectState[]>([])
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [codexStatus, setCodexStatus] = useState<string | null>(null)
  const [paletteMode, setPaletteMode] = useState<'file' | 'search' | 'symbol' | 'line' | null>(null)
  const [paletteQuery, setPaletteQuery] = useState('')
  const [paletteResults, setPaletteResults] = useState<Array<FileItem | SearchResult | SymbolItem>>(
    [],
  )
  const [paletteIndex, setPaletteIndex] = useState(0)
  const [sidePanel, setSidePanel] = useState<'explorer' | 'git'>('explorer')
  const [problems, setProblems] = useState<ProblemItem[]>([])
  const [showProblems, setShowProblems] = useState(true)
  const [symbolItems, setSymbolItems] = useState<SymbolItem[]>([])
  const lastShiftTimeRef = useRef<number | null>(null)
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<Monaco | null>(null)
  const pendingRevealRef = useRef<{ filePath: string; line: number; column: number } | null>(null)

  const isElectron = Boolean(window.ide)

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) ?? null,
    [projects, activeProjectId],
  )

  const fileList = useMemo(() => {
    const items: FileItem[] = []
    const seen = new Map<string, FileItem>()
    if (!activeProject) {
      return items
    }
    const walk = (nodes: FileNode[]) => {
      nodes.forEach((node) => {
        if (node.kind === 'file') {
          const entry = { path: node.path, name: node.name, kind: 'file' as const }
          const key = normalizePathKey(node.path)
          if (!seen.has(key)) {
            seen.set(key, entry)
            items.push(entry)
          }
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
        gitBranch: '',
        gitRemote: '',
        gitLog: null,
        diffTarget: null,
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
            return { ...project, activeFilePath: node.path, diffTarget: null }
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
            diffTarget: null,
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
            return { ...project, activeFilePath: filePath, diffTarget: null }
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
            diffTarget: null,
          }
        })
      } finally {
        setIsLoading(false)
      }
    },
    [activeProject, updateProject],
  )

  const revealInEditor = useCallback(
    async (filePath: string, line: number, column: number) => {
      pendingRevealRef.current = { filePath, line, column }
      if (activeProject?.activeFilePath !== filePath) {
        await openFileByPath(filePath)
      } else {
        const editor = editorRef.current
        if (editor) {
          editor.revealPositionInCenter({ lineNumber: line, column })
          editor.setPosition({ lineNumber: line, column })
          editor.focus()
          pendingRevealRef.current = null
        }
      }
    },
    [activeProject?.activeFilePath, openFileByPath],
  )

  const findControllerInLine = useCallback((line: string, column: number) => {
    const cursorIndex = Math.max(0, column - 1)
    const regex = /[A-Za-z0-9_]+Controller(?:\.php)?/g
    let firstMatch: string | null = null
    let match: RegExpExecArray | null
    while ((match = regex.exec(line))) {
      if (!firstMatch) {
        firstMatch = match[0]
      }
      const start = match.index
      const end = start + match[0].length
      if (cursorIndex >= start && cursorIndex <= end) {
        return match[0]
      }
    }
    return firstMatch
  }, [])

  const findWordInLine = useCallback((line: string, column: number) => {
    const cursorIndex = Math.max(0, column - 1)
    const regex = /[A-Za-z0-9_]+/g
    let firstMatch: string | null = null
    let match: RegExpExecArray | null
    while ((match = regex.exec(line))) {
      if (!firstMatch) {
        firstMatch = match[0]
      }
      const start = match.index
      const end = start + match[0].length
      if (cursorIndex >= start && cursorIndex <= end) {
        return match[0]
      }
    }
    return firstMatch
  }, [])

  const resolveUseStatement = useCallback((line: string, column: number) => {
    const match = line.match(/^\s*use\s+([^;]+);/i)
    if (!match) {
      return null
    }
    const cursorIndex = Math.max(0, column - 1)
    const useStart = line.indexOf(match[0])
    if (useStart === -1) {
      return null
    }
    const classWithAlias = match[1] ?? ''
    const aliasMatch = classWithAlias.match(/^(.+?)\s+as\s+([A-Za-z0-9_]+)\s*$/i)
    const fullClass = aliasMatch ? aliasMatch[1].trim() : classWithAlias.trim()
    const alias = aliasMatch ? aliasMatch[2].trim() : null
    const aliasIndex = alias ? line.indexOf(alias, useStart) : -1
    const fullIndex = fullClass ? line.indexOf(fullClass, useStart) : -1
    if (alias && aliasIndex !== -1) {
      const end = aliasIndex + alias.length
      if (cursorIndex >= aliasIndex && cursorIndex <= end) {
        return { fullClass, preferNamespace: true }
      }
    }
    if (fullIndex !== -1 && fullClass) {
      const end = fullIndex + fullClass.length
      if (cursorIndex >= fullIndex && cursorIndex <= end) {
        return { fullClass, preferNamespace: true }
      }
    }
    return null
  }, [])

  const handleOpenToken = useCallback(
    async (token: string, lineContent: string, column: number) => {
      if (!window.ide) {
        return
      }
      const activeFileContent =
        activeProject?.openFiles.find((file) => file.path === activeProject.activeFilePath)
          ?.content ?? ''
      const namespace = parsePhpNamespace(activeFileContent)
      const useMap = parsePhpUseStatements(activeFileContent)
      const classInfo = parsePhpClassInfo(activeFileContent)
      const propertyTypes = parsePhpPropertyTypes(activeFileContent)
      const methodCall = findMethodCallInLine(lineContent, column)

      const findFileByNamespacePath = (namespacePath: string) => {
        const candidate = `${namespacePath}.php`.toLowerCase()
        return (
          fileList.find((file) => {
            const pathLower = file.path.toLowerCase()
            return (
              pathLower.endsWith(`/${candidate}`) ||
              pathLower.endsWith(`\\${candidate}`) ||
              pathLower.endsWith(candidate)
            )
          }) ?? null
        )
      }

      const resolveClassNamespace = (classToken: string | null) => {
        if (!classToken) {
          return null
        }
        const trimmed = classToken.trim()
        if (!trimmed) {
          return null
        }
        if (trimmed.includes('\\')) {
          return trimmed.replace(/^\\+/, '')
        }
        const direct = useMap.get(trimmed)
        if (direct) {
          return direct.replace(/^\\+/, '')
        }
        if (namespace) {
          return `${namespace}\\${trimmed}`
        }
        return trimmed
      }

      if (methodCall && activeProject?.activeFilePath?.toLowerCase().endsWith('.php')) {
        const receiver = methodCall.receiver
        let targetClass: string | null = null
        let preferParent = false
        if (receiver === 'parent') {
          targetClass = classInfo.parentName
          preferParent = true
        } else if (receiver === 'self' || receiver === 'static') {
          targetClass = classInfo.className
        } else if (receiver === '$this') {
          targetClass = classInfo.className
          preferParent = true
        } else if (receiver.startsWith('$this->')) {
          const prop = receiver.replace('$this->', '').split('->')[0]
          targetClass = propertyTypes.get(prop) ?? null
        } else if (!receiver.startsWith('$')) {
          targetClass = receiver
        }

        const resolvedClass = resolveClassNamespace(targetClass)
        const targetPath = resolvedClass ? findFileByNamespacePath(resolvedClass) : null
        const fallbackParent =
          classInfo.parentName ? resolveClassNamespace(classInfo.parentName) : null
        const fallbackParentPath = fallbackParent ? findFileByNamespacePath(fallbackParent) : null

        const openByMethod = async (path: string) => {
          const content = await window.ide.readFile(path)
          const methodLocation = findMethodDefinition(content, methodCall.methodName)
          if (methodLocation) {
            revealInEditor(path, methodLocation.line, methodLocation.column)
          } else {
            openFileByPath(path)
          }
        }

        if (preferParent && fallbackParentPath) {
          const content = await window.ide.readFile(fallbackParentPath.path)
          const methodLocation = findMethodDefinition(content, methodCall.methodName)
          if (methodLocation) {
            revealInEditor(fallbackParentPath.path, methodLocation.line, methodLocation.column)
            return
          }
          if (targetPath) {
            openByMethod(targetPath.path)
            return
          }
          openFileByPath(fallbackParentPath.path)
          return
        }

        if (targetPath) {
          openByMethod(targetPath.path)
          return
        }

        if (fallbackParentPath) {
          openByMethod(fallbackParentPath.path)
          return
        }
      }
      if (token) {
        const direct = useMap.get(token)
        if (direct) {
          const classPath = direct.replace(/^\\+/, '').replace(/\\/g, '/')
          const candidates = new Set<string>()
          candidates.add(`${classPath}.php`.toLowerCase())
          const namespaceMatch = fileList.find((file) => {
            const pathLower = file.path.toLowerCase()
            for (const candidateValue of candidates) {
              if (
                pathLower.endsWith(`/${candidateValue}`) ||
                pathLower.endsWith(`\\${candidateValue}`) ||
                pathLower.endsWith(candidateValue)
              ) {
                return true
              }
            }
            return false
          })
          if (namespaceMatch) {
            openFileByPath(namespaceMatch.path)
            return
          }
        }
      }
      const useMatch = resolveUseStatement(lineContent, column)
      if (useMatch?.fullClass) {
        const fullClass = useMatch.fullClass.replace(/^\\+/, '')
        const classPath = fullClass.replace(/\\/g, '/')
        const className = getNamespaceBaseName(classPath).toLowerCase()
        const namespaceCandidates = new Set<string>()
        namespaceCandidates.add(`${classPath}.php`.toLowerCase())
        const namespaceMatch = fileList.find((file) => {
          const pathLower = file.path.toLowerCase()
          for (const candidateValue of namespaceCandidates) {
            if (
              pathLower.endsWith(`/${candidateValue}`) ||
              pathLower.endsWith(`\\${candidateValue}`) ||
              pathLower.endsWith(candidateValue)
            ) {
              return true
            }
          }
          return false
        })
        if (namespaceMatch) {
          openFileByPath(namespaceMatch.path)
          return
        }
        if (className) {
          const byName = fileList.find(
            (file) => getBaseNameWithoutExt(file.name).toLowerCase() === className,
          )
          if (byName) {
            openFileByPath(byName.path)
            return
          }
        }
      }
      const controllerCandidate = findControllerInLine(lineContent, column)
      const wordCandidate = controllerCandidate ?? findWordInLine(lineContent, column) ?? token
      let candidate = normalizeToken(wordCandidate)
      if (!candidate) {
        return
      }
      const resolved = useMap.get(candidate)
      if (resolved) {
        const classPath = resolved.replace(/^\\+/, '').replace(/\\/g, '/')
        const namespaceCandidates = new Set<string>()
        namespaceCandidates.add(`${classPath}.php`.toLowerCase())
        const namespaceMatch = fileList.find((file) => {
          const pathLower = file.path.toLowerCase()
          for (const candidateValue of namespaceCandidates) {
            if (
              pathLower.endsWith(`/${candidateValue}`) ||
              pathLower.endsWith(`\\${candidateValue}`) ||
              pathLower.endsWith(candidateValue)
            ) {
              return true
            }
          }
          return false
        })
        if (namespaceMatch) {
          openFileByPath(namespaceMatch.path)
          return
        }
      }
      let lower = candidate.toLowerCase()
      const controllerIndex = lower.indexOf('controller')
      if (controllerIndex >= 0 && !lower.endsWith('controller') && !lower.endsWith('controller.php')) {
        candidate = candidate.slice(0, controllerIndex + 'controller'.length)
        lower = candidate.toLowerCase()
      }
      const candidates = new Set<string>()
      if (lower.endsWith('controller') || lower.endsWith('.php')) {
        const withExtension = lower.endsWith('.php') ? lower : `${lower}.php`
        candidates.add(withExtension)
      }
      if (lower.includes('/') || lower.includes('\\')) {
        candidates.add(lower)
      }

      if (candidates.size > 0) {
        const match = fileList.find((file) => {
          const nameLower = file.name.toLowerCase()
          if (candidates.has(nameLower)) {
            return true
          }
          const pathLower = file.path.toLowerCase()
          for (const candidateValue of candidates) {
            if (
              pathLower.endsWith(`/${candidateValue}`) ||
              pathLower.endsWith(`\\${candidateValue}`) ||
              pathLower.endsWith(candidateValue)
            ) {
              return true
            }
          }
          return false
        })
        if (match) {
          openFileByPath(match.path)
          return
        }
      }

      const className = getBaseNameWithoutExt(candidate).toLowerCase()
      if (!className) {
        return
      }
      const matches = fileList.filter(
        (file) => getBaseNameWithoutExt(file.name).toLowerCase() === className,
      )
      if (matches.length === 0) {
        return
      }
      if (matches.length === 1) {
        openFileByPath(matches[0].path)
        return
      }
      const activeExt = activeProject?.activeFilePath
        ? getExtension(activeProject.activeFilePath)
        : ''
      const preferred =
        (activeExt
          ? matches.find((file) => getExtension(file.name) === activeExt)
          : null) ??
        matches.find((file) => getExtension(file.name) === 'php') ??
        matches[0]
      if (preferred) {
        openFileByPath(preferred.path)
      }
    },
    [
      activeProject?.activeFilePath,
      activeProject?.openFiles,
      fileList,
      findControllerInLine,
      findWordInLine,
      revealInEditor,
      openFileByPath,
      resolveUseStatement,
    ],
  )

  const refreshTreeNow = useCallback(async () => {
    if (!window.ide || !activeProject?.rootPath) {
      return
    }
    const result = await window.ide.openFolderByPath(activeProject.rootPath)
    if (!result) {
      return
    }
    updateProject(activeProject.id, (project) => ({
      ...project,
      tree: result.tree,
    }))
  }, [activeProject?.id, activeProject?.rootPath, updateProject])

  const handleCreateFile = useCallback(
    async (dirPath: string, name: string) => {
      if (!window.ide || !activeProject?.rootPath) {
        return
      }
      const result = await window.ide.createFile(activeProject.rootPath, dirPath, name)
      if (!result.ok) {
        window.alert(result.error ?? 'No se pudo crear el archivo.')
        return
      }
      await refreshTreeNow()
    },
    [activeProject?.rootPath, refreshTreeNow],
  )

  const handleCreateFolder = useCallback(
    async (dirPath: string, name: string) => {
      if (!window.ide || !activeProject?.rootPath) {
        return
      }
      const result = await window.ide.createFolder(activeProject.rootPath, dirPath, name)
      if (!result.ok) {
        window.alert(result.error ?? 'No se pudo crear la carpeta.')
        return
      }
      await refreshTreeNow()
    },
    [activeProject?.rootPath, refreshTreeNow],
  )

  const handleRename = useCallback(
    async (node: FileNode) => {
      if (!window.ide || !activeProject?.rootPath) {
        return
      }
      const nextName = window.prompt('Nuevo nombre', node.name)
      if (!nextName || nextName === node.name) {
        return
      }
      const result = await window.ide.renamePath(activeProject.rootPath, node.path, nextName)
      if (!result.ok || !result.path) {
        window.alert(result.error ?? 'No se pudo renombrar.')
        return
      }
      const nextPath = result.path
      updateProject(activeProject.id, (project) => {
        if (node.kind === 'file') {
          const nextOpenFiles = project.openFiles.map((file) =>
            file.path === node.path
              ? { ...file, path: nextPath, name: getBaseName(nextPath) }
              : file,
          )
          const nextOpenFilePaths = project.openFilePaths.map((path) =>
            path === node.path ? nextPath : path,
          )
          return {
            ...project,
            openFiles: nextOpenFiles,
            openFilePaths: nextOpenFilePaths,
            activeFilePath: project.activeFilePath === node.path ? nextPath : project.activeFilePath,
            diffTarget:
              project.diffTarget?.filePath === node.path
                ? { ...project.diffTarget, filePath: nextPath }
                : project.diffTarget,
          }
        }

        const nextOpenFiles = project.openFiles.map((file) => ({
          ...file,
          path: replacePathPrefix(file.path, node.path, nextPath),
        }))
        const nextOpenFilePaths = project.openFilePaths.map((path) =>
          replacePathPrefix(path, node.path, nextPath),
        )
        const nextActive = project.activeFilePath
          ? replacePathPrefix(project.activeFilePath, node.path, nextPath)
          : project.activeFilePath
        const nextDiff =
          project.diffTarget?.filePath && isWithinPath(project.diffTarget.filePath, node.path)
            ? {
                ...project.diffTarget,
                filePath: replacePathPrefix(project.diffTarget.filePath, node.path, nextPath),
              }
            : project.diffTarget
        return {
          ...project,
          openFiles: nextOpenFiles,
          openFilePaths: nextOpenFilePaths,
          activeFilePath: nextActive,
          diffTarget: nextDiff,
        }
      })
      await refreshTreeNow()
    },
    [activeProject?.id, activeProject?.rootPath, refreshTreeNow, updateProject],
  )

  const handleDelete = useCallback(
    async (node: FileNode) => {
      if (!window.ide || !activeProject?.rootPath) {
        return
      }
      const confirmDelete = window.confirm(
        `Eliminar ${node.kind === 'dir' ? 'carpeta' : 'archivo'} "${node.name}"?`,
      )
      if (!confirmDelete) {
        return
      }
      const result = await window.ide.deletePath(activeProject.rootPath, node.path)
      if (!result.ok) {
        window.alert(result.error ?? 'No se pudo eliminar.')
        return
      }

      updateProject(activeProject.id, (project) => {
        const shouldRemove = (path: string) =>
          node.kind === 'file' ? path === node.path : isWithinPath(path, node.path)
        const nextOpenFiles = project.openFiles.filter((file) => !shouldRemove(file.path))
        const nextOpenFilePaths = project.openFilePaths.filter((path) => !shouldRemove(path))
        const nextActive =
          project.activeFilePath && shouldRemove(project.activeFilePath)
            ? nextOpenFiles[nextOpenFiles.length - 1]?.path ?? null
            : project.activeFilePath
        const nextDiff =
          project.diffTarget?.filePath && shouldRemove(project.diffTarget.filePath)
            ? null
            : project.diffTarget
        return {
          ...project,
          openFiles: nextOpenFiles,
          openFilePaths: nextOpenFilePaths,
          activeFilePath: nextActive,
          diffTarget: nextDiff,
        }
      })

      await refreshTreeNow()
    },
    [activeProject?.id, activeProject?.rootPath, refreshTreeNow, updateProject],
  )

  const handleRevealActive = useCallback(() => {
    if (!activeProject?.activeFilePath || !activeProject.rootPath) {
      return
    }

    const findPathToFile = (
      nodes: FileNode[],
      targetPath: string,
      trail: FileNode[] = [],
    ): FileNode[] | null => {
      for (const node of nodes) {
        const nextTrail = [...trail, node]
        if (node.path === targetPath) {
          return nextTrail
        }
        if (node.kind === 'dir' && node.children) {
          const found = findPathToFile(node.children, targetPath, nextTrail)
          if (found) {
            return found
          }
        }
      }
      return null
    }

    const trail = findPathToFile(activeProject.tree, activeProject.activeFilePath)
    if (!trail) {
      return
    }

    const nextExpanded = new Set<string>()
    for (const node of trail) {
      if (node.kind === 'dir') {
        nextExpanded.add(node.path)
      }
    }
    nextExpanded.add(activeProject.rootPath)
    updateProject(activeProject.id, (project) => ({
      ...project,
      expandedPaths: nextExpanded,
    }))
  }, [activeProject, updateProject])

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
        gitBranch: '',
        gitRemote: '',
        gitLog: null,
        diffTarget: null,
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
    const [status, info] = await Promise.all([
      window.ide.gitStatus(activeProject.rootPath),
      window.ide.gitInfo(activeProject.rootPath),
    ])
    updateProject(activeProject.id, (project) => ({
      ...project,
      gitStatus: status,
      gitBranch: info.branch,
      gitRemote: info.remote,
      gitLog: status.error ? `Git error: ${status.error}` : project.gitLog,
    }))
  }, [activeProject, updateProject])

  const handleGitInit = useCallback(async () => {
    if (!activeProject) {
      return
    }
    if (!window.ide || !activeProject.rootPath) {
      updateProject(activeProject.id, (project) => ({
        ...project,
        gitLog: 'Abre una carpeta antes de inicializar Git.',
      }))
      return
    }
    const result = await window.ide.gitInit(activeProject.rootPath)
    updateProject(activeProject.id, (project) => ({
      ...project,
      gitLog: result.ok ? 'Repositorio inicializado.' : result.error ?? 'Git init fallo.',
    }))
    handleGitRefresh()
  }, [activeProject, handleGitRefresh, updateProject])

  const handleGitCommit = useCallback(async () => {
    if (!window.ide || !activeProject?.rootPath) {
      return
    }
    const message = activeProject.gitMessage || 'Update'
    const commitResult = await window.ide.gitCommit(activeProject.rootPath, message)
    if (!commitResult.ok) {
      updateProject(activeProject.id, (project) => ({
        ...project,
        gitLog: commitResult.error ?? 'Commit fallo.',
      }))
      handleGitRefresh()
      return
    }
    const pushResult = await window.ide.gitPush(activeProject.rootPath)
    updateProject(activeProject.id, (project) => ({
      ...project,
      gitLog: pushResult.ok
        ? `Commit y push completados: ${message}`
        : pushResult.error ?? 'Push fallo.',
    }))
    handleGitRefresh()
  }, [activeProject, handleGitRefresh, updateProject])

  const handleGitPull = useCallback(async () => {
    if (!window.ide || !activeProject?.rootPath) {
      return
    }
    const result = await window.ide.gitPull(activeProject.rootPath)
    updateProject(activeProject.id, (project) => ({
      ...project,
      gitLog: result.ok ? 'Pull completado.' : result.error ?? 'Pull fallo.',
    }))
    handleGitRefresh()
  }, [activeProject, handleGitRefresh, updateProject])

  const handleGitPush = useCallback(async () => {
    if (!window.ide || !activeProject?.rootPath) {
      return
    }
    const result = await window.ide.gitPush(activeProject.rootPath)
    updateProject(activeProject.id, (project) => ({
      ...project,
      gitLog: result.ok ? 'Push completado.' : result.error ?? 'Push fallo.',
    }))
    handleGitRefresh()
  }, [activeProject, handleGitRefresh, updateProject])

  const handleOpenDiff = useCallback(async (filePath: string) => {
    if (!window.ide || !activeProject?.rootPath) {
      return
    }
    setIsLoading(true)
    try {
      const [originalResult, modifiedResult] = await Promise.allSettled([
        window.ide.gitShowFile(activeProject.rootPath, filePath),
        window.ide.readFile(filePath),
      ])
      const original =
        originalResult.status === 'fulfilled' && originalResult.value.ok
          ? originalResult.value.content
          : ''
      const modified =
        modifiedResult.status === 'fulfilled' ? modifiedResult.value : ''
      updateProject(activeProject.id, (project) => ({
        ...project,
        diffTarget: {
          filePath,
          original,
          modified,
        },
      }))
    } finally {
      setIsLoading(false)
    }
  }, [activeProject, updateProject])

  const handleCloseDiff = useCallback(() => {
    if (!activeProject) {
      return
    }
    updateProject(activeProject.id, (project) => ({ ...project, diffTarget: null }))
  }, [activeProject, updateProject])

  const refreshFileFromDisk = useCallback(async (filePath?: string) => {
    if (!window.ide || !activeProject) {
      return
    }
    const targetPath = filePath ?? activeProject.activeFilePath
    if (!targetPath) {
      return
    }
    const target = activeProject.openFiles.find((file) => file.path === targetPath)
    if (!target || target.dirty) {
      return
    }
    try {
      const content = await window.ide.readFile(target.path)
      updateProject(activeProject.id, (project) => {
        const current = project.openFiles.find((file) => file.path === target.path)
        if (!current || current.dirty || current.content === content) {
          return project
        }
        const nextOpenFiles = project.openFiles.map((file) =>
          file.path === target.path ? { ...file, content, dirty: false } : file,
        )
        return { ...project, openFiles: nextOpenFiles }
      })
    } catch (err) {
      console.error('Failed to refresh file', err)
    }
  }, [activeProject, updateProject])

  const handleOpenRemote = useCallback(async () => {
    if (!window.ide || !activeProject?.gitRemote) {
      return
    }
    await window.ide.openRemote(activeProject.gitRemote)
  }, [activeProject])

  const handleAutoCommit = useCallback(async () => {
    if (!window.ide || !activeProject?.rootPath) {
      return
    }
    setCodexStatus('Ejecutando Codex: creando commit y push...')
    try {
      const result = await window.ide.codexCommit(
        'Haz git add -A, crea un commit con un mensaje claro segun los cambios y haz git push.',
        activeProject.rootPath,
      )
      updateProject(activeProject.id, (project) => ({
        ...project,
        gitLog: result.ok ? 'Auto-commit completado.' : result.error ?? 'Auto-commit fallo.',
      }))
      if (result.ok) {
        setCodexStatus('Codex completado: commit y push realizados.')
      } else {
        setCodexStatus(`Codex error: ${result.error ?? 'fallo desconocido'}`)
      }
    } catch (error) {
      setCodexStatus(`Codex fallo: ${String(error)}`)
    } finally {
      handleGitRefresh()
    }
  }, [activeProject, handleGitRefresh, updateProject])

  const openSearchPalette = useCallback(() => {
    setPaletteMode('search')
    setPaletteQuery('')
    setPaletteResults([])
    setPaletteIndex(0)
  }, [])

  const openSymbolPalette = useCallback(() => {
    setPaletteMode('symbol')
    setPaletteQuery('')
    setPaletteResults([])
    setPaletteIndex(0)
  }, [])

  const openLinePalette = useCallback(() => {
    setPaletteMode('line')
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
      if (isMod && key === 't') {
        event.preventDefault()
        openSymbolPalette()
        return
      }
      if (isMod && key === 'g') {
        event.preventDefault()
        openLinePalette()
        return
      }
      if (isMod && event.shiftKey && key === 'm') {
        event.preventDefault()
        setShowProblems((prev) => !prev)
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

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [handleSave, fileList, openLinePalette, openSymbolPalette, paletteMode])

  useEffect(() => {
    const handleFocus = () => {
      refreshFileFromDisk()
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshFileFromDisk()
      }
    }
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [refreshFileFromDisk])

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
        gitBranch: '',
        gitRemote: '',
        gitLog: null,
        diffTarget: null,
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
    if (!window.ide || !activeProject?.rootPath) {
      return
    }

    let cancelled = false
    const refreshTree = async () => {
      const result = await window.ide.openFolderByPath(activeProject.rootPath)
      if (!result || cancelled) {
        return
      }
      updateProject(activeProject.id, (project) => ({
        ...project,
        tree: result.tree,
      }))
    }

    const interval = setInterval(refreshTree, 4000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [activeProject?.id, activeProject?.rootPath, updateProject])

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

    if (paletteMode === 'symbol') {
      const query = paletteQuery.toLowerCase()
      const filtered = symbolItems.filter((item) => {
        if (!query) {
          return true
        }
        const haystack = `${item.name} ${item.detail ?? ''} ${item.containerName ?? ''}`.toLowerCase()
        return haystack.includes(query)
      })
      setPaletteResults(filtered.slice(0, 200))
      setPaletteIndex(0)
      return
    }

    if (paletteMode === 'line') {
      setPaletteResults([])
      setPaletteIndex(0)
      return
    }

    if (!activeProject?.rootPath || !window.ide) {
      setPaletteResults([])
      return
    }

    const handle = setTimeout(async () => {
      const results = await window.ide.searchInFiles(activeProject.rootPath, paletteQuery)
      const next = results.map((result) => ({ ...result, kind: 'search' as const }))
      setPaletteResults(next)
      setPaletteIndex(0)
    }, 200)

    return () => clearTimeout(handle)
  }, [paletteMode, paletteQuery, fileList, activeProject, symbolItems])

  useEffect(() => {
    if (paletteMode !== 'symbol') {
      return
    }
    const monaco = monacoRef.current
    const editor = editorRef.current
    if (!monaco || !editor) {
      setSymbolItems([])
      return
    }
    const model = editor.getModel()
    if (!model) {
      setSymbolItems([])
      return
    }
    let cancelled = false
    const load = async () => {
      const symbols = await monaco.languages.getDocumentSymbols(model)
      if (cancelled) {
        return
      }
      const flattened: SymbolItem[] = []
      const filePath = model.uri.fsPath || decodeURIComponent(model.uri.path)
      const walk = (items: languages.DocumentSymbol[], containerName?: string) => {
        items.forEach((item) => {
          flattened.push({
            kind: 'symbol',
            name: item.name,
            detail: item.detail,
            containerName,
            filePath,
            line: item.range.startLineNumber,
            column: item.range.startColumn,
          })
          if (item.children?.length) {
            walk(item.children, item.name)
          }
        })
      }
      walk(symbols)
      setSymbolItems(flattened)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [paletteMode, activeProject?.activeFilePath])

  useEffect(() => {
    const pending = pendingRevealRef.current
    if (!pending || activeProject?.activeFilePath !== pending.filePath) {
      return
    }
    const editor = editorRef.current
    if (!editor) {
      return
    }
    editor.revealPositionInCenter({ lineNumber: pending.line, column: pending.column })
    editor.setPosition({ lineNumber: pending.line, column: pending.column })
    editor.focus()
    pendingRevealRef.current = null
  }, [activeProject?.activeFilePath])

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
                className={`group flex items-center gap-2 rounded-t-md border border-white/10 px-3 py-1 text-xs ${isActive
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
      <div className="flex-1 overflow-hidden h-full relative">
        <Layout
          activityBar={
            <ActivityBar
              active={sidePanel}
              onChange={setSidePanel}
              gitStatus={activeProject?.gitStatus ?? null}
            />
          }
          sidePanel={
            sidePanel === 'git' ? (
              <GitPanel
                rootPath={activeProject?.rootPath || null}
                status={activeProject?.gitStatus ?? null}
                branch={activeProject?.gitBranch ?? ''}
                remote={activeProject?.gitRemote ?? ''}
                log={activeProject?.gitLog ?? null}
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
                onOpenDiff={handleOpenDiff}
                onOpenRemote={handleOpenRemote}
                isElectron={isElectron}
              />
            ) : (
              <FileTree
                rootPath={activeProject?.rootPath || null}
                tree={activeProject?.tree ?? []}
                expandedPaths={activeProject?.expandedPaths ?? new Set()}
                activeFilePath={activeProject?.activeFilePath ?? null}
                onToggle={handleToggle}
                onSelect={handleSelect}
                onCreateFile={handleCreateFile}
                onCreateFolder={handleCreateFolder}
                onRename={handleRename}
                onDelete={handleDelete}
                onOpenFolder={handleOpenFolder}
                onOpenSearch={openSearchPalette}
                onRevealActive={handleRevealActive}
                codexStatus={codexStatus}
                isElectron={isElectron}
              />
            )
          }
          editor={
            <div className="flex h-full flex-col">
              <div className="flex-1 min-h-0">
                <CodeEditor
                  openFiles={activeProject?.openFiles ?? []}
                  activeFilePath={activeProject?.activeFilePath ?? null}
                  isLoading={isLoading}
                  diffTarget={activeProject?.diffTarget ?? null}
                  onCloseDiff={handleCloseDiff}
                  onEditorReady={(editor, monaco) => {
                    editorRef.current = editor
                    monacoRef.current = monaco
                  }}
                  onProblemsChange={(nextProblems) => {
                    setProblems(nextProblems)
                  }}
                  onRequestRefresh={() => {
                    refreshFileFromDisk()
                  }}
                  onOpenToken={handleOpenToken}
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
                      diffTarget: null,
                    }))
                    refreshFileFromDisk(path)
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
                        diffTarget: project.diffTarget,
                      }
                    })
                  }}
                />
              </div>
              {showProblems ? (
                <ProblemsPanel
                  problems={problems}
                  onClose={() => setShowProblems(false)}
                  onSelect={(problem) => {
                    revealInEditor(problem.filePath, problem.line, problem.column)
                  }}
                />
              ) : null}
            </div>
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
                    <TerminalManager
                      isActive={project.id === activeProjectId}
                      rootPath={project.rootPath}
                    />
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
          onLineSubmit={(value) => {
            const trimmed = value.trim()
            if (!trimmed) {
              return
            }
            const [lineStr, colStr] = trimmed.split(/[:#,]/)
            const line = Number.parseInt(lineStr, 10)
            const column = colStr ? Number.parseInt(colStr, 10) : 1
            if (!Number.isFinite(line) || line <= 0) {
              return
            }
            const targetPath = activeProject?.activeFilePath
            if (!targetPath) {
              return
            }
            revealInEditor(targetPath, line, Number.isFinite(column) && column > 0 ? column : 1)
            setPaletteMode(null)
          }}
          onSelect={(item) => {
            if (item.kind === 'search') {
              revealInEditor(item.filePath, item.line, 1)
              setPaletteMode(null)
              return
            }
            if (item.kind === 'symbol') {
              revealInEditor(item.filePath, item.line, item.column)
              setPaletteMode(null)
              return
            }
            openFileByPath(item.path)
            setPaletteMode(null)
          }}
        />
      )}
    </div>
  )
}

export default App

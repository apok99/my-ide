import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TerminalWindow } from '../Terminal/TerminalWindow'

type AiProvider = 'codex' | 'claude'

type OpsPanelProps = {
  rootPath: string | null
}

type TerminalRunDetail = {
  terminalId?: string
  command: string
  label?: string
  rootPath?: string | null
  background?: boolean
}

type OpsCommand = {
  id: string
  title: string
  command: string
  description?: string
  category?: string
}

type RuntimeStatus = 'running' | 'exited' | 'error'

type CommandRuntime = {
  terminalId: string
  status: RuntimeStatus
  exitCode: number | null
  startedAt: number
  updatedAt: number
}

const AI_PROVIDER_KEY = 'dms.ops.aiProvider'
const COMMANDS_KEY = 'dms.ops.commands.v1'

const AUTO_COMMIT_PROMPT =
  'Haz commit y push en la carpeta raiz actual. Si en la raiz no existe .git, revisa si existen las carpetas front y back, y en cada una que tenga .git haz git add -A, commit con un mensaje claro segun los cambios y git push. Si un repo no tiene cambios, indicarlo y continuar.'

const shellQuote = (value: string) => `'${value.replace(/'/g, `'\"'\"'`)}'`

const inBack = (command: string) =>
  `if [ -d back ]; then cd back && ${command}; elif [ -f artisan ] || [ -f composer.json ]; then ${command}; else echo "No back detectado"; fi`

const inFront = (command: string) =>
  `if [ -d front ]; then cd front && ${command}; elif [ -f package.json ]; then ${command}; else echo "No front detectado"; fi`

const DEFAULT_COMMANDS: OpsCommand[] = [
  {
    id: 'maintenance-update',
    title: 'Composer Update',
    description: 'Mantenimiento de dependencias PHP',
    category: 'server',
    command: inBack('composer update'),
  },
  {
    id: 'composer-install',
    title: 'Composer Install',
    description: 'Instala vendor',
    category: 'server',
    command: inBack('composer install'),
  },
  {
    id: 'composer-dump',
    title: 'Dump Autoload',
    description: 'Regenera autoload',
    category: 'server',
    command: inBack('composer dump-autoload -o'),
  },
  {
    id: 'artisan-migrate',
    title: 'Migrate',
    description: 'Ejecuta migraciones',
    category: 'db',
    command: inBack('php artisan migrate --no-interaction'),
  },
  {
    id: 'artisan-seed',
    title: 'Seeders',
    description: 'Ejecuta seeders',
    category: 'db',
    command: inBack('php artisan db:seed --no-interaction'),
  },
  {
    id: 'artisan-migrate-seed',
    title: 'Migrate + Seed',
    description: 'Resetea y siembra DB',
    category: 'db',
    command: inBack('php artisan migrate:fresh --seed --no-interaction'),
  },
  {
    id: 'artisan-optimize-clear',
    title: 'Optimize Clear',
    description: 'Limpia caches Laravel',
    category: 'server',
    command: inBack('php artisan optimize:clear'),
  },
  {
    id: 'artisan-queue-restart',
    title: 'Queue Restart',
    description: 'Reinicia workers',
    category: 'server',
    command: inBack('php artisan queue:restart'),
  },
  {
    id: 'back-dev',
    title: 'Levantar Back',
    description: 'php artisan serve',
    category: 'run',
    command: inBack('php artisan serve'),
  },
  {
    id: 'back-tests',
    title: 'Test Back',
    description: 'Pruebas backend',
    category: 'qa',
    command: inBack('php artisan test'),
  },
  {
    id: 'front-install',
    title: 'NPM Install Front',
    description: 'Instala dependencias front',
    category: 'front',
    command: inFront('npm install'),
  },
  {
    id: 'front-dev',
    title: 'Levantar Front',
    description: 'Dev server front',
    category: 'run',
    command: inFront('npm run dev'),
  },
  {
    id: 'front-build',
    title: 'Build Front',
    description: 'Build produccion front',
    category: 'front',
    command: inFront('npm run build'),
  },
  {
    id: 'front-lint',
    title: 'Lint Front',
    description: 'Chequeo lint',
    category: 'qa',
    command: inFront('npm run lint'),
  },
  {
    id: 'front-test',
    title: 'Test Front',
    description: 'Pruebas front',
    category: 'qa',
    command: inFront('npm run test'),
  },
  {
    id: 'git-status',
    title: 'Git Status',
    description: 'Estado de repositorio',
    category: 'git',
    command: 'git status',
  },
  {
    id: 'git-pull',
    title: 'Git Pull --rebase',
    description: 'Actualizar rama local',
    category: 'git',
    command: 'git pull --rebase',
  },
  {
    id: 'git-push',
    title: 'Git Push',
    description: 'Subir cambios',
    category: 'git',
    command: 'git push',
  },
  {
    id: 'npm-root-build',
    title: 'Build IDE',
    description: 'Compilar app actual',
    category: 'ide',
    command: 'npm run build',
  },
  {
    id: 'docker-up',
    title: 'Docker Up',
    description: 'Levanta servicios docker',
    category: 'infra',
    command: 'docker compose up -d',
  },
  {
    id: 'docker-down',
    title: 'Docker Down',
    description: 'Detiene servicios docker',
    category: 'infra',
    command: 'docker compose down',
  },
]

function isValidCommand(value: unknown): value is OpsCommand {
  if (!value || typeof value !== 'object') {
    return false
  }
  const item = value as Partial<OpsCommand>
  return Boolean(
    item.id &&
      typeof item.id === 'string' &&
      item.title &&
      typeof item.title === 'string' &&
      item.command &&
      typeof item.command === 'string',
  )
}

function parseStoredCommands(raw: string | null): OpsCommand[] | null {
  if (!raw) {
    return null
  }
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return null
    }
    if (!parsed.every(isValidCommand)) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function runtimeBadge(runtime?: CommandRuntime) {
  if (!runtime) {
    return { label: 'idle', className: 'bg-white/10 text-white/60 border-white/20' }
  }
  if (runtime.status === 'running') {
    return { label: 'running', className: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40' }
  }
  if (runtime.status === 'error') {
    return { label: 'error', className: 'bg-red-500/20 text-red-200 border-red-500/40' }
  }
  return { label: 'exited', className: 'bg-slate-500/20 text-slate-200 border-slate-500/40' }
}

function buildAutoCommitCommand(provider: AiProvider) {
  const aiCommand =
    provider === 'claude'
      ? `claude --print --permission-mode bypassPermissions ${shellQuote(AUTO_COMMIT_PROMPT)}`
      : `codex exec --skip-git-repo-check --full-auto ${shellQuote(AUTO_COMMIT_PROMPT)}`

  const fallbackScript = `
echo "[fallback] Ejecutando git directo..."
auto_git_repo() {
  repo="$1"
  label="$2"
  (
    cd "$repo" || exit 1
    printf "\\n[fallback] Repo: %s\\n" "$label"
    git add -A
    if git diff --cached --quiet; then
      printf "[fallback] Sin cambios en %s\\n" "$label"
      exit 0
    fi
    git commit -m "chore: auto-commit $(date +%Y-%m-%d_%H-%M-%S) [$label]"
    git push
  )
}

if [ -d .git ]; then
  auto_git_repo "." "root"
else
  found=0
  for dir in front back; do
    if [ -d "$dir/.git" ]; then
      found=1
      auto_git_repo "$dir" "$dir" || exit 1
    fi
  done
  if [ "$found" -eq 0 ]; then
    echo "[fallback] No se encontro .git en raiz ni en front/back"
    exit 1
  fi
fi
  `.trim()
  const fallback = `sh -lc ${shellQuote(fallbackScript)}`

  return `(${aiCommand}) || (${fallback})`
}

export function OpsPanel({ rootPath }: OpsPanelProps) {
  const [provider, setProvider] = useState<AiProvider>(() => {
    const saved = localStorage.getItem(AI_PROVIDER_KEY)
    return saved === 'claude' ? 'claude' : 'codex'
  })

  const [commands, setCommands] = useState<OpsCommand[]>(() => {
    const stored = parseStoredCommands(localStorage.getItem(COMMANDS_KEY))
    return stored ?? DEFAULT_COMMANDS
  })

  const [commandFilter, setCommandFilter] = useState('')
  const [branchName, setBranchName] = useState('')
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [runtimeByCommand, setRuntimeByCommand] = useState<Record<string, CommandRuntime>>({})
  const [commandByTerminal, setCommandByTerminal] = useState<Record<string, string>>({})
  const [dynamicCommandMeta, setDynamicCommandMeta] = useState<Record<string, { title: string; description?: string }>>({})

  const [newTitle, setNewTitle] = useState('')
  const [newCategory, setNewCategory] = useState('custom')
  const [newCommand, setNewCommand] = useState('')

  const [jsonEditorOpen, setJsonEditorOpen] = useState(false)
  const [jsonDraft, setJsonDraft] = useState('')
  const [viewerCommandId, setViewerCommandId] = useState<string | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)

  const commandByTerminalRef = useRef<Record<string, string>>({})

  useEffect(() => {
    commandByTerminalRef.current = commandByTerminal
  }, [commandByTerminal])

  useEffect(() => {
    localStorage.setItem(AI_PROVIDER_KEY, provider)
  }, [provider])

  useEffect(() => {
    localStorage.setItem(COMMANDS_KEY, JSON.stringify(commands))
  }, [commands])

  useEffect(() => {
    if (jsonEditorOpen) {
      setJsonDraft(JSON.stringify(commands, null, 2))
    }
  }, [commands, jsonEditorOpen])

  useEffect(() => {
    if (!window.ide?.onTerminalExit) {
      return
    }
    const unsubscribe = window.ide.onTerminalExit((terminalId, exitCode) => {
      const commandId = commandByTerminalRef.current[terminalId]
      if (!commandId) {
        return
      }
      setRuntimeByCommand((prev) => {
        const current = prev[commandId]
        if (!current || current.terminalId !== terminalId) {
          return prev
        }
        return {
          ...prev,
          [commandId]: {
            ...current,
            status: exitCode === 0 ? 'exited' : 'error',
            exitCode,
            updatedAt: Date.now(),
          },
        }
      })
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    if (!viewerOpen) {
      return
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setViewerOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [viewerOpen])

  const canRun = Boolean(rootPath && window.ide)

  const launchTerminalCommand = useCallback(
    (command: string, label: string, commandId?: string, openViewer = true) => {
      if (!rootPath) {
        setStatus('Abre un proyecto antes de ejecutar acciones.')
        return
      }

      const terminalId = crypto.randomUUID()
      const detail: TerminalRunDetail = {
        terminalId,
        command,
        label,
        rootPath,
        background: true,
      }
      window.dispatchEvent(new CustomEvent<TerminalRunDetail>('dms:terminal-run', { detail }))

      if (commandId) {
        const now = Date.now()
        setRuntimeByCommand((prev) => ({
          ...prev,
          [commandId]: {
            terminalId,
            status: 'running',
            exitCode: null,
            startedAt: now,
            updatedAt: now,
          },
        }))
        setCommandByTerminal((prev) => ({ ...prev, [terminalId]: commandId }))
        if (openViewer) {
          setViewerCommandId(commandId)
          setViewerOpen(true)
        }
      }

      setStatus(`Lanzado: ${label}`)
    },
    [rootPath],
  )

  const openTerminalForCommand = useCallback((commandId: string) => {
    const runtime = runtimeByCommand[commandId]
    if (!runtime) {
      setStatus('Esta card aun no tiene terminal activa.')
      return
    }
    setViewerCommandId(commandId)
    setViewerOpen(true)
  }, [runtimeByCommand])

  const stopViewerTerminal = useCallback(() => {
    if (!viewerCommandId || !window.ide) {
      return
    }
    const runtime = runtimeByCommand[viewerCommandId]
    if (!runtime) {
      return
    }
    window.ide.terminalKill(runtime.terminalId)
    setRuntimeByCommand((prev) => {
      const current = prev[viewerCommandId]
      if (!current) {
        return prev
      }
      return {
        ...prev,
        [viewerCommandId]: {
          ...current,
          status: 'exited',
          exitCode: null,
          updatedAt: Date.now(),
        },
      }
    })
    setStatus('Terminal detenida.')
  }, [runtimeByCommand, viewerCommandId])

  const runAutoCommit = useCallback(() => {
    if (!rootPath) {
      setStatus('Abre un proyecto antes de ejecutar acciones.')
      return
    }
    const commandId = `__auto_commit_${Date.now()}`
    setDynamicCommandMeta((prev) => ({
      ...prev,
      [commandId]: {
        title: `Auto Commit (${provider})`,
        description: 'CLI visible + fallback Git directo',
      },
    }))
    launchTerminalCommand(buildAutoCommitCommand(provider), `Auto Commit (${provider})`, commandId, true)
    setStatus(`Auto-commit lanzado en terminal (${provider}).`)
  }, [launchTerminalCommand, provider, rootPath])

  const runCreateBranch = useCallback(async () => {
    if (!window.ide || !rootPath) {
      setStatus('Abre un proyecto antes de ejecutar acciones.')
      return
    }
    const trimmed = branchName.trim()
    if (!trimmed) {
      setStatus('Escribe un nombre de rama.')
      return
    }

    setBusyAction('branch')
    try {
      const create = await window.ide.gitCreateBranch(rootPath, trimmed)
      const createError = (create.error ?? '').toLowerCase()
      const alreadyExists = createError.includes('already exists') || createError.includes('ya existe')

      if (!create.ok && !alreadyExists) {
        setStatus(`No se pudo crear la rama: ${create.error ?? 'error desconocido'}`)
        return
      }

      const checkout = await window.ide.gitCheckoutBranch(rootPath, trimmed)
      if (!checkout.ok) {
        setStatus(`Rama creada pero checkout fallo: ${checkout.error ?? 'error desconocido'}`)
        return
      }

      setStatus(alreadyExists ? `Checkout a rama existente: ${trimmed}` : `Rama creada y checkout: ${trimmed}`)
      setBranchName('')
    } finally {
      setBusyAction(null)
    }
  }, [branchName, rootPath])

  const addCustomCommand = useCallback(() => {
    const title = newTitle.trim()
    const command = newCommand.trim()
    if (!title || !command) {
      setStatus('Para crear comando, completa titulo y comando.')
      return
    }

    const entry: OpsCommand = {
      id: crypto.randomUUID(),
      title,
      category: newCategory.trim() || 'custom',
      description: 'Comando personalizado',
      command,
    }

    setCommands((prev) => [entry, ...prev])
    setNewTitle('')
    setNewCommand('')
    setStatus(`Comando creado: ${title}`)
  }, [newCategory, newCommand, newTitle])

  const deleteCommand = useCallback((id: string) => {
    setCommands((prev) => prev.filter((item) => item.id !== id))
    setRuntimeByCommand((prev) => {
      const copy = { ...prev }
      delete copy[id]
      return copy
    })
  }, [])

  const applyJsonDraft = useCallback(() => {
    try {
      const parsed = JSON.parse(jsonDraft)
      if (!Array.isArray(parsed) || !parsed.every(isValidCommand)) {
        setStatus('JSON invalido: debe ser un array de comandos validos.')
        return
      }
      setCommands(parsed)
      setStatus('Comandos actualizados desde JSON.')
    } catch {
      setStatus('JSON invalido: revisa formato y comas.')
    }
  }, [jsonDraft])

  const restoreDefaults = useCallback(() => {
    setCommands(DEFAULT_COMMANDS)
    setStatus('Pack base restaurado.')
  }, [])

  const filteredCommands = useMemo(() => {
    const token = commandFilter.trim().toLowerCase()
    if (!token) {
      return commands
    }
    return commands.filter((item) => {
      return (
        item.title.toLowerCase().includes(token) ||
        item.command.toLowerCase().includes(token) ||
        (item.category ?? '').toLowerCase().includes(token)
      )
    })
  }, [commandFilter, commands])

  const providerLabel = useMemo(() => (provider === 'codex' ? 'Codex CLI' : 'Claude CLI'), [provider])

  const viewerCommand = useMemo(() => {
    if (!viewerCommandId) {
      return null
    }
    const fromCommands = commands.find((item) => item.id === viewerCommandId)
    if (fromCommands) {
      return fromCommands
    }
    const dynamic = dynamicCommandMeta[viewerCommandId]
    if (!dynamic) {
      return null
    }
    return {
      id: viewerCommandId,
      title: dynamic.title,
      description: dynamic.description,
      command: '',
      category: 'runtime',
    } as OpsCommand
  }, [commands, dynamicCommandMeta, viewerCommandId])

  const viewerRuntime = viewerCommandId ? runtimeByCommand[viewerCommandId] : null

  return (
    <div className="flex h-full flex-col bg-[#0f0f0f] text-white/90">
      <div className="border-b border-white/10 px-3 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Automation Ops</p>
        <p className="mt-1 text-[11px] text-white/45">
          Grid de comandos en cards. Ejecuta y abre la terminal en modal con estado.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <section className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <div className="grid grid-cols-4 gap-2">
            <div className="col-span-2 rounded border border-fuchsia-400/25 bg-fuchsia-500/10 p-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold text-fuchsia-200">Auto Commit</p>
                <span className="text-[10px] text-fuchsia-200/70">{providerLabel}</span>
              </div>
              <div className="mt-2 flex gap-1 rounded border border-white/10 bg-black/20 p-1">
                <button
                  type="button"
                  onClick={() => setProvider('codex')}
                  className={`rounded px-2 py-1 text-[10px] font-semibold transition ${
                    provider === 'codex' ? 'bg-blue-500/20 text-blue-300' : 'text-white/60 hover:bg-white/10'
                  }`}
                >
                  Codex
                </button>
                <button
                  type="button"
                  onClick={() => setProvider('claude')}
                  className={`rounded px-2 py-1 text-[10px] font-semibold transition ${
                    provider === 'claude' ? 'bg-blue-500/20 text-blue-300' : 'text-white/60 hover:bg-white/10'
                  }`}
                >
                  Claude
                </button>
              </div>
              <button
                type="button"
                disabled={!canRun}
                onClick={runAutoCommit}
                className="mt-2 w-full rounded border border-fuchsia-400/30 bg-fuchsia-500/10 px-2 py-1.5 text-[11px] font-semibold text-fuchsia-200 transition hover:bg-fuchsia-500/20 disabled:opacity-40"
              >
                Auto Commit + Push (ver CLI)
              </button>
            </div>

            <div className="col-span-2 rounded border border-cyan-400/25 bg-cyan-500/10 p-2">
              <p className="text-[11px] font-semibold text-cyan-200">Crear Rama</p>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="text"
                  value={branchName}
                  onChange={(event) => setBranchName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      void runCreateBranch()
                    }
                  }}
                  placeholder="feat/nueva-rama"
                  className="min-w-0 flex-1 rounded border border-white/15 bg-black/20 px-2 py-1.5 text-[11px] text-white outline-none focus:border-blue-500/60"
                />
                <button
                  type="button"
                  disabled={!canRun || busyAction === 'branch'}
                  onClick={() => {
                    void runCreateBranch()
                  }}
                  className="shrink-0 rounded border border-cyan-400/30 bg-cyan-500/10 px-2 py-1.5 text-[11px] font-semibold text-cyan-200 transition hover:bg-cyan-500/20 disabled:opacity-40"
                >
                  {busyAction === 'branch' ? '...' : 'Crear'}
                </button>
              </div>
              <p className="mt-1 text-[10px] text-cyan-100/70">Crea y hace checkout automatico.</p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <div className="grid grid-cols-4 gap-2">
            <input
              type="text"
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              placeholder="Titulo comando"
              className="rounded border border-white/15 bg-black/20 px-2 py-1.5 text-[11px] text-white outline-none focus:border-blue-500/60"
            />
            <input
              type="text"
              value={newCategory}
              onChange={(event) => setNewCategory(event.target.value)}
              placeholder="Categoria"
              className="rounded border border-white/15 bg-black/20 px-2 py-1.5 text-[11px] text-white outline-none focus:border-blue-500/60"
            />
            <input
              type="text"
              value={newCommand}
              onChange={(event) => setNewCommand(event.target.value)}
              placeholder="Comando shell"
              className="rounded border border-white/15 bg-black/20 px-2 py-1.5 text-[11px] text-white outline-none focus:border-blue-500/60"
            />
            <button
              type="button"
              onClick={addCustomCommand}
              className="rounded border border-emerald-400/30 bg-emerald-500/10 px-2 py-1.5 text-[11px] font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
            >
              + Agregar Comando
            </button>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <input
              type="text"
              value={commandFilter}
              onChange={(event) => setCommandFilter(event.target.value)}
              placeholder="Buscar comando..."
              className="flex-1 rounded border border-white/15 bg-black/20 px-2 py-1.5 text-[11px] text-white outline-none focus:border-blue-500/60"
            />
            <button
              type="button"
              onClick={() => setJsonEditorOpen((prev) => !prev)}
              className="rounded border border-violet-400/30 bg-violet-500/10 px-2 py-1.5 text-[11px] text-violet-200 transition hover:bg-violet-500/20"
            >
              {jsonEditorOpen ? 'Ocultar JSON' : 'Editar JSON'}
            </button>
            <button
              type="button"
              onClick={restoreDefaults}
              className="rounded border border-amber-400/30 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-200 transition hover:bg-amber-500/20"
            >
              Restaurar Base
            </button>
          </div>

          {jsonEditorOpen ? (
            <div className="mt-2">
              <textarea
                value={jsonDraft}
                onChange={(event) => setJsonDraft(event.target.value)}
                className="h-44 w-full rounded border border-white/15 bg-black/30 p-2 font-mono text-[10px] text-white/80 outline-none focus:border-blue-500/60"
              />
              <div className="mt-1 flex justify-end">
                <button
                  type="button"
                  onClick={applyJsonDraft}
                  className="rounded border border-blue-400/30 bg-blue-500/10 px-2 py-1 text-[11px] text-blue-200 transition hover:bg-blue-500/20"
                >
                  Guardar JSON
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold text-white/80">Comandos ({filteredCommands.length})</p>
            <p className="text-[10px] text-white/40">Grid fijo de 4 cards por fila</p>
          </div>

          <div className="overflow-x-auto">
            <div className="grid min-w-[980px] grid-cols-4 gap-2">
              {filteredCommands.map((item) => {
                const runtime = runtimeByCommand[item.id]
                const badge = runtimeBadge(runtime)
                return (
                  <article key={item.id} className="rounded border border-white/10 bg-black/20 p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-semibold text-white/90">{item.title}</p>
                        <p className="truncate text-[10px] text-white/45">{item.description || 'Comando'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteCommand(item.id)}
                        className="rounded border border-red-400/30 bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-200 hover:bg-red-500/20"
                        title="Eliminar comando"
                      >
                        x
                      </button>
                    </div>

                    <div className="mt-1 flex items-center gap-1">
                      <p className="inline-block rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-[9px] text-white/60">
                        {item.category || 'general'}
                      </p>
                      <span className={`rounded border px-1.5 py-0.5 text-[9px] ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>

                    <pre className="mt-1 max-h-16 overflow-auto whitespace-pre-wrap rounded bg-black/30 p-1 font-mono text-[9px] text-white/60">
                      {item.command}
                    </pre>

                    <button
                      type="button"
                      disabled={!canRun}
                      onClick={() => launchTerminalCommand(item.command, item.title, item.id, true)}
                      className="mt-2 w-full rounded border border-blue-400/30 bg-blue-500/10 px-2 py-1 text-[11px] font-semibold text-blue-200 transition hover:bg-blue-500/20 disabled:opacity-40"
                    >
                      Ejecutar
                    </button>
                    <button
                      type="button"
                      disabled={!runtime}
                      onClick={() => openTerminalForCommand(item.id)}
                      className="mt-1 w-full rounded border border-cyan-400/30 bg-cyan-500/10 px-2 py-1 text-[11px] font-semibold text-cyan-200 transition hover:bg-cyan-500/20 disabled:opacity-40"
                      title="Ver terminal de esta card"
                    >
                      👁 Ver terminal
                    </button>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        {status ? (
          <section className="rounded-lg border border-white/10 bg-black/20 p-2 text-[11px] text-white/75">
            <p>{status}</p>
          </section>
        ) : null}

      </div>

      {viewerCommand && viewerRuntime ? (
        <div
          className={`fixed inset-0 z-[250] flex items-center justify-center p-6 transition-opacity ${
            viewerOpen ? 'bg-black/75 opacity-100 pointer-events-auto' : 'bg-black/0 opacity-0 pointer-events-none'
          }`}
        >
          <div className="flex h-[84vh] w-[94vw] max-w-[1500px] flex-col rounded-xl border border-white/15 bg-[#0d1016] shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{viewerCommand.title}</p>
                <p className="truncate text-[11px] text-white/50">{viewerCommand.description || 'Terminal de comando'}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded border px-2 py-1 text-[10px] ${runtimeBadge(viewerRuntime).className}`}>
                  {runtimeBadge(viewerRuntime).label}
                  {viewerRuntime.exitCode !== null ? ` (${viewerRuntime.exitCode})` : ''}
                </span>
                <button
                  type="button"
                  onClick={stopViewerTerminal}
                  className="rounded border border-red-400/30 bg-red-500/10 px-2 py-1 text-[11px] text-red-200 hover:bg-red-500/20"
                >
                  Detener
                </button>
                <button
                  type="button"
                  onClick={() => setViewerOpen(false)}
                  className="rounded border border-white/20 bg-white/5 px-2 py-1 text-[11px] text-white/80 hover:bg-white/10"
                >
                  Cerrar
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 p-2">
              <TerminalWindow
                id={viewerRuntime.terminalId}
                isActive={viewerOpen}
                onFocus={() => {}}
                onClose={() => setViewerOpen(false)}
                cwd={rootPath ?? undefined}
                title={viewerCommand.title}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

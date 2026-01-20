import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promises as fs } from 'node:fs'
import * as os from 'node:os'
import * as pty from 'node-pty'
import { runCodex } from './codex.js'
import { spawn } from 'node:child_process'

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ignoredFolders = new Set(['node_modules', '.git', 'dist', 'out'])
const ignoredExtensions = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.mp4',
  '.mp3',
  '.woff',
  '.woff2',
  '.ttf',
  '.ico',
  '.zip',
  '.gz',
  '.tar',
  '.map',
])

const runGit = (cwd: string, args: string[]) => {
  return new Promise<{ ok: boolean; stdout: string; stderr: string }>((resolve) => {
    const proc = spawn('git', args, { cwd })
    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data) => {
      stdout += data.toString()
    })
    proc.stderr.on('data', (data) => {
      stderr += data.toString()
    })
    proc.on('error', (err) => {
      resolve({ ok: false, stdout: '', stderr: String(err) })
    })
    proc.on('close', (code) => {
      resolve({ ok: code === 0, stdout, stderr })
    })
  })
}

type FileNode = {
  name: string
  path: string
  kind: 'file' | 'dir'
  children?: FileNode[]
}

const terminals = new Map<string, pty.IPty>()

const readDirRecursive = async (dirPath: string, depth: number): Promise<FileNode[]> => {
  if (depth < 0) {
    return []
  }

  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  const nodes = await Promise.all(
    entries.map(async (entry) => {
      if (entry.isDirectory() && ignoredFolders.has(entry.name)) {
        return null
      }

      const entryPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        const children = await readDirRecursive(entryPath, depth - 1)
        return {
          name: entry.name,
          path: entryPath,
          kind: 'dir',
          children,
        }
      }

      return {
        name: entry.name,
        path: entryPath,
        kind: 'file',
      }
    }),
  )

  return nodes.filter((node): node is FileNode => Boolean(node)).sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind === 'dir' ? -1 : 1
    }
    return a.name.localeCompare(b.name)
  })
}

const listFilesRecursive = async (
  dirPath: string,
  depth: number,
  maxFiles: number,
  collected: string[] = [],
): Promise<string[]> => {
  if (depth < 0 || collected.length >= maxFiles) {
    return collected
  }

  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  for (const entry of entries) {
    if (collected.length >= maxFiles) {
      break
    }

    if (entry.isDirectory() && ignoredFolders.has(entry.name)) {
      continue
    }

    const entryPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      await listFilesRecursive(entryPath, depth - 1, maxFiles, collected)
    } else {
      collected.push(entryPath)
    }
  }

  return collected
}

const searchInFiles = async (rootPath: string, query: string) => {
  const results: Array<{ filePath: string; line: number; text: string }> = []
  if (!query.trim()) {
    return results
  }

  const files = await listFilesRecursive(rootPath, 8, 500)
  for (const filePath of files) {
    if (results.length >= 200) {
      break
    }

    const ext = path.extname(filePath).toLowerCase()
    if (ignoredExtensions.has(ext)) {
      continue
    }

    const stat = await fs.stat(filePath)
    if (stat.size > 1024 * 1024) {
      continue
    }

    const content = await fs.readFile(filePath, 'utf8').catch(() => '')
    if (!content || content.includes('\0')) {
      continue
    }

    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i += 1) {
      if (results.length >= 200) {
        break
      }
      if (lines[i].toLowerCase().includes(query.toLowerCase())) {
        results.push({
          filePath,
          line: i + 1,
          text: lines[i].trim().slice(0, 240),
        })
      }
    }
  }

  return results
}

const createWindow = () => {
  const preloadPath = isDev
    ? path.join(app.getAppPath(), 'electron', 'preload.cjs')
    : path.join(__dirname, 'preload.cjs')

  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#0b0d12',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.on('closed', () => {
    // Kill all terminals when window closes
    terminals.forEach((terminal) => {
      terminal.kill()
    })
    terminals.clear()
  })

  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL as string)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  ipcMain.handle('ide:select-folder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    const rootPath = result.filePaths[0]
    const tree = await readDirRecursive(rootPath, 4)
    return { rootPath, tree }
  })

  ipcMain.handle('ide:open-folder-path', async (_event, folderPath: string) => {
    if (!folderPath) {
      return null
    }

    const stat = await fs.stat(folderPath).catch(() => null)
    if (!stat || !stat.isDirectory()) {
      return null
    }

    const tree = await readDirRecursive(folderPath, 4)
    return { rootPath: folderPath, tree }
  })

  ipcMain.handle('ide:open-file', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    const filePath = result.filePaths[0]
    const content = await fs.readFile(filePath, 'utf8')
    const rootPath = path.dirname(filePath)
    const tree = await readDirRecursive(rootPath, 4)
    return { filePath, content, rootPath, tree }
  })

  ipcMain.handle('ide:read-file', async (_event, filePath: string) => {
    const content = await fs.readFile(filePath, 'utf8')
    return content
  })

  ipcMain.handle('ide:write-file', async (_event, filePath: string, content: string) => {
    await fs.writeFile(filePath, content, 'utf8')
    return true
  })

  ipcMain.handle('ide:git-status', async (_event, rootPath: string) => {
    if (!rootPath) {
      return { isRepo: false, clean: true, changes: [] as string[] }
    }
    const isRepo = await runGit(rootPath, ['rev-parse', '--is-inside-work-tree'])
    if (!isRepo.ok) {
      return { isRepo: false, clean: true, changes: [] as string[] }
    }
    const status = await runGit(rootPath, ['status', '--porcelain'])
    const lines = status.stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    return { isRepo: true, clean: lines.length === 0, changes: lines }
  })

  ipcMain.handle('ide:git-init', async (_event, rootPath: string) => {
    if (!rootPath) {
      return { ok: false, error: 'Missing root path' }
    }
    const result = await runGit(rootPath, ['init'])
    return { ok: result.ok, error: result.ok ? undefined : result.stderr || result.stdout }
  })

  ipcMain.handle('ide:git-commit', async (_event, rootPath: string, message: string) => {
    if (!rootPath) {
      return { ok: false, error: 'Missing root path' }
    }
    const add = await runGit(rootPath, ['add', '-A'])
    if (!add.ok) {
      return { ok: false, error: add.stderr || add.stdout }
    }
    const commit = await runGit(rootPath, ['commit', '-m', message || 'Update'])
    return { ok: commit.ok, error: commit.ok ? undefined : commit.stderr || commit.stdout }
  })

  ipcMain.handle('ide:git-pull', async (_event, rootPath: string) => {
    if (!rootPath) {
      return { ok: false, error: 'Missing root path' }
    }
    const pull = await runGit(rootPath, ['pull', '--rebase'])
    return { ok: pull.ok, error: pull.ok ? undefined : pull.stderr || pull.stdout }
  })

  ipcMain.handle('ide:git-push', async (_event, rootPath: string) => {
    if (!rootPath) {
      return { ok: false, error: 'Missing root path' }
    }
    const push = await runGit(rootPath, ['push'])
    return { ok: push.ok, error: push.ok ? undefined : push.stderr || push.stdout }
  })

  ipcMain.handle('ide:git-show-file', async (_event, rootPath: string, filePath: string) => {
    if (!rootPath || !filePath) {
      return { ok: false, content: '' }
    }
    const relativePath = path.relative(rootPath, filePath)
    if (relativePath.startsWith('..')) {
      return { ok: false, content: '' }
    }
    const show = await runGit(rootPath, ['show', `HEAD:${relativePath}`])
    if (!show.ok) {
      return { ok: false, content: '' }
    }
    return { ok: true, content: show.stdout }
  })

  ipcMain.handle('ide:search-in-files', async (_event, rootPath: string, query: string) => {
    return searchInFiles(rootPath, query)
  })

  ipcMain.handle('ide:terminal-start', (event, id: string, cwd?: string) => {
    const existing = terminals.get(id)
    if (existing) {
      return true
    }

    // Try to find a valid shell
    let shell = process.env.SHELL

    // If no SHELL env var, try common shells in order
    if (!shell) {
      const commonShells = ['/bin/zsh', '/bin/bash', '/bin/sh']
      for (const testShell of commonShells) {
        try {
          // Check if shell exists
          const shellExists = require('fs').existsSync(testShell)
          if (shellExists) {
            shell = testShell
            break
          }
        } catch (e) {
          continue
        }
      }
    }

    // Windows fallback
    if (!shell && process.platform === 'win32') {
      shell = 'powershell.exe'
    }

    // Final fallback
    if (!shell) {
      shell = '/bin/sh'
    }

    console.log(`[Terminal ${id}] Starting shell: ${shell} in ${cwd || os.homedir()}`)

    try {
      const terminal = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: cwd || os.homedir(),
        env: process.env,
      })

      terminals.set(id, terminal)

      terminal.onData((data) => {
        if (event.sender.isDestroyed()) {
          return
        }
        event.sender.send('ide:terminal-data', id, data)
      })

      terminal.onExit(() => {
        terminals.delete(id)
      })

      return true
    } catch (error) {
      console.error(`[Terminal ${id}] Failed to spawn:`, error)
      throw error
    }
  })

  ipcMain.on('ide:terminal-input', (event, id: string, data: string) => {
    terminals.get(id)?.write(data)
  })

  ipcMain.on('ide:terminal-resize', (event, id: string, cols: number, rows: number) => {
    terminals.get(id)?.resize(cols, rows)
  })

  ipcMain.on('ide:terminal-kill', (event, id: string) => {
    const terminal = terminals.get(id)
    if (terminal) {
      terminal.kill()
      terminals.delete(id)
    }
  })

  ipcMain.handle('ide:codex-commit', async (_event, prompt: string, cwd?: string) => {
    const target = cwd || app.getAppPath()
    return runCodex(prompt, target)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

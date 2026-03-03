import type { FileNode } from './types'

declare global {
  interface Window {
    ide: {
      version: string
      selectFolder: () => Promise<{ rootPath: string; tree: FileNode[] } | null>
      openFolderByPath: (path: string) => Promise<{ rootPath: string; tree: FileNode[] } | null>
      openFile: () => Promise<
        | { filePath: string; content: string; rootPath: string; tree: FileNode[] }
        | null
      >
      readFile: (filePath: string) => Promise<string>
      readAgentsWork: () => Promise<
        | { ok: true; content: string; sourcePath: string }
        | { ok: false; error: string }
      >
      writeFile: (filePath: string, content: string) => Promise<boolean>
      createFile: (
        rootPath: string,
        dirPath: string,
        name: string,
      ) => Promise<{ ok: boolean; path?: string; error?: string }>
      createFolder: (
        rootPath: string,
        dirPath: string,
        name: string,
      ) => Promise<{ ok: boolean; path?: string; error?: string }>
      renamePath: (
        rootPath: string,
        targetPath: string,
        newName: string,
      ) => Promise<{ ok: boolean; path?: string; error?: string }>
      deletePath: (
        rootPath: string,
        targetPath: string,
      ) => Promise<{ ok: boolean; error?: string }>
      terminalStart: (terminalId: string, cwd?: string) => Promise<boolean>
      terminalInput: (terminalId: string, data: string) => void
      terminalResize: (terminalId: string, cols: number, rows: number) => void
      terminalKill: (terminalId: string) => void
      onTerminalData: (
        callback: (terminalId: string, data: string) => void,
      ) => () => void
      onTerminalExit: (
        callback: (terminalId: string, exitCode: number) => void,
      ) => () => void
      searchInFiles: (
        rootPath: string,
        query: string,
      ) => Promise<Array<{ filePath: string; line: number; text: string }>>
      gitStatus: (
        rootPath: string,
      ) => Promise<{ isRepo: boolean; clean: boolean; changes: string[]; error?: string }>
      gitInit: (rootPath: string) => Promise<{ ok: boolean; error?: string }>
      gitCommit: (
        rootPath: string,
        message: string,
      ) => Promise<{ ok: boolean; error?: string }>
      gitPull: (rootPath: string) => Promise<{ ok: boolean; error?: string }>
      gitPush: (rootPath: string) => Promise<{ ok: boolean; error?: string }>
      gitShowFile: (
        rootPath: string,
        filePath: string,
      ) => Promise<{ ok: boolean; content: string }>
      gitInfo: (
        rootPath: string,
      ) => Promise<{ branch: string; remote: string }>
      gitBranches: (
        rootPath: string,
      ) => Promise<{ ok: boolean; branches: string[]; error?: string }>
      gitCreateBranch: (
        rootPath: string,
        name: string,
      ) => Promise<{ ok: boolean; error?: string }>
      gitCheckoutBranch: (
        rootPath: string,
        name: string,
      ) => Promise<{ ok: boolean; error?: string }>
      gitMergeBranch: (
        rootPath: string,
        name: string,
      ) => Promise<{ ok: boolean; error?: string }>
      openRemote: (remoteUrl: string) => Promise<{ ok: boolean }>
      codexCommit: (
        prompt: string,
        cwd?: string,
        provider?: 'codex' | 'claude',
      ) => Promise<{ ok: boolean; output?: string; error?: string }>
    }
  }
}

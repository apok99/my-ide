const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('ide', {
  version: '0.1.0',
  selectFolder: () => ipcRenderer.invoke('ide:select-folder'),
  openFolderByPath: (path) => ipcRenderer.invoke('ide:open-folder-path', path),
  openFile: () => ipcRenderer.invoke('ide:open-file'),
  readFile: (filePath) => ipcRenderer.invoke('ide:read-file', filePath),
  readAgentsWork: () => ipcRenderer.invoke('ide:read-agents-work'),
  writeFile: (filePath, content) =>
    ipcRenderer.invoke('ide:write-file', filePath, content),
  createFile: (rootPath, dirPath, name) =>
    ipcRenderer.invoke('ide:create-file', rootPath, dirPath, name),
  createFolder: (rootPath, dirPath, name) =>
    ipcRenderer.invoke('ide:create-folder', rootPath, dirPath, name),
  renamePath: (rootPath, targetPath, newName) =>
    ipcRenderer.invoke('ide:rename-path', rootPath, targetPath, newName),
  deletePath: (rootPath, targetPath) =>
    ipcRenderer.invoke('ide:delete-path', rootPath, targetPath),
  terminalStart: (id, cwd) => ipcRenderer.invoke('ide:terminal-start', id, cwd),
  terminalInput: (id, data) => ipcRenderer.send('ide:terminal-input', id, data),
  terminalResize: (id, cols, rows) => ipcRenderer.send('ide:terminal-resize', id, cols, rows),
  terminalKill: (id) => ipcRenderer.send('ide:terminal-kill', id),
  onTerminalData: (callback) => {
    const listener = (_event, id, data) => callback(id, data)
    ipcRenderer.on('ide:terminal-data', listener)
    return () => ipcRenderer.removeListener('ide:terminal-data', listener)
  },
  searchInFiles: (rootPath, query) =>
    ipcRenderer.invoke('ide:search-in-files', rootPath, query),
  gitStatus: (rootPath) => ipcRenderer.invoke('ide:git-status', rootPath),
  gitInit: (rootPath) => ipcRenderer.invoke('ide:git-init', rootPath),
  gitCommit: (rootPath, message) => ipcRenderer.invoke('ide:git-commit', rootPath, message),
  gitPull: (rootPath) => ipcRenderer.invoke('ide:git-pull', rootPath),
  gitPush: (rootPath) => ipcRenderer.invoke('ide:git-push', rootPath),
  gitShowFile: (rootPath, filePath) =>
    ipcRenderer.invoke('ide:git-show-file', rootPath, filePath),
  gitInfo: (rootPath) => ipcRenderer.invoke('ide:git-info', rootPath),
  gitBranches: (rootPath) => ipcRenderer.invoke('ide:git-branches', rootPath),
  gitCreateBranch: (rootPath, name) =>
    ipcRenderer.invoke('ide:git-create-branch', rootPath, name),
  gitCheckoutBranch: (rootPath, name) =>
    ipcRenderer.invoke('ide:git-checkout-branch', rootPath, name),
  gitMergeBranch: (rootPath, name) =>
    ipcRenderer.invoke('ide:git-merge-branch', rootPath, name),
  openRemote: (remoteUrl) => ipcRenderer.invoke('ide:open-remote', remoteUrl),
  codexCommit: (prompt, cwd) => ipcRenderer.invoke('ide:codex-commit', prompt, cwd),
})

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('ide', {
  version: '0.1.0',
  selectFolder: () => ipcRenderer.invoke('ide:select-folder'),
  openFolderByPath: (path) => ipcRenderer.invoke('ide:open-folder-path', path),
  openFile: () => ipcRenderer.invoke('ide:open-file'),
  readFile: (filePath) => ipcRenderer.invoke('ide:read-file', filePath),
  writeFile: (filePath, content) =>
    ipcRenderer.invoke('ide:write-file', filePath, content),
  terminalStart: (id) => ipcRenderer.invoke('ide:terminal-start', id),
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
  codexCommit: (prompt, cwd) => ipcRenderer.invoke('ide:codex-commit', prompt, cwd),
})

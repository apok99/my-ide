export type FileNode = {
  name: string
  path: string
  kind: 'file' | 'dir'
  children?: FileNode[]
}

export type LoadedFile = {
  path: string
  name: string
  content: string
  dirty: boolean
}

export type DiffTarget = {
  filePath: string
  original: string
  modified: string
}

export type SearchResult = {
  kind: 'search'
  filePath: string
  line: number
  text: string
}

export type FileItem = {
  kind: 'file'
  path: string
  name: string
}

export type SymbolItem = {
  kind: 'symbol'
  name: string
  detail?: string
  containerName?: string
  filePath: string
  line: number
  column: number
}

export type ProblemItem = {
  filePath: string
  line: number
  column: number
  message: string
  severity: 'error' | 'warning' | 'info' | 'hint'
  source?: string
}

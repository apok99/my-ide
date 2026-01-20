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

export type SearchResult = {
  filePath: string
  line: number
  text: string
}

export type FileItem = {
  path: string
  name: string
}

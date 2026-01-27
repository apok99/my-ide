import { useEffect, useRef } from 'react'
import type { FileItem, SearchResult, SymbolItem } from '../../types'

type Mode = 'file' | 'search' | 'symbol' | 'line'

type SearchPaletteProps = {
  mode: Mode
  query: string
  results: Array<FileItem | SearchResult | SymbolItem>
  selectedIndex: number
  onQueryChange: (value: string) => void
  onSelect: (item: FileItem | SearchResult | SymbolItem) => void
  onLineSubmit?: (value: string) => void
  onClose: () => void
  onMoveSelection: (nextIndex: number) => void
}

export function SearchPalette({
  mode,
  query,
  results,
  selectedIndex,
  onQueryChange,
  onSelect,
  onLineSubmit,
  onClose,
  onMoveSelection,
}: SearchPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [mode])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-6">
      <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-white/10 bg-[#1e1e1e] shadow-2xl">
        <div className="border-b border-white/10 px-4 py-3">
          <input
            ref={inputRef}
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/40"
            placeholder={
              mode === 'file'
                ? 'Open file (Ctrl+Shift+O / Cmd+Shift+O)'
                : mode === 'search'
                  ? 'Search in files (Ctrl+Shift+F / Cmd+Shift+F)'
                  : mode === 'symbol'
                    ? 'Go to symbol (Ctrl+T / Cmd+T)'
                    : 'Go to line (Ctrl+G / Cmd+G)'
            }
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                onClose()
                return
              }
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                if (results.length === 0) {
                  return
                }
                onMoveSelection(Math.min(selectedIndex + 1, results.length - 1))
                return
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault()
                if (results.length === 0) {
                  return
                }
                onMoveSelection(Math.max(selectedIndex - 1, 0))
                return
              }
              if (event.key === 'Enter') {
                event.preventDefault()
                if (mode === 'line' && onLineSubmit) {
                  onLineSubmit(query)
                  return
                }
                if (results[selectedIndex]) {
                  onSelect(results[selectedIndex])
                }
              }
            }}
          />
        </div>
        <div className="max-h-[60vh] overflow-auto">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-sm text-white/40">
              {mode === 'line' ? 'Type a line number, e.g. 42 or 42:7' : 'No results'}
            </div>
          ) : (
            results.map((item, index) => {
              const isActive = index === selectedIndex
              if (item.kind === 'search') {
                return (
                  <button
                    type="button"
                    key={`${item.filePath}-${item.line}-${index}`}
                    onClick={() => onSelect(item)}
                    className={`flex w-full flex-col gap-1 px-4 py-3 text-left text-sm transition-colors ${
                      isActive ? 'bg-blue-600/20 text-white' : 'text-white/70 hover:bg-white/5'
                    }`}
                  >
                    <span className="text-xs text-white/50">
                      {item.filePath} : {item.line}
                    </span>
                    <span className="truncate">{item.text}</span>
                  </button>
                )
              }
              if (item.kind === 'symbol') {
                return (
                  <button
                    type="button"
                    key={`${item.filePath}:${item.line}:${item.column}:${item.name}`}
                    onClick={() => onSelect(item)}
                    className={`flex w-full flex-col gap-1 px-4 py-3 text-left text-sm transition-colors ${
                      isActive ? 'bg-blue-600/20 text-white' : 'text-white/70 hover:bg-white/5'
                    }`}
                  >
                    <span className="truncate">{item.name}</span>
                    <span className="text-xs text-white/50">
                      {item.containerName ? `${item.containerName} • ` : ''}
                      {item.detail ?? ''} {item.line}:{item.column}
                    </span>
                  </button>
                )
              }
              return (
                <button
                  type="button"
                  key={item.path}
                  onClick={() => onSelect(item)}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition-colors ${
                    isActive ? 'bg-blue-600/20 text-white' : 'text-white/70 hover:bg-white/5'
                  }`}
                >
                  <span className="truncate">{item.name}</span>
                  <span className="text-xs text-white/40">{item.path}</span>
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

import { useEffect, useRef } from 'react'
import type { FileItem, SearchResult, SymbolItem } from '../../types'

type Mode = 'file' | 'search' | 'symbol' | 'line'

type SearchPaletteProps = {
  mode: Mode
  query: string
  results: Array<FileItem | SearchResult | SymbolItem>
  selectedIndex: number
  isSearching?: boolean
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
  isSearching,
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

  const showSearchHint = mode === 'search' && query.trim().length < 2 && !isSearching

  const emptyMessage = () => {
    if (mode === 'line') return 'Type a line number, e.g. 42 or 42:7'
    if (showSearchHint) return 'Type at least 2 characters to search'
    if (isSearching) return null
    return 'No results'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-6">
      <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-white/10 bg-[#1e1e1e] shadow-2xl">

        {/* Input row */}
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40"
            placeholder={
              mode === 'file'
                ? 'Open file...'
                : mode === 'search'
                  ? 'Search in files...'
                  : mode === 'symbol'
                    ? 'Go to symbol...'
                    : 'Go to line, e.g. 42 or 42:7'
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
                if (results.length === 0) return
                onMoveSelection(Math.min(selectedIndex + 1, results.length - 1))
                return
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault()
                if (results.length === 0) return
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

          {/* Searching spinner */}
          {isSearching && (
            <svg
              className="h-4 w-4 shrink-0 animate-spin text-white/30"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
          )}

          {/* Result count */}
          {!isSearching && results.length > 0 && mode === 'search' && (
            <span className="shrink-0 text-[10px] text-white/25">{results.length} matches</span>
          )}
        </div>

        {/* Results list */}
        <div className="max-h-[60vh] overflow-auto">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-sm text-white/40">
              {isSearching
                ? <span className="text-white/30">Searching…</span>
                : emptyMessage()
              }
            </div>
          ) : (
            results.map((item, index) => {
              const isActive = index === selectedIndex
              if (item.kind === 'search') {
                // Make the filePath relative for display
                const displayPath = item.filePath.includes('/')
                  ? item.filePath.split('/').slice(-2).join('/')
                  : item.filePath
                return (
                  <button
                    type="button"
                    key={`${item.filePath}-${item.line}-${index}`}
                    onClick={() => onSelect(item)}
                    className={`flex w-full flex-col gap-0.5 px-4 py-2.5 text-left text-sm transition-colors ${
                      isActive ? 'bg-blue-600/20 text-white' : 'text-white/70 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="truncate text-xs text-white/50">{displayPath}</span>
                      <span className="shrink-0 font-mono text-[10px] text-white/25">:{item.line}</span>
                    </div>
                    <span className="truncate text-[13px]">{item.text}</span>
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

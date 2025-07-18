'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface SearchResult {
  id: string
  title: string
  subtitle?: string
  [key: string]: any
}

interface IncrementalSearchProps {
  label?: string
  placeholder: string
  onSearch: (query: string) => Promise<SearchResult[]>
  onSelect: (result: SearchResult) => void
  className?: string
  minChars?: number
  debounceMs?: number
  maxResults?: number
  renderResult?: (result: SearchResult, isHighlighted: boolean) => React.ReactNode
  disabled?: boolean
}

export function IncrementalSearch({
  label,
  placeholder,
  onSearch,
  onSelect,
  className = '',
  minChars = 2,
  debounceMs = 300,
  maxResults = 10,
  renderResult,
  disabled = false
}: IncrementalSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [error, setError] = useState<string | null>(null)
  
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // debounced search function
  const debouncedSearch = useCallback(async (searchQuery: string) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }

    debounceTimeoutRef.current = setTimeout(async () => {
      if (!searchQuery || searchQuery.length < minChars) {
        setResults([])
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        setError(null)
        const searchResults = await onSearch(searchQuery)
        setResults(searchResults.slice(0, maxResults))
      } catch (err) {
        console.error('Search error:', err)
        setError('Search failed. Please try again.')
        setResults([])
      } finally {
        setIsLoading(false)
      }
    }, debounceMs)
  }, [onSearch, minChars, maxResults, debounceMs])

  // handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value
    setQuery(newQuery)
    setIsOpen(true)
    setHighlightedIndex(-1)
    
    if (newQuery.length >= minChars) {
      debouncedSearch(newQuery)
    } else {
      setResults([])
    }
  }

  // handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex(prev => 
          prev < results.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : prev)
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0 && highlightedIndex < results.length) {
          handleSelect(results[highlightedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        setHighlightedIndex(-1)
        break
      case 'Tab':
        if (highlightedIndex >= 0 && highlightedIndex < results.length) {
          e.preventDefault()
          handleSelect(results[highlightedIndex])
        }
        break
    }
  }

  const handleSelect = (result: SearchResult) => {
    onSelect(result)
    setQuery(result.title)
    setIsOpen(false)
    setHighlightedIndex(-1)
  }

  // handle click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [])

  // default result renderer
  const defaultRenderResult = (result: SearchResult, isHighlighted: boolean) => (
    <div className={`p-3 ${isHighlighted ? 'bg-blue-50 border-l-4 border-blue-500' : 'hover:bg-gray-50'}`}>
      <div className="font-medium text-gray-900">{result.title}</div>
      {result.subtitle && (
        <div className="text-sm text-gray-500">{result.subtitle}</div>
      )}
    </div>
  )

  return (
    <div className={`relative ${className}`} ref={wrapperRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}
      
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={`
            w-full p-3 bg-white rounded-lg border border-gray-300 
            focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
            transition-colors
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        />
        
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          </div>
        )}
        
        {!isLoading && query && (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setResults([])
              setIsOpen(false)
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}

      {/* search results */}
      {isOpen && results.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
          {results.map((result, index) => (
            <button
              key={result.id}
              className="w-full text-left focus:outline-none transition-colors"
              onClick={() => handleSelect(result)}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              {renderResult ? renderResult(result, index === highlightedIndex) : defaultRenderResult(result, index === highlightedIndex)}
            </button>
          ))}
        </div>
      )}

              {/* no results */}
      {isOpen && query.length >= minChars && results.length === 0 && !isLoading && !error && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4 text-center text-gray-500">
          <p>No results found for "{query}"</p>
        </div>
      )}

              {/* search instructions */}
      {isOpen && query.length < minChars && !isLoading && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4 text-center text-gray-500">
          <p>Type at least {minChars} characters to search</p>
        </div>
      )}
    </div>
  )
} 
'use client'

import { useState, useEffect, useRef, KeyboardEvent, useCallback } from 'react'

interface AutocompleteInputProps {
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  options: string[]
  onSelect: (value: string) => void
  className?: string
  disabled?: boolean
  isLoading?: boolean
  error?: string | null
  minChars?: number
  maxResults?: number
  highlightMatches?: boolean
  allowCustomValue?: boolean
  debounceMs?: number
  onSearch?: (query: string) => void
}

export function AutocompleteInput({
  label,
  placeholder,
  value,
  onChange,
  options,
  onSelect,
  className = '',
  disabled = false,
  isLoading = false,
  error,
  minChars = 0,
  maxResults = 10,
  highlightMatches = true,
  allowCustomValue = false,
  debounceMs = 300,
  onSearch
}: AutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [filteredOptions, setFilteredOptions] = useState<string[]>([])
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [inputValue, setInputValue] = useState(value)
  const [searchLoading, setSearchLoading] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Update input value when prop changes
  useEffect(() => {
    setInputValue(value)
  }, [value])

  // Debounced search function
  const debouncedSearch = useCallback((query: string) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }

    debounceTimeoutRef.current = setTimeout(() => {
      if (onSearch) {
        setSearchLoading(true)
        onSearch(query)
        // Reset loading after a short delay to show the search was performed
        setTimeout(() => setSearchLoading(false), 500)
      }
    }, debounceMs)
  }, [onSearch, debounceMs])

  // Fuzzy search function
  const fuzzySearch = (query: string, text: string): boolean => {
    const queryLower = query.toLowerCase()
    const textLower = text.toLowerCase()
    
    // Exact match gets highest priority
    if (textLower.includes(queryLower)) {
      return true
    }
    
    // Fuzzy match - check if all characters in query appear in order in text
    let queryIndex = 0
    for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
      if (textLower[i] === queryLower[queryIndex]) {
        queryIndex++
      }
    }
    return queryIndex === queryLower.length
  }

  // Filter and sort options based on input value
  useEffect(() => {
    if (!inputValue || inputValue.length < minChars) {
      setFilteredOptions([])
      setHighlightedIndex(-1)
      return
    }

    // Trigger incremental search if onSearch is provided
    if (onSearch) {
      debouncedSearch(inputValue)
    }

    const filtered = options
      .filter(option => fuzzySearch(inputValue, option))
      .sort((a, b) => {
        const aLower = a.toLowerCase()
        const bLower = b.toLowerCase()
        const inputLower = inputValue.toLowerCase()
        
        // Exact matches first
        const aExact = aLower.startsWith(inputLower)
        const bExact = bLower.startsWith(inputLower)
        
        if (aExact && !bExact) return -1
        if (!aExact && bExact) return 1
        
        // Then by length (shorter matches first)
        if (aExact && bExact) {
          return aLower.length - bLower.length
        }
        
        // Then by position of match
        const aIndex = aLower.indexOf(inputLower)
        const bIndex = bLower.indexOf(inputLower)
        
        if (aIndex !== bIndex) {
          return aIndex - bIndex
        }
        
        // Finally by length
        return aLower.length - bLower.length
      })
      .slice(0, maxResults)

    setFilteredOptions(filtered)
    setHighlightedIndex(-1)
  }, [inputValue, options, minChars, maxResults, onSearch, debouncedSearch])

  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [])

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Handle keyboard navigation
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && filteredOptions.length > 0) {
      setIsOpen(true)
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex(prev => 
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : prev)
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          handleSelect(filteredOptions[highlightedIndex])
        } else if (allowCustomValue && inputValue.trim()) {
          handleSelect(inputValue.trim())
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        setHighlightedIndex(-1)
        break
      case 'Tab':
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          e.preventDefault()
          handleSelect(filteredOptions[highlightedIndex])
        }
        break
    }
  }

  const handleSelect = (selectedValue: string) => {
    setInputValue(selectedValue)
    onChange(selectedValue)
    onSelect(selectedValue)
    setIsOpen(false)
    setHighlightedIndex(-1)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    onChange(newValue)
    setIsOpen(true)
  }

  // Highlight matching text
  const highlightText = (text: string, query: string) => {
    if (!highlightMatches || !query) return text
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    const parts = text.split(regex)
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <span key={index} className="bg-yellow-200 font-semibold">
          {part}
        </span>
      ) : (
        part
      )
    )
  }

  const showLoading = isLoading || searchLoading

  return (
    <div className="relative" ref={wrapperRef}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || showLoading}
          className={`
            w-full p-3 bg-white rounded-lg border 
            ${error ? 'border-red-500' : 'border-gray-300'} 
            focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
            transition-colors
            ${disabled || showLoading ? 'opacity-50 cursor-not-allowed' : ''}
            ${className}
          `}
        />
        {showLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          </div>
        )}
        {!showLoading && inputValue && (
          <button
            type="button"
            onClick={() => {
              setInputValue('')
              onChange('')
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
      
      {isOpen && filteredOptions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
          {filteredOptions.map((option, index) => (
            <button
              key={index}
              className={`
                w-full px-4 py-2 text-left hover:bg-gray-50 focus:outline-none
                ${index === highlightedIndex ? 'bg-blue-50 border-l-4 border-blue-500' : ''}
                transition-colors
              `}
              onClick={() => handleSelect(option)}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              {highlightText(option, inputValue)}
            </button>
          ))}
        </div>
      )}
      
      {isOpen && inputValue.length >= minChars && filteredOptions.length === 0 && !showLoading && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4 text-center text-gray-500">
          {allowCustomValue ? (
            <div>
              <p>No matches found</p>
              <p className="text-sm mt-1">Press Enter to use "{inputValue}"</p>
            </div>
          ) : (
            <p>No matches found</p>
          )}
        </div>
      )}
    </div>
  )
} 
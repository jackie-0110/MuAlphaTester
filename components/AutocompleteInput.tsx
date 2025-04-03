'use client'

import { useState, useEffect, useRef, KeyboardEvent } from 'react'

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
  error
}: AutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [filteredOptions, setFilteredOptions] = useState<string[]>([])
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Filter options based on input value
  useEffect(() => {
    const filtered = options.filter(option =>
      option.toLowerCase().includes(value.toLowerCase())
    )
    setFilteredOptions(filtered)
    setHighlightedIndex(-1)
  }, [value, options])

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
    if (!isOpen) {
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
          onSelect(filteredOptions[highlightedIndex])
          setIsOpen(false)
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        setHighlightedIndex(-1)
        break
    }
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          className={`
            w-full p-3 bg-white rounded-lg border 
            ${error ? 'border-red-500' : 'border-gray-300'} 
            focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
            transition-colors
            ${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : ''}
            ${className}
          `}
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          </div>
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
                w-full px-4 py-2 text-left
                ${index === highlightedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'}
                focus:outline-none focus:bg-blue-50
              `}
              onClick={() => {
                onSelect(option)
                setIsOpen(false)
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  )
} 
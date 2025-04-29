'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../utils/supabase'

interface TestSelectorProps {
  onSelect: (selection: { division: string; topic: string | null }) => void
  className?: string
}

export function TestSelector({ onSelect, className = '' }: TestSelectorProps) {
  const [divisions, setDivisions] = useState<string[]>([])
  const [topics, setTopics] = useState<string[]>([])
  const [inputValue, setInputValue] = useState('')
  const [showOptions, setShowOptions] = useState(false)
  const [selectedDivision, setSelectedDivision] = useState<string | null>(null)
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)
  const [filteredOptions, setFilteredOptions] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fetch divisions and topics
  useEffect(() => {
    fetchDivisions()
  }, [])

  useEffect(() => {
    if (selectedDivision) {
      fetchTopics(selectedDivision)
    }
  }, [selectedDivision])

  const fetchDivisions = async () => {
    try {
      const { data, error } = await supabase
        .from('questions')
        .select('division')
        .order('division')

      if (error) throw error

      const uniqueDivisions = [...new Set(data.map((d: { division: string }) => d.division))].sort()
      setDivisions(uniqueDivisions)
      // Set the first division as selected by default
      if (uniqueDivisions.length > 0) {
        setSelectedDivision(uniqueDivisions[0])
        fetchTopics(uniqueDivisions[0])
      }
    } catch (error) {
      console.error('Error fetching divisions:', error)
    }
  }

  const fetchTopics = async (division: string) => {
    try {
      const { data, error } = await supabase
        .from('questions')
        .select('topic')
        .eq('division', division)
        .order('topic')

      if (error) throw error

      const uniqueTopics = [...new Set(data.map((d: { topic: string }) => d.topic))].sort()
      setTopics(['All Topics', ...uniqueTopics])
      setFilteredOptions(['All Topics', ...uniqueTopics])
    } catch (error) {
      console.error('Error fetching topics:', error)
    }
  }

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)
    setShowOptions(true)

    // Filter topics based on input
    const filtered = topics.filter(option => 
      option.toLowerCase().includes(value.toLowerCase())
    )
    setFilteredOptions(filtered)
  }

  // Handle option selection
  const handleOptionSelect = (option: string) => {
    setSelectedTopic(option)
    setShowOptions(false)
    onSelect({ division: selectedDivision!, topic: option === 'All Topics' ? null : option })
  }

  // Handle clicks outside the component
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowOptions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center space-x-2">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setShowOptions(true)}
          placeholder="Select topic (or leave empty for all)"
          className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {showOptions && filteredOptions.length > 0 && (
        <div 
          ref={dropdownRef}
          className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {filteredOptions.map((option) => (
            <div
              key={option}
              onClick={() => handleOptionSelect(option)}
              className="px-4 py-2 hover:bg-blue-50 cursor-pointer"
            >
              {option}
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 
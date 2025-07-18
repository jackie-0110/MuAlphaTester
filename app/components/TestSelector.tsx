'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../utils/supabase'
import { AutocompleteInput } from './AutocompleteInput'

interface TestSelectorProps {
  onSelect: (selection: { division: string; topic: string | null }) => void
  className?: string
}

export function TestSelector({ onSelect, className = '' }: TestSelectorProps) {
  const [divisions, setDivisions] = useState<string[]>([])
  const [topics, setTopics] = useState<string[]>([])
  const [selectedDivision, setSelectedDivision] = useState<string | null>(null)
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // fetch divisions and topics
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
      setLoading(true)
      const { data, error } = await supabase
        .from('questions')
        .select('division')
        .order('division')

      if (error) throw error

      const uniqueDivisions = [...new Set(data.map((d: { division: string }) => d.division))].sort()
      setDivisions(uniqueDivisions)
      // set the first division as selected by default
      if (uniqueDivisions.length > 0) {
        setSelectedDivision(uniqueDivisions[0])
        fetchTopics(uniqueDivisions[0])
      }
    } catch (error) {
      console.error('Error fetching divisions:', error)
    } finally {
      setLoading(false)
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
    } catch (error) {
      console.error('Error fetching topics:', error)
    }
  }

  // handle division selection
  const handleDivisionSelect = (division: string) => {
    setSelectedDivision(division)
    setSelectedTopic(null)
    onSelect({ division, topic: null })
  }

  // handle topic selection
  const handleTopicSelect = (topic: string) => {
    setSelectedTopic(topic)
    onSelect({ 
      division: selectedDivision!, 
      topic: topic === 'All Topics' ? null : topic 
    })
  }

  return (
    <div className={`space-y-4 ${className}`}>
              {/* division selection */}
      <AutocompleteInput
        label="Division"
        placeholder="Select a division..."
        value={selectedDivision || ''}
        onChange={handleDivisionSelect}
        options={divisions}
        onSelect={handleDivisionSelect}
        isLoading={loading}
        minChars={0}
        maxResults={15}
        highlightMatches={true}
        allowCustomValue={false}
      />

              {/* topic selection */}
      <AutocompleteInput
        label="Topic"
        placeholder="Select a topic (or leave empty for all)"
        value={selectedTopic || ''}
        onChange={handleTopicSelect}
        options={topics}
        onSelect={handleTopicSelect}
        disabled={!selectedDivision}
        minChars={0}
        maxResults={20}
        highlightMatches={true}
        allowCustomValue={false}
      />
    </div>
  )
} 
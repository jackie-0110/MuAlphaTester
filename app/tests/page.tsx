'use client'

import { useState } from 'react'
import { ProtectedRoute } from '../../components/ProtectedRoute'
import { TestSelector } from '../components/TestSelector'
import { TestQuestions } from '../components/TestQuestions'

export default function TestPage() {
  const [selection, setSelection] = useState<{ division: string; topic: string | null } | null>(null)
  const [showResults, setShowResults] = useState(false)
  const [finalScore, setFinalScore] = useState(0)

  const handleSelect = (selection: { division: string; topic: string | null }) => {
    setSelection(selection)
    setShowResults(false)
  }

  const handleComplete = (score: number) => {
    setFinalScore(score)
    setShowResults(true)
  }

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Problem Set Generation</h1>

        {!selection && (
          <div className="bg-white p-6 rounded-lg shadow-lg">
            
            <TestSelector onSelect={handleSelect} />
          </div>
        )}

        {selection && !showResults && (
          <TestQuestions
            division={selection.division}
            topic={selection.topic}
            onComplete={handleComplete}
          />
        )}

        
      </div>
    </ProtectedRoute>
  )
} 
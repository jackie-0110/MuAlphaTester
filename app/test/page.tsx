'use client'

import { useState } from 'react'
import { ProtectedRoute } from '../components/ProtectedRoute'
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
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Take a Test</h1>

        {!selection && (
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Select Test Parameters</h2>
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

        {showResults && (
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Test Results</h2>
            <div className="text-center">
              <p className="text-4xl font-bold text-blue-600 mb-2">{finalScore}</p>
              <p className="text-gray-600">Your Score</p>
            </div>
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => {
                  setSelection(null)
                  setShowResults(false)
                }}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Take Another Test
              </button>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
} 
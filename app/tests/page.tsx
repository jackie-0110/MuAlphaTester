'use client'

import { ProtectedRoute } from '../../components/ProtectedRoute'
import { TestQuestions } from '../components/TestQuestions'

export default function TestPage() {
  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Problem Set Generation</h1>
        <TestQuestions />
      </div>
    </ProtectedRoute>
  )
} 
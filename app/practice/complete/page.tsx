'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../utils/supabase'

interface PracticeAttempt {
  id: string
  user_id: string
  question_id: string
  user_answer: string
  is_correct: boolean
  session_id: string
  division: string
  topic: string
  created_at: string
}

interface SessionResult {
  total_questions: number
  correct_answers: number
  division: string
  difficulty: string
  timestamp: string
}

export default function PracticeComplete() {
  const router = useRouter()
  const [sessionResult, setSessionResult] = useState<SessionResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchSessionResult = async () => {
      try {
        // Get session ID from localStorage
        const preferences = localStorage.getItem('practicePreferences')
        if (!preferences) {
          router.push('/practice')
          return
        }

        const { timestamp } = JSON.parse(preferences)

        // Fetch session results from Supabase
        const { data, error } = await supabase
          .from('practice_attempts')
          .select('*')
          .eq('session_id', timestamp)
          .order('created_at', { ascending: true })

        if (error) throw error

        if (!data || data.length === 0) {
          console.error('No practice attempts found for session:', timestamp)
          return
        }

        // Calculate results
        const totalQuestions = data.length
        const correctAnswers = data.filter((attempt: PracticeAttempt) => attempt.is_correct).length

        setSessionResult({
          total_questions: totalQuestions,
          correct_answers: correctAnswers,
          division: data[0].division,
          difficulty: JSON.parse(preferences).difficulty,
          timestamp
        })

        // Clear session data from localStorage
        localStorage.removeItem('practicePreferences')
      } catch (error) {
        console.error('Error fetching session results:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchSessionResult()
  }, [router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading results...</div>
      </div>
    )
  }

  if (!sessionResult) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">No session results found</div>
      </div>
    )
  }

  const percentage = Math.round((sessionResult.correct_answers / sessionResult.total_questions) * 100)

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="mb-8">
            <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl font-bold text-blue-600">{percentage}%</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Practice Session Complete!
            </h1>
            <p className="text-gray-600">
              You completed {sessionResult.total_questions} questions in {sessionResult.division}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">
                {sessionResult.correct_answers}
              </div>
              <div className="text-sm text-gray-600">Correct Answers</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">
                {sessionResult.total_questions}
              </div>
              <div className="text-sm text-gray-600">Total Questions</div>
            </div>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => router.push('/practice')}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Start New Practice Session
            </button>
            <button
              onClick={() => router.push('/practice/history')}
              className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              View Practice History
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 
'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../utils/supabase'
import 'katex/dist/katex.min.css'
import renderMathInElement from 'katex/dist/contrib/auto-render'

interface Question {
  id: string
  question_text: string
  options: string[]
  answer: string
  division: string
  topic: string
  difficulty: number
}

interface TestQuestionsProps {
  division: string
  topic: string | null
  onComplete: (score: number) => void
}

function KatexContent({ text }: { text: string }) {
  const katexRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (katexRef.current) {
      renderMathInElement(katexRef.current, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
        ],
        throwOnError: false,
        output: 'html',
      })
    }
  }, [text])

  return <div ref={katexRef}>{text}</div>
}

export function TestQuestions({ division, topic, onComplete }: TestQuestionsProps) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({})
  const [score, setScore] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchQuestions()
  }, [division, topic])

  const fetchQuestions = async () => {
    try {
      setLoading(true)
      setError(null)

      let query = supabase
        .from('questions')
        .select('*')
        .eq('division', division)
        .order('id')

      if (topic) {
        query = query.eq('topic', topic)
      }

      const { data, error } = await query

      if (error) throw error

      setQuestions(data || [])
      setCurrentQuestion(0)
      setUserAnswers({})
      setScore(0)
    } catch (error) {
      console.error('Error fetching questions:', error)
      setError('Failed to load questions')
    } finally {
      setLoading(false)
    }
  }

  const handleAnswer = (answer: string) => {
    const currentQuestionData = questions[currentQuestion]
    const isCorrect = answer === currentQuestionData.answer

    setUserAnswers(prev => ({
      ...prev,
      [currentQuestionData.id]: answer
    }))

    if (isCorrect) {
      setScore(prev => prev + 1)
    }

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prev => prev + 1)
    } else {
      onComplete(score + (isCorrect ? 1 : 0))
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-lg">
        {error}
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="text-center text-gray-500 p-4">
        No questions available for this selection.
      </div>
    )
  }

  const currentQuestionData = questions[currentQuestion]

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-500">
          Question {currentQuestion + 1} of {questions.length}
        </div>
        <div className="text-sm text-gray-500">
          Score: {score}/{currentQuestion}
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-lg">
        <div className="mb-6">
          <KatexContent text={currentQuestionData.question_text} />
        </div>

        <div className="space-y-4">
          {currentQuestionData.options.map((option, index) => (
            <button
              key={index}
              onClick={() => handleAnswer(option)}
              className={`w-full p-4 text-left rounded-lg border transition-colors ${
                userAnswers[currentQuestionData.id] === option
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-300'
              }`}
            >
              <KatexContent text={option} />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
} 
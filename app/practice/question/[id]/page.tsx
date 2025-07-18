'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../../utils/supabase'
import { ProtectedRoute } from '../../../components/ProtectedRoute'
import { toast, Toaster } from 'react-hot-toast'
import FlagQuestion from '../../../components/FlagQuestion'
import 'katex/dist/katex.min.css'
import renderMathInElement from 'katex/dist/contrib/auto-render'
import { logQuestionAttempt } from '@/app/utils/logQuestionAttempt'

interface Question {
  id: string
  question_text: string
  options: string[]
  answer: string
  difficulty: number
  topic: string
  division: string
}

function KatexContent({ text }: { text: string }) {
  const elementRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (elementRef.current) {
      // Clear previous content to prevent rendering issues
      elementRef.current.innerHTML = text
      
      // Re-render KaTeX
      renderMathInElement(elementRef.current, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
        ],
        throwOnError: false,
        errorColor: '#cc0000',
      })
    }
  }, [text])

  return <div ref={elementRef} />
}

function renderLatex(text: string) {
  return <KatexContent text={text} />
}

export default function QuestionPage() {
  const params = useParams()
  const router = useRouter()
  const questionId = params?.id as string
  
  const [question, setQuestion] = useState<Question | null>(null)
  const [loading, setLoading] = useState(true)
  const [userAnswer, setUserAnswer] = useState<number | null>(null)
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'correct' | 'incorrect', message: string } | null>(null)
  const [showSolution, setShowSolution] = useState(false)

  useEffect(() => {
    if (questionId) {
      fetchQuestion()
    }
  }, [questionId])

  const fetchQuestion = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('id', questionId)
        .single()

      if (error) {
        throw error
      }

      setQuestion(data)
    } catch (error) {
      console.error('Error fetching question:', error)
      toast.error('Failed to load question')
    } finally {
      setLoading(false)
    }
  }

  const handleAnswer = async () => {
    if (!question || userAnswer === null) return

    // Ensure question.answer is a number (index)
    const correctIndex = typeof question.answer === 'number' ? question.answer : parseInt(question.answer, 10)
    const isCorrect = userAnswer === correctIndex

    // Log the attempt to Supabase
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await logQuestionAttempt({
          userId: session.user.id,
          questionId: question.id,
          division: question.division,
          topic: question.topic,
          attempts: 1, // For now, always 1 per submission
          gaveUp: false,
          userAnswers: [userAnswer],
          isCorrect,
        });
      }
    } catch (err) {
      console.error('Failed to log question attempt:', err);
    }

    if (isCorrect) {
      setFeedback({
        type: 'correct',
        message: 'Correct!'
      })
      setShowSolution(true)
    } else {
      setFeedback({
        type: 'incorrect',
        message: `Incorrect. The correct answer is: ${question.options[correctIndex]}`
      })
      setShowSolution(true)
    }

    setIsAnswerSubmitted(true)
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-10 bg-gray-200 rounded mb-4"></div>
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (!question) {
    return (
      <ProtectedRoute>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Question Not Found</h1>
            <button
              onClick={() => router.back()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Go Back
            </button>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 py-8">
        <Toaster />
        
        {/* Back Button */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center text-blue-600 hover:text-blue-700 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Practice
          </button>
        </div>

        {/* Question Display */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                question.difficulty <= 3 ? 'bg-green-100 text-green-800' :
                question.difficulty <= 6 ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {question.difficulty <= 3 ? 'Easy' :
                 question.difficulty <= 6 ? 'Medium' : 'Hard'}
              </span>
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                {question.topic}
              </span>
            </div>
            <FlagQuestion 
              questionId={question.id}
              questionText={question.question_text}
            />
          </div>

          {/* Question Content */}
          <div className="mb-6">
            <div className="prose max-w-none">
              {renderLatex(question.question_text)}
            </div>
          </div>

          {/* Answer Options */}
          {!isAnswerSubmitted && (
            <div className="space-y-3 mb-6">
              {question.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => setUserAnswer(userAnswer === index ? null : index)}
                  className={`w-full p-4 text-left border rounded-lg transition-all duration-200 ${
                    userAnswer === index
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span className="font-medium text-gray-700">
                    {String.fromCharCode(65 + index)}. 
                  </span>
                  <span className="ml-2">{renderLatex(option)}</span>
                </button>
              ))}
            </div>
          )}

          {/* Feedback */}
          {feedback && (
            <div className={`p-4 rounded-lg mb-6 ${
              feedback.type === 'correct' 
                ? 'bg-green-50 border border-green-200' 
                : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-center">
                {feedback.type === 'correct' ? (
                  <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                <span className={`font-medium ${
                  feedback.type === 'correct' ? 'text-green-800' : 'text-red-800'
                }`}>
                  {feedback.message}
                </span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {!isAnswerSubmitted && userAnswer !== null && (
                <button
                  onClick={handleAnswer}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Submit Answer
                </button>
              )}
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={() => router.back()}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Back to List
              </button>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
} 
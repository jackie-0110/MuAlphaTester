'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../utils/supabase'
import { ProtectedRoute } from '../../../components/ProtectedRoute'
import { toast, Toaster } from 'react-hot-toast'
import FlagQuestion from '../../components/FlagQuestion'
import 'katex/dist/katex.min.css'
import renderMathInElement from 'katex/dist/contrib/auto-render'

interface Question {
  id: string
  question_text: string
  options: string[]
  answer: string
  difficulty: number
  level: number
  xp_reward: number
  accuracy_bonus: number
  stamina_bonus: number
  topic: string
  division: string
}

interface QuestionAttempt {
  attempts: number
  last_attempt: string
  last_correct: boolean
  user_answers: string[]
  is_completed: boolean
  gave_up: boolean
}

interface UserStats {
  level: number
  xp: number
  xp_to_next_level: number
  accuracy: number
  stamina: number
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

export default function AdaptivePracticePage() {
  const router = useRouter()
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [score, setScore] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userAnswer, setUserAnswer] = useState<string>('')
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'correct' | 'incorrect', message: string } | null>(null)
  const [answerStreak, setAnswerStreak] = useState(0)
  const [bestAnswerStreak, setBestAnswerStreak] = useState(0)
  const [questionHistory, setQuestionHistory] = useState<Record<string, QuestionAttempt>>({})
  const [showSkipOption, setShowSkipOption] = useState(false)
  const [userStats, setUserStats] = useState<UserStats>({
    level: 1,
    xp: 0,
    xp_to_next_level: 100,
    accuracy: 0,
    stamina: 0
  })
  const [showSolution, setShowSolution] = useState(false)
  const [canProgress, setCanProgress] = useState(false)
  const [startTime, setStartTime] = useState<number | null>(null)

  // Memoized calculations for adaptive difficulty
  const accuracyByDifficulty = useMemo(() => {
    const accuracy: Record<number, { correct: number; total: number; accuracy: number }> = {}
    
    Object.entries(questionHistory).forEach(([questionId, attempt]) => {
      const question = questions.find(q => q.id === questionId)
      if (question) {
        const difficulty = question.difficulty
        if (!accuracy[difficulty]) {
          accuracy[difficulty] = { correct: 0, total: 0, accuracy: 0 }
        }
        accuracy[difficulty].total++
        if (attempt.last_correct) {
          accuracy[difficulty].correct++
        }
      }
    })

    // Calculate accuracy percentages
    Object.keys(accuracy).forEach(difficulty => {
      const diff = parseInt(difficulty)
      const stats = accuracy[diff]
      stats.accuracy = stats.total > 0 ? stats.correct / stats.total : 0
    })

    return accuracy
  }, [questionHistory, questions])

  const optimalDifficultyRange = useMemo(() => {
    const difficulties = Object.keys(accuracyByDifficulty).map(d => parseInt(d)).sort((a, b) => a - b)
    
    if (difficulties.length === 0) {
      return { min: 3, max: 7, target: 5 }
    }

    // Find the difficulty level where user has ~70% accuracy (optimal learning zone)
    let targetDifficulty = 5 // default
    for (const diff of difficulties) {
      const accuracy = accuracyByDifficulty[diff].accuracy
      if (accuracy >= 0.6 && accuracy <= 0.8) {
        targetDifficulty = diff
        break
      }
    }

    // If user is doing well (>80% accuracy), increase difficulty
    if (accuracyByDifficulty[targetDifficulty]?.accuracy > 0.8) {
      targetDifficulty = Math.min(targetDifficulty + 1, 10)
    }
    // If user is struggling (<60% accuracy), decrease difficulty
    else if (accuracyByDifficulty[targetDifficulty]?.accuracy < 0.6) {
      targetDifficulty = Math.max(targetDifficulty - 1, 1)
    }

    const range = 2 // Allow questions within ±2 difficulty levels
    return {
      min: Math.max(1, targetDifficulty - range),
      max: Math.min(10, targetDifficulty + range),
      target: targetDifficulty
    }
  }, [accuracyByDifficulty])

  // Spaced repetition calculation
  const calculateSpacedRepetitionScore = useCallback((questionId: string) => {
    const attempt = questionHistory[questionId]
    if (!attempt) return 1.0 // New question, high priority

    const daysSinceLastAttempt = (Date.now() - new Date(attempt.last_attempt).getTime()) / (1000 * 60 * 60 * 24)
    
    // Spaced repetition algorithm: longer intervals for correctly answered questions
    if (attempt.last_correct) {
      // If correct, show less frequently (every 7-30 days depending on attempts)
      const interval = Math.min(30, 7 * Math.pow(1.5, attempt.attempts - 1))
      return Math.max(0.1, 1 - (daysSinceLastAttempt / interval))
    } else {
      // If incorrect, show more frequently (every 1-3 days)
      const interval = Math.max(1, 3 - attempt.attempts)
      return Math.max(0.5, 1 - (daysSinceLastAttempt / interval))
    }
  }, [questionHistory])

  // Adaptive question selection
  const selectAdaptiveQuestions = useCallback(async (allQuestions: Question[], targetCount: number = 10) => {
    const { min: minDifficulty, max: maxDifficulty, target: targetDifficulty } = optimalDifficultyRange

    // Filter questions by difficulty range
    const difficultyFiltered = allQuestions.filter(q => 
      q.difficulty >= minDifficulty && q.difficulty <= maxDifficulty
    )

    if (difficultyFiltered.length === 0) {
      // Fallback to all questions if no questions in difficulty range
      return allQuestions.slice(0, targetCount)
    }

    // Calculate scores for questions
    const questionsWithScores = difficultyFiltered.map(q => ({
      ...q,
      spacedRepetitionScore: calculateSpacedRepetitionScore(q.id),
      difficultyWeight: 1 - Math.abs(q.difficulty - targetDifficulty) / 10,
      reviewWeight: questionHistory[q.id] ? 0.8 : 1.0
    }))

    // Calculate final selection score
    const questionsWithFinalScores = questionsWithScores.map(q => ({
      ...q,
      finalScore: q.spacedRepetitionScore * q.difficultyWeight * q.reviewWeight
    }))

    // Sort by final score (higher is better)
    questionsWithFinalScores.sort((a, b) => b.finalScore - a.finalScore)

    // Select top questions and randomize their order
    const selectedQuestions = questionsWithFinalScores.slice(0, targetCount)
    
    // Fisher-Yates shuffle for randomization
    for (let i = selectedQuestions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[selectedQuestions[i], selectedQuestions[j]] = [selectedQuestions[j], selectedQuestions[i]]
    }

    return selectedQuestions
  }, [optimalDifficultyRange, calculateSpacedRepetitionScore, questionHistory])

  // Load initial data
  useEffect(() => {
    fetchUserStats()
    fetchQuestions()
  }, [])

  const fetchUserStats = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const { data, error } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', session.user.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user stats:', error)
        return
      }

      setUserStats(data || {
        level: 1,
        xp: 0,
        xp_to_next_level: 100,
        accuracy: 0,
        stamina: 0
      })
    } catch (error) {
      console.error('Error in fetchUserStats:', error)
    }
  }

  const fetchQuestions = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get user's selected topics from localStorage or URL params
      const selectedDivision = localStorage.getItem('selectedDivision') || 'Algebra'
      const selectedTopics = JSON.parse(localStorage.getItem('selectedTopics') || '[]')

      let query = supabase
        .from('questions')
        .select('id, question_text, options, answer, division, topic, difficulty, level, xp_reward, accuracy_bonus, stamina_bonus')
        .eq('division', selectedDivision)

      if (selectedTopics.length > 0) {
        query = query.in('topic', selectedTopics)
      }

      const { data: allQuestionsData, error: questionsError } = await query.limit(100).order('id')

      if (questionsError) {
        console.error('Error fetching questions:', questionsError)
        throw questionsError
      }

      await fetchQuestionHistory()

      if (!allQuestionsData || allQuestionsData.length === 0) {
        setError('No questions available for the selected topics')
        return
      }

      // Use adaptive question selection
      const selectedQuestions = await selectAdaptiveQuestions(allQuestionsData, 10)

      const questionsWithHistory = selectedQuestions.map(q => ({
        ...q,
        completed: questionHistory[q.id]?.last_correct || false,
        correct: questionHistory[q.id]?.last_correct || false
      }))

      setQuestions(questionsWithHistory)
      setCurrentQuestion(0)
      setScore(0)
      setStartTime(Date.now())
      setShowSkipOption(true)
      setShowSolution(false)
      setCanProgress(false)
    } catch (error: any) {
      console.error('Error in fetchQuestions:', error)
      setError(error.message || 'Failed to fetch questions')
    } finally {
      setLoading(false)
    }
  }

  const fetchQuestionHistory = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const selectedDivision = localStorage.getItem('selectedDivision') || 'Algebra'
      const selectedTopics = JSON.parse(localStorage.getItem('selectedTopics') || '[]')

      let query = supabase
        .from('practice_attempts')
        .select('question_id, user_answer, is_correct, created_at')
        .eq('user_id', session.user.id)
        .eq('division', selectedDivision)

      if (selectedTopics.length > 0) {
        query = query.in('topic', selectedTopics)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching question history:', error)
        return
      }

      const history: Record<string, QuestionAttempt> = {}
      data?.forEach(attempt => {
        if (!history[attempt.question_id]) {
          history[attempt.question_id] = {
            attempts: 0,
            last_attempt: '',
            last_correct: false,
            user_answers: [],
            is_completed: false,
            gave_up: false
          }
        }
        history[attempt.question_id].attempts++
        history[attempt.question_id].last_attempt = attempt.created_at
        history[attempt.question_id].last_correct = attempt.is_correct
        history[attempt.question_id].user_answers.push(attempt.user_answer)
        history[attempt.question_id].is_completed = attempt.is_correct
      })

      setQuestionHistory(history)
    } catch (error) {
      console.error('Error in fetchQuestionHistory:', error)
    }
  }

  const calculateXPForNextLevel = (currentLevel: number) => {
    return Math.floor(100 * Math.pow(1.5, currentLevel - 1))
  }

  const handleAnswer = async (answer: string) => {
    if (!startTime) return

    const currentQuestionData = questions[currentQuestion]
    const isCorrect = answer === currentQuestionData.answer
    const currentAttempts = questionHistory[currentQuestionData.id]?.attempts || 0
    const newAttempts = currentAttempts + 1
    
    // Calculate XP and bonuses
    let xpGained = currentQuestionData.xp_reward || 10
    if (isCorrect) {
      xpGained += currentQuestionData.accuracy_bonus || 0
      if (answerStreak > 0) {
        xpGained += currentQuestionData.stamina_bonus || 0
      }
      setScore(prev => prev + 1)
    }

    // Update answer streak
    if (isCorrect) {
      setAnswerStreak(prev => {
        const newStreak = prev + 1
        setBestAnswerStreak(current => Math.max(current, newStreak))
        return newStreak
      })
    } else {
      setAnswerStreak(0)
    }

    // Update user stats
    const newXP = userStats.xp + xpGained
    const newLevel = userStats.level
    const xpForNextLevel = calculateXPForNextLevel(newLevel)

    if (newXP >= xpForNextLevel) {
      // Level up!
      setUserStats(prev => ({
        ...prev,
        level: prev.level + 1,
        xp: newXP - xpForNextLevel,
        xp_to_next_level: calculateXPForNextLevel(prev.level + 1)
      }))

      toast.success(`Level Up! You are now level ${newLevel + 1}`)
    } else {
      setUserStats(prev => ({
        ...prev,
        xp: newXP
      }))
    }
    
    // Update question history
    const currentHistory = questionHistory[currentQuestionData.id] || {
      attempts: 0,
      last_attempt: '',
      last_correct: false,
      user_answers: [],
      is_completed: false,
      gave_up: false
    }

    const updatedHistory = {
      ...currentHistory,
      attempts: newAttempts,
      last_attempt: new Date().toISOString(),
      last_correct: isCorrect,
      user_answers: [...currentHistory.user_answers, answer],
      is_completed: isCorrect || newAttempts >= 2
    }

    setQuestionHistory(prev => ({
      ...prev,
      [currentQuestionData.id]: updatedHistory
    }))

    // Show feedback and handle state
    if (isCorrect) {
      setFeedback({
        type: 'correct',
        message: `Correct! +${xpGained} XP ${answerStreak > 0 ? `(Streak: ${answerStreak + 1})` : ''}`
      })
      setShowSolution(true)
      setCanProgress(true)
      setIsAnswerSubmitted(true)
    } else if (newAttempts >= 2) {
      setFeedback({
        type: 'incorrect',
        message: `Incorrect. You've used both attempts. The correct answer is: ${currentQuestionData.answer}`
      })
      setShowSolution(true)
      setCanProgress(true)
      setIsAnswerSubmitted(true)
    } else {
      setFeedback({
        type: 'incorrect',
        message: `Incorrect. You have 1 attempt remaining.`
      })
      setUserAnswer('')
      setIsAnswerSubmitted(false) // Allow second attempt
    }
  }

  const nextQuestion = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prev => prev + 1)
      setUserAnswer('')
      setFeedback(null)
      setShowSolution(false)
      setCanProgress(false)
      setIsAnswerSubmitted(false)
    } else {
      // Session complete
      toast.success('Practice session complete!')
      router.push('/practice')
    }
  }

  const skipQuestion = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prev => prev + 1)
      setUserAnswer('')
      setFeedback(null)
      setIsAnswerSubmitted(false)
      setShowSolution(false)
      setCanProgress(false)
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-10 bg-gray-200 rounded mb-4"></div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (error) {
    return (
      <ProtectedRoute>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Error</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => router.push('/practice')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Back to Practice Hub
            </button>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (questions.length === 0) {
    return (
      <ProtectedRoute>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">No Questions Available</h1>
            <p className="text-gray-600 mb-6">Please select topics in the practice hub first.</p>
            <button
              onClick={() => router.push('/practice')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Back to Practice Hub
            </button>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  const currentQuestionData = questions[currentQuestion]

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 py-8">
        <Toaster />
        
        {/* Back Button */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/practice')}
            className="flex items-center text-blue-600 hover:text-blue-700 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Practice Hub
          </button>
        </div>

        {/* Session Info */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Adaptive Practice Session</h3>
            <div className="flex items-center space-x-4 text-sm">
              <span className="text-gray-500">Question {currentQuestion + 1} of {questions.length}</span>
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                {(() => {
                  const { min, max, target } = optimalDifficultyRange
                  return `Difficulty: ${min}-${max}`
                })()}
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{questions.length}</p>
              <p className="text-gray-500">Total Questions</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {questions.filter(q => !questionHistory[q.id]).length}
              </p>
              <p className="text-gray-500">New Questions</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">
                {questions.filter(q => questionHistory[q.id]).length}
              </p>
              <p className="text-gray-500">Review Questions</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">{score}</p>
              <p className="text-gray-500">Correct Answers</p>
            </div>
          </div>
        </div>

        {/* Question Display */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                currentQuestionData.difficulty <= 3 ? 'bg-green-100 text-green-800' :
                currentQuestionData.difficulty <= 6 ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {currentQuestionData.difficulty <= 3 ? 'Easy' :
                 currentQuestionData.difficulty <= 6 ? 'Medium' : 'Hard'}
              </span>
              {questionHistory[currentQuestionData.id] && (
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                  Review
                </span>
              )}
            </div>
            <FlagQuestion 
              questionId={currentQuestionData.id}
              questionText={currentQuestionData.question_text}
            />
          </div>

          {/* Question Content */}
          <div className="mb-6">
            <div className="prose max-w-none">
              {renderLatex(currentQuestionData.question_text)}
            </div>
          </div>

          {/* Answer Options */}
          {!isAnswerSubmitted && (
            <div className="space-y-3 mb-6">
              {currentQuestionData.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => setUserAnswer(option)}
                  className={`w-full p-4 text-left border rounded-lg transition-all duration-200 ${
                    userAnswer === option
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
              {!isAnswerSubmitted && userAnswer && (
                <button
                  onClick={() => handleAnswer(userAnswer)}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Submit Answer
                </button>
              )}
              {showSkipOption && !isAnswerSubmitted && (
                <button
                  onClick={skipQuestion}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Skip
                </button>
              )}
            </div>
            
            <div className="flex items-center space-x-3">
              {canProgress && (
                <button
                  onClick={nextQuestion}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  {currentQuestion < questions.length - 1 ? 'Next Question' : 'Finish Session'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
} 
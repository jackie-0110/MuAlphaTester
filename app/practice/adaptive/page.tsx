'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../utils/supabase'
import { ProtectedRoute } from '../../components/ProtectedRoute'
import { toast, Toaster } from 'react-hot-toast'
import FlagQuestion from '../../components/FlagQuestion'
import 'katex/dist/katex.min.css'
// @ts-ignore
import renderMathInElement from 'katex/dist/contrib/auto-render.js'
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

interface QuestionAttempt {
  attempts: number
  last_attempt: string
  last_correct: boolean
  user_answers: string[]
  is_completed: boolean
  gave_up: boolean
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
  const [userAnswer, setUserAnswer] = useState<number | null>(null)
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'correct' | 'incorrect', message: string } | null>(null)
  const [answerStreak, setAnswerStreak] = useState(0)
  const [bestAnswerStreak, setBestAnswerStreak] = useState(0)
  const [questionHistory, setQuestionHistory] = useState<Record<string, QuestionAttempt>>({})
  const [showSkipOption, setShowSkipOption] = useState(false)
  const [showSolution, setShowSolution] = useState(false)
  const [canProgress, setCanProgress] = useState(false)
  const [startTime, setStartTime] = useState<number | null>(null)
  
  // Topic selection state
  const [divisions, setDivisions] = useState<string[]>([])
  const [topics, setTopics] = useState<string[]>([])
  const [selectedDivision, setSelectedDivision] = useState<string>('')
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [sessionStarted, setSessionStarted] = useState(false)
  const [loadingTopics, setLoadingTopics] = useState(false)
  const [showTopicSwitcher, setShowTopicSwitcher] = useState(false)
  
  // Adaptive progress state
  const [currentQuestionData, setCurrentQuestionData] = useState<Question | null>(null)
  const [topicProgress, setTopicProgress] = useState<Record<string, { questionIndex: number, totalQuestions: number }>>({})

  // Save adaptive progress to Supabase
  const saveTopicProgress = async (topic: string, questionIndex: number, totalQuestions: number) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const { error } = await supabase
        .from('adaptive_topic_progress')
        .upsert({
          user_id: session.user.id,
          topic,
          division: selectedDivision,
          progress: {
            questionIndex,
            totalQuestions,
            lastUpdated: new Date().toISOString()
          }
        })

      if (error) throw error
    } catch (error) {
      console.error('Error saving topic progress:', error)
    }
  }

  // Load adaptive progress from Supabase
  const loadTopicProgress = async (topic: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return null

      const { data, error } = await supabase
        .from('adaptive_topic_progress')
        .select('progress')
        .eq('user_id', session.user.id)
        .eq('topic', topic)
        .eq('division', selectedDivision)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading topic progress:', error)
        return null
      }

      return data?.progress || null
    } catch (error) {
      console.error('Error in loadTopicProgress:', error)
      return null
    }
  }

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

  // Load initial data
  useEffect(() => {
    fetchDivisions()
  }, [])

  // Load topics when division changes
  useEffect(() => {
    if (selectedDivision) {
      fetchTopics(selectedDivision)
    } else {
      setTopics([])
      setSelectedTopics([])
    }
  }, [selectedDivision])

  const fetchDivisions = async () => {
    try {
      const { data, error } = await supabase
        .from('questions')
        .select('division')
        .order('division')

      if (error) throw error

      const uniqueDivisions = [...new Set(data?.map(q => q.division) || [])]
      setDivisions(uniqueDivisions)
    } catch (error) {
      console.error('Error fetching divisions:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTopics = async (division: string) => {
    try {
      setLoadingTopics(true)
      const { data, error } = await supabase
        .from('questions')
        .select('topic')
        .eq('division', division)
        .order('topic')

      if (error) throw error

      const uniqueTopics = [...new Set(data?.map(q => q.topic) || [])]
      setTopics(uniqueTopics)
    } catch (error) {
      console.error('Error fetching topics:', error)
    } finally {
      setLoadingTopics(false)
    }
  }

  const startSession = async () => {
    if (!selectedDivision || selectedTopics.length === 0) {
      toast.error('Please select a division and at least one topic')
      return
    }

    setLoading(true)
    
    // Load saved progress for the selected topic
    const savedProgress = await loadTopicProgress(selectedTopics[0])
    if (savedProgress) {
      setTopicProgress(prev => ({
        ...prev,
        [selectedTopics[0]]: {
          questionIndex: savedProgress.questionIndex,
          totalQuestions: savedProgress.totalQuestions
        }
      }))
    }
    
    // Fetch question history first for adaptive selection
    await fetchQuestionHistory()
    
    // Load the first question
    await loadNextQuestion()
    
    setSessionStarted(true)
    setStartTime(Date.now())
    setLoading(false)
  }

  const loadNextQuestion = async () => {
    try {
      // Reset answer state for new question
      setUserAnswer(null)
      setIsAnswerSubmitted(false)
      setFeedback(null)
      setShowSolution(false)
      setCanProgress(false)
      setLoading(true)
      console.log('Loading next question for division:', selectedDivision, 'topic:', selectedTopics[0])
      
      // Get all available questions for the topic
      let query = supabase
        .from('questions')
        .select('id, question_text, options, answer, division, topic, difficulty')
        .eq('division', selectedDivision)
        .eq('topic', selectedTopics[0])

      console.log('Executing query...')
      const { data: allQuestions, error } = await query
      console.log('Query result:', { data: allQuestions, error })
      
      if (error) throw error

      if (!allQuestions || allQuestions.length === 0) {
        console.log('No questions found for division:', selectedDivision, 'topic:', selectedTopics[0])
        setError('No questions available for the selected topic')
        return
      }

      console.log('Found', allQuestions.length, 'questions')

      // Get current progress for this topic
      const currentProgress = topicProgress[selectedTopics[0]] || { questionIndex: 0, totalQuestions: allQuestions.length }
      
      // Simple adaptive selection: prioritize questions not recently attempted
      const now = Date.now()
      const oneDay = 24 * 60 * 60 * 1000 // 24 hours in milliseconds
      
      const questionsWithScores = allQuestions.map(q => {
        const history = questionHistory[q.id]
        let score = 1.0
        
        if (history) {
          const daysSinceLastAttempt = (now - new Date(history.last_attempt).getTime()) / oneDay
          
          if (history.last_correct) {
            // If correct, show less frequently (every 7-30 days)
            const interval = Math.min(30, 7 * Math.pow(1.5, history.attempts - 1))
            score = Math.max(0.1, 1 - (daysSinceLastAttempt / interval))
          } else {
            // If incorrect, show more frequently (every 1-3 days)
            const interval = Math.max(1, 3 - history.attempts)
            score = Math.max(0.5, 1 - (daysSinceLastAttempt / interval))
          }
        }
        
        return { ...q, score }
      })
      
      // Sort by score (higher is better) and pick the first one
      questionsWithScores.sort((a, b) => b.score - a.score)
      const selectedQuestion = questionsWithScores[0]
      
      if (selectedQuestion) {
        setCurrentQuestionData(selectedQuestion)
        
        // Update progress
        const newProgress = {
          questionIndex: currentProgress.questionIndex + 1,
          totalQuestions: allQuestions.length
        }
        
        setTopicProgress(prev => ({
          ...prev,
          [selectedTopics[0]]: newProgress
        }))
        
        // Save progress to Supabase
        await saveTopicProgress(selectedTopics[0], newProgress.questionIndex, newProgress.totalQuestions)
      } else {
        setError('No suitable questions found')
      }
    } catch (error) {
      console.error('Error loading next question:', error)
      setError('Failed to load question')
    } finally {
      setLoading(false)
    }
  }

  const switchTopic = async (newTopic: string) => {
    if (newTopic === selectedTopics[0]) return // Same topic, no change needed
    
    setLoading(true)
    setSelectedTopics([newTopic])
    
    // Load saved progress for the new topic
    const savedProgress = await loadTopicProgress(newTopic)
    if (savedProgress) {
      setTopicProgress(prev => ({
        ...prev,
        [newTopic]: {
          questionIndex: savedProgress.questionIndex,
          totalQuestions: savedProgress.totalQuestions
        }
      }))
    }
    
    // Load the first question for the new topic
    await loadNextQuestion()
    
    // Reset session state for new topic
    setScore(0)
    setUserAnswer(null)
    setFeedback(null)
    setShowSolution(false)
    setCanProgress(false)
    setIsAnswerSubmitted(false)
    setAnswerStreak(0)
    setStartTime(Date.now())
    
    setShowTopicSwitcher(false)
    setLoading(false)
    toast.success(`Switched to ${newTopic}`)
  }

  const fetchQuestionHistory = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      let query = supabase
        .from('question_attempts')
        .select('question_id, user_answers, is_correct, created_at')
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
        
        // Handle user_answers as jsonb
        if (attempt.user_answers) {
          if (Array.isArray(attempt.user_answers)) {
            history[attempt.question_id].user_answers.push(...attempt.user_answers.map(String))
          } else if (typeof attempt.user_answers === 'object') {
            const answers = Object.values(attempt.user_answers).map(String)
            history[attempt.question_id].user_answers.push(...answers)
          } else {
            history[attempt.question_id].user_answers.push(String(attempt.user_answers))
          }
        }
        
        history[attempt.question_id].is_completed = attempt.is_correct
      })

      setQuestionHistory(history)
    } catch (error) {
      console.error('Error in fetchQuestionHistory:', error)
    }
  }

  const handleAnswer = async () => {
    if (!startTime || !currentQuestionData) return

    // Ensure answer is a number (index)
    const correctIndex = typeof currentQuestionData.answer === 'number' ? currentQuestionData.answer : parseInt(currentQuestionData.answer, 10)
    const isCorrect = userAnswer === correctIndex
    const currentAttempts = questionHistory[currentQuestionData.id]?.attempts || 0
    const newAttempts = currentAttempts + 1
    
    // Log the attempt to Supabase
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await logQuestionAttempt({
          userId: session.user.id,
          questionId: currentQuestionData.id,
          division: currentQuestionData.division,
          topic: currentQuestionData.topic,
          attempts: newAttempts,
          gaveUp: false,
          userAnswers: [String(userAnswer)],
          isCorrect,
        });
      }
    } catch (err) {
      console.error('Failed to log question attempt:', err);
    }
    
    // Calculate XP and bonuses
    let xpGained = 10
    if (isCorrect) {
      xpGained += 0
      if (answerStreak > 0) {
        xpGained += 0
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
      user_answers: [...currentHistory.user_answers, String(userAnswer)],
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
        message: `Incorrect. You've used both attempts. The correct answer is: ${currentQuestionData.options[correctIndex]}`
      })
      setShowSolution(true)
      setCanProgress(true)
      setIsAnswerSubmitted(true)
    } else {
      setFeedback({
        type: 'incorrect',
        message: `Incorrect. You have 1 attempt remaining.`
      })
      setUserAnswer(null)
      setIsAnswerSubmitted(false) // Allow second attempt
    }
  }

  const nextQuestion = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prev => prev + 1)
      setUserAnswer(null)
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
      setUserAnswer(null)
      setFeedback(null)
      setIsAnswerSubmitted(false)
      setShowSolution(false)
      setCanProgress(false)
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading adaptive practice...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (error) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Questions</h3>
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

  // Show topic selection UI if session hasn't started
  if (!sessionStarted) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50">
          {/* Header */}
          <div className="bg-white shadow-sm border-b border-gray-200">
            <div className="container mx-auto px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => router.push('/practice')}
                    className="flex items-center text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to Practice Hub
                  </button>
                  <h1 className="text-2xl font-bold text-gray-900">Adaptive Practice Setup</h1>
                </div>
              </div>
            </div>
          </div>

          <div className="container mx-auto px-4 py-6">
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Topics for Adaptive Practice</h2>
                
                {/* Division Selection */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Division
                  </label>
                  <select
                    value={selectedDivision}
                    onChange={(e) => {
                      setSelectedDivision(e.target.value)
                      setSelectedTopics([])
                    }}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    <option value="">Select a division</option>
                    {divisions.map((division) => (
                      <option key={division} value={division}>
                        {division}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Topic Selection */}
                {selectedDivision && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Topics (Select one for adaptive practice)
                    </label>
                    {loadingTopics ? (
                      <div className="flex items-center justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        <span className="ml-2 text-gray-600">Loading topics...</span>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {topics.map((topic) => (
                          <label key={topic} className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="radio"
                              name="topic"
                              checked={selectedTopics.includes(topic)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedTopics([topic]) // Only allow one topic for adaptive
                                }
                              }}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">{topic}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    <p className="text-sm text-gray-500 mt-2">
                      {selectedTopics.length} topic(s) selected
                    </p>
                  </div>
                )}

                {/* Start Session Button */}
                <div className="flex justify-end">
                  <button
                    onClick={startSession}
                    disabled={!selectedDivision || selectedTopics.length === 0}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    Start Adaptive Session
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Toaster />
        
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => router.push('/practice')}
                  className="flex items-center text-blue-600 hover:text-blue-700 transition-colors"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to Practice Hub
                </button>
                <h1 className="text-2xl font-bold text-gray-900">Adaptive Practice</h1>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowTopicSwitcher(true)}
                  className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                >
                  Switch Topic
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-6">
          <div className="flex gap-6">
            {/* Sidebar */}
            <div className="w-80 flex-shrink-0">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Session Info</h2>
                
                {/* Session Stats */}
                <div className="space-y-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">{score}</p>
                    <p className="text-sm text-gray-600">Correct Answers</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-lg font-bold text-gray-900">{topicProgress[selectedTopics[0]]?.totalQuestions || 0}</p>
                      <p className="text-gray-500">Total</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-lg font-bold text-green-600">
                        {currentQuestionData && !questionHistory[currentQuestionData.id] ? 1 : 0}
                      </p>
                      <p className="text-gray-500">New</p>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <p className="text-lg font-bold text-blue-600">
                        {currentQuestionData && questionHistory[currentQuestionData.id] ? 1 : 0}
                      </p>
                      <p className="text-gray-500">Review</p>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <p className="text-lg font-bold text-purple-600">
                        {topicProgress[selectedTopics[0]]?.totalQuestions ? Math.round((score / topicProgress[selectedTopics[0]].totalQuestions) * 100) : 0}%
                      </p>
                      <p className="text-gray-500">Accuracy</p>
                    </div>
                  </div>
                  
                  {/* Difficulty Range */}
                  <div className="p-3 bg-green-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-700 mb-1">Difficulty Range</p>
                    <p className="text-lg font-bold text-green-600">
                      {(() => {
                        const { min, max } = optimalDifficultyRange
                        return `${min}-${max}`
                      })()}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1">
              {/* Question Display */}
              {currentQuestionData && (
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
                      {canProgress && (
                        <button
                          onClick={loadNextQuestion}
                          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                        >
                          Next Question
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Topic Switcher Modal */}
        {showTopicSwitcher && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Switch Topic</h3>
                <button
                  onClick={() => setShowTopicSwitcher(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <p className="text-sm text-gray-600 mb-4">
                Current topic: <span className="font-medium">{selectedTopics[0]}</span>
              </p>
              
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {topics.map((topic) => (
                  <button
                    key={topic}
                    onClick={() => switchTopic(topic)}
                    className={`w-full p-3 text-left rounded-lg border transition-colors ${
                      topic === selectedTopics[0]
                        ? 'bg-blue-50 border-blue-200 text-blue-700 cursor-not-allowed'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{topic}</span>
                      {topic === selectedTopics[0] && (
                        <span className="text-blue-600 text-sm">Current</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setShowTopicSwitcher(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}
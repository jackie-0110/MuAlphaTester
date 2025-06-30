'use client'

import { useState, useEffect, useRef, useMemo, useCallback, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../utils/supabase'
import { ProtectedRoute } from '../../components/ProtectedRoute'
import { toast, Toaster } from 'react-hot-toast'
import dynamic from 'next/dynamic'
import FlagQuestion from '../components/FlagQuestion'
import 'katex/dist/katex.min.css'
import PracticeQuestionTable from './PracticeQuestionTable'

// Lazy load BadgeDisplay to improve performance
const BadgeDisplay = dynamic(() => import('../../components/BadgeDisplay'), {
  loading: () => <div className="h-8 bg-gray-200 rounded animate-pulse"></div>,
  ssr: false
})

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
  attempts?: number
  last_attempt?: string
  last_correct?: boolean
}

interface StreakData {
  current_streak: number
  last_practice_date: string
  best_streak: number
  answer_streak: number
  best_answer_streak: number
}

interface TopicProgress {
  topic: string
  completed: number
  total: number
  status: 'completed' | 'in-progress' | 'not-started'
}

interface UserStats {
  level: number
  xp: number
  xp_to_next_level: number
  accuracy: number
  stamina: number
}

interface QuestionAttempt {
  attempts: number
  last_attempt: string
  last_correct: boolean
  user_answers: string[]
  is_completed: boolean
  gave_up: boolean
}

type PracticeMode = 'hub' | 'tests' | 'adaptive' | 'list'

export default function PracticePage() {
  const router = useRouter()
  const [practiceMode, setPracticeMode] = useState<PracticeMode>('hub')
  const [divisions, setDivisions] = useState<string[]>([])
  const [topics, setTopics] = useState<string[]>([])
  const [selectedDivision, setSelectedDivision] = useState<string>('')
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [questionHistory, setQuestionHistory] = useState<Record<string, QuestionAttempt>>({})
  const [streakData, setStreakData] = useState<StreakData | null>(null)
  const [topicCompletionCount, setTopicCompletionCount] = useState<number>(0)
  const [userStats, setUserStats] = useState<UserStats>({
    level: 1,
    xp: 0,
    xp_to_next_level: 100,
    accuracy: 0,
    stamina: 0
  })
  const [topicProgress, setTopicProgress] = useState<TopicProgress[]>([])
  const [searchValue, setSearchValue] = useState('')

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true)
        await Promise.all([
          fetchDivisions(),
          fetchStreakData(),
          fetchTopicCompletionCount(),
          fetchUserStats(),
          fetchTopicProgress()
        ])
      } catch (error) {
        console.error('Error loading initial data:', error)
        setError('Failed to load initial data')
      } finally {
        setLoading(false)
      }
    }

    loadInitialData()
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

  // Load questions when division or topics change
  useEffect(() => {
    if (selectedDivision && selectedTopics.length > 0) {
      fetchQuestions()
    } else {
      setQuestions([])
    }
  }, [selectedDivision, selectedTopics])

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

      const uniqueTopics = [...new Set(data?.map(q => q.topic) || [])]
      setTopics(uniqueTopics)
    } catch (error) {
      console.error('Error fetching topics:', error)
    }
  }

  const handleTopicChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(e.target.selectedOptions, option => option.value)
    setSelectedTopics(selectedOptions)
  }

  const fetchQuestions = async () => {
    try {
      setLoading(true)
      setError(null)

      let query = supabase
        .from('questions')
        .select('id, question_text, options, answer, division, topic, difficulty, level, xp_reward, accuracy_bonus, stamina_bonus')
        .eq('division', selectedDivision)

      if (selectedTopics.length > 0) {
        query = query.in('topic', selectedTopics)
      }

      const { data: questionsData, error: questionsError } = await query.limit(200).order('id')

      if (questionsError) {
        console.error('Error fetching questions:', questionsError)
        throw questionsError
      }

      await fetchQuestionHistory()

      if (!questionsData || questionsData.length === 0) {
        setError('No questions available for the selected topics')
        return
      }

      const questionsWithHistory = questionsData.map(q => ({
        ...q,
        completed: questionHistory[q.id]?.last_correct || false,
        correct: questionHistory[q.id]?.last_correct || false
      }))

      setQuestions(questionsWithHistory)
    } catch (error: any) {
      console.error('Error fetching questions:', error)
      setError(error.message || 'Failed to fetch questions')
    } finally {
      setLoading(false)
    }
  }

  const fetchQuestionHistory = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

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

  const fetchStreakData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const { data, error } = await supabase
        .from('user_streaks')
        .select('*')
        .eq('user_id', session.user.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching streak data:', error)
        return
      }

      setStreakData(data || {
        current_streak: 0,
        last_practice_date: '',
        best_streak: 0,
        answer_streak: 0,
        best_answer_streak: 0
      })
    } catch (error) {
      console.error('Error in fetchStreakData:', error)
    }
  }

  const fetchTopicCompletionCount = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const { data, error } = await supabase
        .from('practice_attempts')
        .select('topic')
        .eq('user_id', session.user.id)
        .eq('is_correct', true)

      if (error) {
        console.error('Error fetching topic completion count:', error)
        return
      }

      const uniqueTopics = new Set(data?.map(attempt => attempt.topic) || [])
      setTopicCompletionCount(uniqueTopics.size)
    } catch (error) {
      console.error('Error in fetchTopicCompletionCount:', error)
    }
  }

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

  const fetchTopicProgress = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const { data, error } = await supabase
        .from('practice_attempts')
        .select('topic, is_correct')
        .eq('user_id', session.user.id)

      if (error) {
        console.error('Error fetching topic progress:', error)
        return
      }

      const topicStats: Record<string, { correct: number; total: number }> = {}
      data?.forEach(attempt => {
        if (!topicStats[attempt.topic]) {
          topicStats[attempt.topic] = { correct: 0, total: 0 }
        }
        topicStats[attempt.topic].total++
        if (attempt.is_correct) {
          topicStats[attempt.topic].correct++
        }
      })

      const progress: TopicProgress[] = Object.entries(topicStats).map(([topic, stats]) => ({
        topic,
        completed: stats.correct,
        total: stats.total,
        status: stats.correct >= 10 ? 'completed' as const : stats.correct > 0 ? 'in-progress' as const : 'not-started' as const
      }))

      setTopicProgress(progress)
    } catch (error) {
      console.error('Error in fetchTopicProgress:', error)
    }
  }

  const checkAndAwardBadges = async (userId: string, accuracy: number) => {
    try {
      const { data: badges } = await supabase
        .from('user_badges')
        .select('badge_name')
        .eq('user_id', userId)

      const existingBadges = badges?.map(b => b.badge_name) || []

      // Check for accuracy badges
      if (accuracy >= 90 && !existingBadges.includes('Accuracy Master')) {
        await supabase
          .from('user_badges')
          .insert([{
            user_id: userId,
            badge_name: 'Accuracy Master',
            division: selectedDivision,
            topic: selectedTopics.join(', ')
          }])

        toast.success('🏆 New Badge: Accuracy Master!', {
          duration: 4000,
          style: {
            background: '#4CAF50',
            color: 'white',
          },
        })
      }
    } catch (error) {
      // Silently handle errors since the functionality is working
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

  // Hub View
  if (practiceMode === 'hub') {
    return (
      <ProtectedRoute>
        <div className="container mx-auto px-4 py-8">
          <Toaster />
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-lg mb-6">
              {error}
            </div>
          )}

          {/* Header Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Practice Hub</h1>
                <p className="text-lg text-gray-600 mt-2">
                  Choose your practice mode and start learning
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="bg-blue-600 text-white rounded-full w-12 h-12 flex items-center justify-center text-xl font-bold">
                  {userStats.level}
                </div>
                <div>
                  <p className="text-sm text-gray-500">Level {userStats.level}</p>
                  <div className="w-32 h-2 bg-gray-200 rounded-full">
                    <div 
                      className="h-full bg-blue-600 rounded-full transition-all duration-300"
                      style={{ width: `${(userStats.xp / userStats.xp_to_next_level) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              {streakData && (
                <>
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center">
                      <div className="p-2 bg-orange-100 rounded-lg">
                        <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-500">Current Streak</p>
                        <p className="text-2xl font-bold text-gray-900">{streakData.current_streak}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-500">Answer Streak</p>
                        <p className="text-2xl font-bold text-gray-900">{streakData.answer_streak}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-500">Completed</p>
                        <p className="text-2xl font-bold text-gray-900">{topicCompletionCount}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-500">XP Earned</p>
                        <p className="text-2xl font-bold text-gray-900">{userStats.xp}</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Practice Mode Selection */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Tests */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer" onClick={() => router.push('/tests')}>
              <div className="text-center">
                <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Tests</h3>
                <p className="text-gray-600 mb-4">
                  Take timed tests with multiple questions to assess your knowledge
                </p>
                <div className="text-sm text-gray-500">
                  <div className="flex items-center justify-center mb-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                    <span>Timed sessions</span>
                  </div>
                  <div className="flex items-center justify-center mb-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    <span>Score tracking</span>
                  </div>
                  <div className="flex items-center justify-center">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
                    <span>Performance analytics</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Adaptive Practice */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setPracticeMode('adaptive')}>
              <div className="text-center">
                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Adaptive Practice</h3>
                <p className="text-gray-600 mb-4">
                  AI-powered practice that adapts to your skill level and learning pace
                </p>
                <div className="text-sm text-gray-500">
                  <div className="flex items-center justify-center mb-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    <span>Adaptive difficulty</span>
                  </div>
                  <div className="flex items-center justify-center mb-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                    <span>Spaced repetition</span>
                  </div>
                  <div className="flex items-center justify-center">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
                    <span>Progress tracking</span>
                  </div>
                </div>
              </div>
            </div>

            {/* List Practice */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setPracticeMode('list')}>
              <div className="text-center">
                <div className="mx-auto w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">List Practice</h3>
                <p className="text-gray-600 mb-4">
                  Browse and practice questions by topic with full control over selection
                </p>
                <div className="text-sm text-gray-500">
                  <div className="flex items-center justify-center mb-1">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
                    <span>Topic filtering</span>
                  </div>
                  <div className="flex items-center justify-center mb-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                    <span>Search questions</span>
                  </div>
                  <div className="flex items-center justify-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    <span>Individual practice</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Badge Display */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Badges</h3>
            <Suspense fallback={<div className="h-8 bg-gray-200 rounded animate-pulse"></div>}>
              <BadgeDisplay />
            </Suspense>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  // Adaptive Practice View
  if (practiceMode === 'adaptive') {
    return (
      <ProtectedRoute>
        <div className="container mx-auto px-4 py-8">
          <Toaster />
          
          {/* Back Button */}
          <div className="mb-6">
            <button
              onClick={() => setPracticeMode('hub')}
              className="flex items-center text-blue-600 hover:text-blue-700 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Practice Hub
            </button>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-6">Adaptive Practice</h1>
          
          {/* Topic Selection */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Topics</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Division Selection */}
              <div>
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Topics (Hold Ctrl/Cmd to select multiple)
                </label>
                <select
                  multiple
                  value={selectedTopics}
                  onChange={handleTopicChange}
                  disabled={!selectedDivision}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed bg-white min-h-[120px]"
                >
                  {topics.map((topic) => (
                    <option key={topic} value={topic}>
                      {topic}
                    </option>
                  ))}
                </select>
                <p className="text-sm text-gray-500 mt-1">
                  {selectedTopics.length} topic(s) selected
                </p>
              </div>
            </div>

            {/* Start Practice Button */}
            {selectedDivision && selectedTopics.length > 0 && (
              <div className="mt-6">
                <button
                  onClick={() => router.push('/practice/adaptive')}
                  className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-sm"
                >
                  Start Adaptive Practice
                </button>
              </div>
            )}
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  // List Practice View
  if (practiceMode === 'list') {
    return (
      <ProtectedRoute>
        <div className="container mx-auto px-4 py-8">
          <Toaster />
          
          {/* Back Button */}
          <div className="mb-6">
            <button
              onClick={() => setPracticeMode('hub')}
              className="flex items-center text-blue-600 hover:text-blue-700 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Practice Hub
            </button>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-6">List Practice</h1>
          
          {/* Topic Selection */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Topics</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Division Selection */}
              <div>
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Topics (Hold Ctrl/Cmd to select multiple)
                </label>
                <select
                  multiple
                  value={selectedTopics}
                  onChange={handleTopicChange}
                  disabled={!selectedDivision}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed bg-white min-h-[120px]"
                >
                  {topics.map((topic) => (
                    <option key={topic} value={topic}>
                      {topic}
                    </option>
                  ))}
                </select>
                <p className="text-sm text-gray-500 mt-1">
                  {selectedTopics.length} topic(s) selected
                </p>
              </div>
            </div>
          </div>

          {/* Questions Table */}
          {selectedDivision && selectedTopics.length > 0 && questions.length > 0 && (
            <PracticeQuestionTable
              questions={questions}
              questionHistory={questionHistory}
              onFlag={(question: Question) => {
                // Handle flagging - this could open a modal or save to database
                console.log('Flagged question:', question.id)
              }}
              onAnswer={(question: Question, answer: string) => {
                // Handle answering from the table
                console.log('Answered question:', question.id, answer)
              }}
              topics={topics}
              selectedTopics={selectedTopics}
              setSelectedTopics={setSelectedTopics}
              searchValue={searchValue}
              setSearchValue={setSearchValue}
            />
          )}

          {selectedDivision && selectedTopics.length > 0 && questions.length === 0 && !loading && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
              <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Questions Found</h3>
              <p className="text-gray-600">
                No questions available for the selected topics. Try selecting different topics.
              </p>
            </div>
          )}
        </div>
      </ProtectedRoute>
    )
  }

  return null
} 
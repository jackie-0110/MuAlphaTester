'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Toaster, toast } from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import BadgeDisplay from '@/components/BadgeDisplay'
import { Suspense } from 'react'

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

type PracticeMode = 'hub' | 'tests' | 'adaptive'

export default function PracticePage() {
  const router = useRouter()
  const [practiceMode, setPracticeMode] = useState<PracticeMode>('hub')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true)
        
        await Promise.all([
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

      if (data) {
        setStreakData(data)
      } else {
        // Initialize streak data if it doesn't exist
        const { data: newStreak, error: insertError } = await supabase
          .from('user_streaks')
          .insert([{
            user_id: session.user.id,
            current_streak: 0,
            last_practice_date: null,
            best_streak: 0,
            answer_streak: 0,
            best_answer_streak: 0
          }])
          .select()
          .single()

        if (insertError) {
          console.error('Error creating streak data:', insertError)
          return
        }

        setStreakData(newStreak)
      }
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
        .select('question_id')
        .eq('user_id', session.user.id)
        .eq('is_correct', true)

      if (error) {
        console.error('Error fetching topic completion count:', error)
        return
      }

      const uniqueQuestions = new Set(data?.map(attempt => attempt.question_id))
      setTopicCompletionCount(uniqueQuestions.size)
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

      if (data) {
        setUserStats(data)
      } else {
        // Initialize user stats if they don't exist
        const { data: newStats, error: insertError } = await supabase
          .from('user_stats')
          .insert([{
            user_id: session.user.id,
            level: 1,
            xp: 0,
            xp_to_next_level: 100,
            accuracy: 0,
            stamina: 0
          }])
          .select()
          .single()

        if (insertError) {
          console.error('Error creating user stats:', insertError)
          return
        }

        setUserStats(newStats)
      }
    } catch (error) {
      console.error('Error in fetchUserStats:', error)
    }
  }

  const fetchTopicProgress = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      // Get all unique topics
      const { data: topicsData, error: topicsError } = await supabase
        .from('questions')
        .select('topic')
        .order('topic')

      if (topicsError) {
        console.error('Error fetching topics:', topicsError)
        return
      }

      const uniqueTopics = [...new Set(topicsData?.map(q => q.topic) || [])]

      // Get user's progress for each topic
      const progressPromises = uniqueTopics.map(async (topic) => {
        const { data: attempts, error } = await supabase
          .from('practice_attempts')
          .select('question_id, is_correct')
          .eq('user_id', session.user.id)
          .eq('topic', topic)

        if (error) {
          console.error(`Error fetching progress for topic ${topic}:`, error)
          return { topic, completed: 0, total: 0, status: 'not-started' as const }
        }

        const correctAttempts = attempts?.filter(a => a.is_correct) || []
        const uniqueCorrectQuestions = new Set(correctAttempts.map(a => a.question_id))
        const completed = uniqueCorrectQuestions.size

        // Get total questions for this topic
        const { data: totalQuestions, error: totalError } = await supabase
          .from('questions')
          .select('id')
          .eq('topic', topic)

        if (totalError) {
          console.error(`Error fetching total questions for topic ${topic}:`, totalError)
          return { topic, completed: 0, total: 0, status: 'not-started' as const }
        }

        const total = totalQuestions?.length || 0
        let status: 'completed' | 'in-progress' | 'not-started' = 'not-started'
        
        if (completed > 0) {
          status = completed === total ? 'completed' : 'in-progress'
        }

        return { topic, completed, total, status }
      })

      const progress = await Promise.all(progressPromises)
      setTopicProgress(progress)
    } catch (error) {
      console.error('Error in fetchTopicProgress:', error)
    }
  }

  const checkAndAwardBadges = async (userId: string, accuracy: number) => {
    try {
      // Check if user already has the Accuracy Master badge
      const { data: existingBadge, error: checkError } = await supabase
        .from('user_badges')
        .select('*')
        .eq('user_id', userId)
        .eq('badge_name', 'Accuracy Master')
        .single()

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking existing badge:', checkError)
        return
      }

      // Award badge if accuracy is high enough and user doesn't already have it
      if (accuracy >= 0.8 && !existingBadge) {
        await supabase
          .from('user_badges')
          .insert([{
            user_id: userId,
            badge_name: 'Accuracy Master',
            division: '',
            topic: ''
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
                  Generate tests from different topics to assess knowledge
                </p>
                <div className="text-sm text-gray-500">
                  <div className="flex items-center justify-center mb-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                    <span>Full Control</span>
                  </div>
                  <div className="flex items-center justify-center mb-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    <span>Mimic Exam Environments</span>
                  </div>
                  <div className="flex items-center justify-center">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
                    <span>Print to PDF</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Adaptive Practice */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer" onClick={() => router.push('/practice/adaptive')}>
              <div className="text-center">
                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Adaptive Practice</h3>
                <p className="text-gray-600 mb-4">
                  Practice that adapts to your skill level and learning pace
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
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer" onClick={() => router.push('/practice/list')}>
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

  return null
} 
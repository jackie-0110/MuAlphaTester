'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../utils/supabase'
import { ProtectedRoute } from '../../components/ProtectedRoute'
import { useAuth } from '../../contexts/AuthContext'
import Badges from '@/components/Badges'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import FlagQuestion from '../components/FlagQuestion'
import 'katex/dist/katex.min.css'
// @ts-ignore
import renderMathInElement from 'katex/dist/contrib/auto-render.js'

interface UserProfile {
  id: string
  username: string
  grade_level: string
  created_at: string
  streak: number
  badges: string[]
  total_points: number
  friend_count: number
}

interface UserStats {
  total_questions_attempted: number
  correct_answers: number
  accuracy_percentage: number
  total_practice_sessions: number
  average_session_length: number
  best_streak: number
  topics_mastered: number
  total_time_spent: number
}

interface TopicProgress {
  topic: string
  questions_attempted: number
  correct_answers: number
  accuracy: number
  last_practiced: string
  mastery_level: 'beginner' | 'intermediate' | 'advanced' | 'master'
}

interface Achievement {
  id: string
  achievement_type: string
  achievement_name: string
  description: string
  points_awarded: number
  icon: string
  unlocked_at: string
}

interface Friend {
  id: string
  username: string
  grade_level: string
  total_points: number
  status: 'pending' | 'accepted'
}

interface PracticeSession {
  id: string
  session_type: string
  topic: string
  questions_attempted: number
  correct_answers: number
  accuracy: number
  duration_minutes: number
  created_at: string
}

interface QuestionLog {
  id: string
  question_id: string
  user_answer: string
  is_correct: boolean
  division: string
  topic: string
  created_at: string
  question_text?: string
  correct_answer?: string
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

export default function ProfilePage() {
  const { user } = useAuth()
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [newGradeLevel, setNewGradeLevel] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [stats, setStats] = useState<UserStats | null>(null)
  const [topicProgress, setTopicProgress] = useState<TopicProgress[]>([])
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [friends, setFriends] = useState<Friend[]>([])
  const [recentSessions, setRecentSessions] = useState<PracticeSession[]>([])
  const [questionLogs, setQuestionLogs] = useState<QuestionLog[]>([])
  const [activeTab, setActiveTab] = useState<'overview' | 'progress' | 'achievements' | 'friends' | 'history' | 'settings'>('overview')

  const gradeLevels = [
    'Below 6th',
    '6th',
    '7th',
    '8th',
    '9th',
    '10th',
    '11th',
    '12th',
    'Post-High School'
  ]

  useEffect(() => {
    if (user) {
      fetchAllData()
    }
  }, [user])

  useEffect(() => {
    if (user && activeTab === 'history') {
      console.log('History tab selected, refetching question logs')
      fetchQuestionLogs()
    }
  }, [user, activeTab])

  const fetchAllData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('Fetching all data for user:', user?.id)
      
      await Promise.all([
        fetchProfile(),
        fetchUserStats(),
        fetchTopicProgress(),
        fetchAchievements(),
        fetchFriends(),
        fetchQuestionLogs()
      ])
    } catch (error: any) {
      console.error('Error fetching data:', error)
      setError(error.message || 'Failed to fetch profile data')
    } finally {
      setLoading(false)
    }
  }

  const fetchProfile = async () => {
    if (!user) return

    const { data, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError
    }

    if (!data) {
      // Create user profile if it doesn't exist
      const username = user.user_metadata?.username || user.email?.split('@')[0] || 'user'
      const { data: newProfile, error: insertError } = await supabase
        .from('users')
        .insert([{
          id: user.id,
          username: username,
          grade_level: user.user_metadata?.grade_level || '',
          streak: 0,
          badges: [],
          total_points: 0,
          friend_count: 0
        }])
        .select()
        .single()

      if (insertError) throw insertError
      setProfile(newProfile)
      setNewUsername(newProfile.username)
      setNewGradeLevel(newProfile.grade_level)
    } else {
      setProfile(data)
      setNewUsername(data.username)
      setNewGradeLevel(data.grade_level)
    }
  }

  const fetchUserStats = async () => {
    if (!user) return

    // Get comprehensive stats from practice_attempts
    const { data: attempts, error } = await supabase
      .from('practice_attempts')
      .select('*')
      .eq('user_id', user.id)

    if (error) throw error

    if (attempts && attempts.length > 0) {
      const totalQuestions = attempts.length
      const correctAnswers = attempts.filter(a => a.is_correct).length
      const accuracy = (correctAnswers / totalQuestions) * 100
      
      // Calculate unique sessions (group by date)
      const sessionDates = new Set(attempts.map(a => new Date(a.created_at).toDateString()))
      
      // Calculate average session length (questions per session)
      const avgSessionLength = totalQuestions / sessionDates.size
      
      // Calculate total time spent (estimate 2 minutes per question)
      const totalTimeSpent = totalQuestions * 2
      
      // Get topics mastered (topics with >80% accuracy and >10 questions)
      const topicStats: Record<string, { total: number, correct: number }> = {}
      attempts.forEach(attempt => {
        if (!topicStats[attempt.topic]) {
          topicStats[attempt.topic] = { total: 0, correct: 0 }
        }
        topicStats[attempt.topic].total++
        if (attempt.is_correct) topicStats[attempt.topic].correct++
      })
      
      const topicsMastered = Object.values(topicStats).filter(
        stat => stat.total >= 10 && (stat.correct / stat.total) >= 0.8
      ).length

      setStats({
        total_questions_attempted: totalQuestions,
        correct_answers: correctAnswers,
        accuracy_percentage: Math.round(accuracy),
        total_practice_sessions: sessionDates.size,
        average_session_length: Math.round(avgSessionLength),
        best_streak: profile?.streak || 0,
        topics_mastered: topicsMastered,
        total_time_spent: totalTimeSpent
      })
    }
  }

  const fetchTopicProgress = async () => {
    if (!user) return

    const { data: attempts, error } = await supabase
      .from('practice_attempts')
      .select('*')
      .eq('user_id', user.id)

    if (error) throw error

    if (attempts && attempts.length > 0) {
      const topicStats: Record<string, {
        questions_attempted: number,
        correct_answers: number,
        last_practiced: string
      }> = {}
      
      attempts.forEach(attempt => {
        if (!topicStats[attempt.topic]) {
          topicStats[attempt.topic] = {
            questions_attempted: 0,
            correct_answers: 0,
            last_practiced: attempt.created_at
          }
        }
        topicStats[attempt.topic].questions_attempted++
        if (attempt.is_correct) topicStats[attempt.topic].correct_answers++
        if (new Date(attempt.created_at) > new Date(topicStats[attempt.topic].last_practiced)) {
          topicStats[attempt.topic].last_practiced = attempt.created_at
        }
      })

      const progress: TopicProgress[] = Object.entries(topicStats).map(([topic, stats]) => {
        const accuracy = (stats.correct_answers / stats.questions_attempted) * 100
        let masteryLevel: 'beginner' | 'intermediate' | 'advanced' | 'master' = 'beginner'
        
        if (stats.questions_attempted >= 20 && accuracy >= 90) masteryLevel = 'master'
        else if (stats.questions_attempted >= 15 && accuracy >= 80) masteryLevel = 'advanced'
        else if (stats.questions_attempted >= 10 && accuracy >= 70) masteryLevel = 'intermediate'

        return {
          topic,
          questions_attempted: stats.questions_attempted,
          correct_answers: stats.correct_answers,
          accuracy: Math.round(accuracy),
          last_practiced: stats.last_practiced,
          mastery_level: masteryLevel
        }
      })

      setTopicProgress(progress.sort((a, b) => b.accuracy - a.accuracy))
    }
  }

  const fetchAchievements = async () => {
    if (!user) return

    const { data, error } = await supabase
      .from('user_achievements')
      .select('*')
      .eq('user_id', user.id)
      .order('unlocked_at', { ascending: false })

    if (error) throw error
    setAchievements(data || [])
  }

  const fetchFriends = async () => {
    if (!user) return

    const { data, error } = await supabase
      .from('friend_relationships')
      .select(`
        id,
        status,
        requester:users!requester_id(id, username, grade_level, total_points),
        recipient:users!recipient_id(id, username, grade_level, total_points)
      `)
      .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .eq('status', 'accepted')

    if (error) throw error

    const friendsList: Friend[] = (data || []).map((relationship: any) => {
      const isRequester = relationship.requester_id === user.id
      const friendProfile = isRequester ? relationship.recipient : relationship.requester
      
      return {
        id: relationship.id,
        username: friendProfile?.username || 'Unknown',
        grade_level: friendProfile?.grade_level || 'Unknown',
        total_points: friendProfile?.total_points || 0,
        status: relationship.status
      }
    })

    setFriends(friendsList)
  }

  const fetchQuestionLogs = async () => {
    if (!user) {
      console.log('No user found, skipping question logs fetch')
      return
    }

    console.log('Fetching question logs for user:', user.id)
    console.log('User object:', user)

    // First, let's try a simple query to see if we can get any data
    const { data: testData, error: testError } = await supabase
      .from('question_attempts')
      .select('*')
      .limit(5)

    console.log('Test query result:', { data: testData, error: testError })

    const { data: logs, error } = await supabase
      .from('question_attempts')
      .select(`
        *,
        question:questions(question_text, answer, options)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    console.log('Query result:', { data: logs, error })

    if (error) {
      console.error('Error fetching question logs:', error)
      throw error
    }

    console.log('Raw question logs data:', logs)

    const questionLogs: QuestionLog[] = (logs || []).map((log: any) => {
      // Handle user_answers as jsonb - it could be an array or object
      let lastUserAnswer = '';
      if (log.user_answers) {
        if (Array.isArray(log.user_answers)) {
          lastUserAnswer = String(log.user_answers[log.user_answers.length - 1] ?? '');
        } else if (typeof log.user_answers === 'object') {
          const answers = Object.values(log.user_answers);
          lastUserAnswer = String(answers[answers.length - 1] ?? '');
        } else {
          lastUserAnswer = String(log.user_answers);
        }
      }
      // Map index to option text if possible
      let userAnswerText = lastUserAnswer;
      if (
        log.question?.options &&
        lastUserAnswer !== '' &&
        !isNaN(Number(lastUserAnswer)) &&
        Number(lastUserAnswer) >= 0 &&
        Number(lastUserAnswer) < log.question.options.length
      ) {
        userAnswerText = log.question.options[Number(lastUserAnswer)];
      }
      // Get the correct answer from the question options
      const correctAnswer = log.question?.options && log.question?.answer !== undefined
        ? log.question.options[log.question.answer]
        : undefined;
      return {
        id: log.id,
        question_id: log.question_id,
        user_answer: userAnswerText, // <-- always the answer text if possible
        is_correct: log.is_correct || false,
        division: log.division,
        topic: log.topic,
        created_at: log.created_at,
        question_text: log.question?.question_text,
        correct_answer: correctAnswer
      };
    })

    console.log('Processed question logs:', questionLogs)
    setQuestionLogs(questionLogs)
  }

  const handleUpdateProfile = async () => {
    try {
      setError(null)
      setSuccessMessage(null)

      if (!user) return

      const { error } = await supabase
        .from('users')
        .update({ 
          username: newUsername,
          grade_level: newGradeLevel 
        })
        .eq('id', user.id)

      if (error) throw error

      setProfile(prev => prev ? { 
        ...prev, 
        username: newUsername, 
        grade_level: newGradeLevel 
      } : null)
      setSuccessMessage('Profile updated successfully')
      setIsEditing(false)
    } catch (error: any) {
      setError(error.message || 'Failed to update profile')
    }
  }

  const handleUpdatePassword = async () => {
    try {
      setError(null)
      setSuccessMessage(null)

      if (newPassword !== confirmPassword) {
        setError('New passwords do not match')
        return
      }

      if (newPassword.length < 6) {
        setError('Password must be at least 6 characters long')
        return
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) throw error

      setSuccessMessage('Password updated successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error: any) {
      setError(error.message || 'Failed to update password')
    }
  }

  const getMasteryColor = (level: string) => {
    switch (level) {
      case 'master': return 'bg-purple-100 text-purple-800'
      case 'advanced': return 'bg-green-100 text-green-800'
      case 'intermediate': return 'bg-yellow-100 text-yellow-800'
      case 'beginner': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50">
          <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <div className="px-4 py-6 sm:px-0">
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
          </main>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            {/* Header */}
            <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-6">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-3xl">
                      {profile?.username?.[0]?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900">{profile?.username}</h1>
                    <p className="text-gray-600">{profile?.grade_level || 'Grade level not set'}</p>
                    <p className="text-sm text-gray-500">Member since {new Date(profile?.created_at || '').toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600">{profile?.total_points || 0}</div>
                  <div className="text-sm text-gray-500">Total Points</div>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-lg mb-6">
                  {error}
                </div>
              )}

              {successMessage && (
                <div className="bg-green-50 border border-green-200 text-green-600 p-4 rounded-lg mb-6">
                  {successMessage}
                </div>
              )}

              {/* Navigation Tabs */}
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                  {[
                    { id: 'overview', label: 'Overview', icon: '📊' },
                    { id: 'progress', label: 'Progress', icon: '📈' },
                    { id: 'achievements', label: 'Achievements', icon: '🏆' },
                    { id: 'friends', label: 'Friends', icon: '👥' },
                    { id: 'history', label: 'History', icon: '📅' },
                    { id: 'settings', label: 'Settings', icon: '⚙️' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        activeTab === tab.id
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <span className="mr-2">{tab.icon}</span>
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
              <div className="space-y-8">
                {/* Quick Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <span className="text-2xl">📚</span>
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-500">Questions Attempted</p>
                        <p className="text-2xl font-bold text-gray-900">{stats?.total_questions_attempted || 0}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <span className="text-2xl">🎯</span>
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-500">Accuracy</p>
                        <p className="text-2xl font-bold text-gray-900">{stats?.accuracy_percentage || 0}%</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <span className="text-2xl">🔥</span>
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-500">Current Streak</p>
                        <p className="text-2xl font-bold text-gray-900">{profile?.streak || 0} days</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center">
                      <div className="p-2 bg-yellow-100 rounded-lg">
                        <span className="text-2xl">⭐</span>
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-500">Topics Mastered</p>
                        <p className="text-2xl font-bold text-gray-900">{stats?.topics_mastered || 0}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white rounded-lg shadow">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
                  </div>
                  <div className="p-6">
                    {recentSessions.length > 0 ? (
                      <div className="space-y-4">
                        {recentSessions.slice(0, 5).map((session) => (
                          <div key={session.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                            <div>
                              <p className="font-medium text-gray-900">{session.session_type}</p>
                              <p className="text-sm text-gray-500">{session.topic}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium text-gray-900">{session.questions_attempted} questions</p>
                              <p className="text-sm text-gray-500">{session.accuracy}% accuracy</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-8">No recent activity</p>
                    )}
                  </div>
                </div>

                {/* Badges */}
                <div className="bg-white rounded-lg shadow">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">Recent Badges</h3>
                  </div>
                  <div className="p-6">
                    <Badges />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'progress' && (
              <div className="space-y-8">
                {/* Topic Progress */}
                <div className="bg-white rounded-lg shadow">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">Topic Progress</h3>
                  </div>
                  <div className="p-6">
                    {topicProgress.length > 0 ? (
                      <div className="space-y-4">
                        {topicProgress.map((topic) => (
                          <div key={topic.topic} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium text-gray-900">{topic.topic}</h4>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getMasteryColor(topic.mastery_level)}`}>
                                {topic.mastery_level}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
                              <span>{topic.questions_attempted} questions attempted</span>
                              <span>{topic.correct_answers} correct</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${topic.accuracy}%` }}
                              ></div>
                            </div>
                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                              <span>0%</span>
                              <span>{topic.accuracy}%</span>
                              <span>100%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-8">No topic progress yet</p>
                    )}
                  </div>
                </div>

                {/* Learning Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Learning Statistics</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Practice Sessions</span>
                        <span className="font-medium">{stats?.total_practice_sessions || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Average Session Length</span>
                        <span className="font-medium">{stats?.average_session_length || 0} questions</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Time Spent</span>
                        <span className="font-medium">{formatTime(stats?.total_time_spent || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Best Streak</span>
                        <span className="font-medium">{stats?.best_streak || 0} days</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Performance Summary</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Questions Attempted</span>
                        <span className="font-medium">{stats?.total_questions_attempted || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Correct Answers</span>
                        <span className="font-medium">{stats?.correct_answers || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Overall Accuracy</span>
                        <span className="font-medium">{stats?.accuracy_percentage || 0}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Topics Mastered</span>
                        <span className="font-medium">{stats?.topics_mastered || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'achievements' && (
              <div className="space-y-8">
                <div className="bg-white rounded-lg shadow">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">Achievements</h3>
                  </div>
                  <div className="p-6">
                    {achievements.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {achievements.map((achievement) => (
                          <div key={achievement.id} className="border rounded-lg p-4 text-center">
                            <div className="text-4xl mb-2">{achievement.icon || '🏆'}</div>
                            <h4 className="font-medium text-gray-900 mb-1">{achievement.achievement_name}</h4>
                            <p className="text-sm text-gray-600 mb-2">{achievement.description}</p>
                            <div className="text-xs text-gray-500">
                              Unlocked {new Date(achievement.unlocked_at).toLocaleDateString()}
                            </div>
                            <div className="mt-2 text-sm font-medium text-blue-600">
                              +{achievement.points_awarded} points
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <div className="text-4xl mb-4">🏆</div>
                        <p className="text-gray-500">No achievements unlocked yet</p>
                        <p className="text-sm text-gray-400 mt-2">Keep practicing to earn achievements!</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'friends' && (
              <div className="space-y-8">
                <div className="bg-white rounded-lg shadow">
                  <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="text-lg font-medium text-gray-900">Friends</h3>
                    <Link
                      href="/friends"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Manage Friends
                    </Link>
                  </div>
                  <div className="p-6">
                    {friends.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {friends.map((friend) => (
                          <div key={friend.id} className="border rounded-lg p-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                                <span className="text-white font-medium">
                                  {friend.username[0].toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <h4 className="font-medium text-gray-900">{friend.username}</h4>
                                <p className="text-sm text-gray-500">{friend.grade_level}</p>
                              </div>
                            </div>
                            <div className="mt-3 text-sm text-gray-600">
                              <span className="font-medium">{friend.total_points}</span> points
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <div className="text-4xl mb-4">👥</div>
                        <p className="text-gray-500">No friends yet</p>
                        <Link
                          href="/friends"
                          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-block"
                        >
                          Find Friends
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="space-y-8">
                <div className="bg-white rounded-lg shadow">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">Question History</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Your recent question attempts ({questionLogs.length} total)
                    </p>

                  </div>
                  <div className="p-6">
                    {questionLogs.length > 0 ? (
                      <div className="space-y-4">
                        {questionLogs.map((log) => (
                          <div 
                            key={log.id} 
                            className="border rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                            onClick={() => router.push(`/practice/question/${log.question_id}`)}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center space-x-3">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  log.is_correct 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {log.is_correct ? '✔️' : '❌'}
                                </span>
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                                  {log.topic}
                                </span>
                                <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">
                                  {log.division}
                                </span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <div className="text-right">
                                  <p className="text-sm text-gray-500">
                                    {new Date(log.created_at).toLocaleDateString()}
                                  </p>
                                  <p className="text-sm text-gray-500">
                                    {new Date(log.created_at).toLocaleTimeString()}
                                  </p>
                                </div>
                                <div onClick={(e) => e.stopPropagation()}>
                                  <FlagQuestion 
                                    questionId={log.question_id}
                                    questionText={log.question_text || ''}
                                  />
                                </div>
                              </div>
                            </div>
                            
                            {/* Question Text */}
                            {log.question_text && (
                              <div className="mb-3">
                                <p className="text-sm text-gray-600 mb-1">Question:</p>
                                <div className="text-gray-900 text-sm">
                                  {renderLatex(log.question_text)}
                                </div>
                              </div>
                            )}
                            
                            {/* Answer Details */}
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-gray-600 mb-1">Your Answer:</p>
                                <p className={`font-medium ${
                                  log.is_correct ? 'text-green-700' : 'text-red-700'
                                }`}>
                                  {log.user_answer ? renderLatex(log.user_answer) : 'No answer provided'}
                                </p>
                              </div>
                              {!log.is_correct && log.correct_answer && (
                                <div>
                                  <p className="text-gray-600 mb-1">Correct Answer:</p>
                                  <p className="text-green-700 font-medium">
                                    {renderLatex(log.correct_answer)}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No Question History</h3>
                        <p className="text-gray-600">
                          Start practicing questions to see your history here.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-8">
                {/* Profile Settings */}
                <div className="bg-white rounded-lg shadow">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">Profile Settings</h3>
                  </div>
                  <div className="p-6">
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Username
                        </label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={newUsername}
                            onChange={(e) => setNewUsername(e.target.value)}
                            className="w-full p-3 bg-white rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        ) : (
                          <p className="text-gray-900">{profile?.username}</p>
                        )}
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Grade Level
                        </label>
                        {isEditing ? (
                          <select
                            value={newGradeLevel}
                            onChange={(e) => setNewGradeLevel(e.target.value)}
                            className="w-full p-3 bg-white rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            {gradeLevels.map((grade) => (
                              <option key={grade} value={grade}>
                                {grade}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <p className="text-gray-900">{profile?.grade_level || 'Not set'}</p>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="flex space-x-3">
                          <button
                            onClick={handleUpdateProfile}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                          >
                            Save Changes
                          </button>
                          <button
                            onClick={() => {
                              setIsEditing(false)
                              setNewUsername(profile?.username || '')
                              setNewGradeLevel(profile?.grade_level || '')
                            }}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setIsEditing(true)}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                        >
                          Edit Profile
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Password Change */}
                <div className="bg-white rounded-lg shadow">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">Change Password</h3>
                  </div>
                  <div className="p-6">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Current Password
                        </label>
                        <input
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="w-full p-3 bg-white rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          New Password
                        </label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full p-3 bg-white rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Confirm New Password
                        </label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full p-3 bg-white rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <button
                        onClick={handleUpdatePassword}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Update Password
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  )
} 
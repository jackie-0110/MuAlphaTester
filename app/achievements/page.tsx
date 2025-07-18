'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ProtectedRoute } from '../components/ProtectedRoute'
import { toast, Toaster } from 'react-hot-toast'

interface UserAchievement {
  id: string
  user_id: string
  achievement_type: string
  achievement_name: string
  description: string
  points_awarded: number
  icon: string
  unlocked_at: string
}

interface UserProfile {
  id: string
  username: string
  grade_level: string
  total_points: number
  friend_count: number
}

interface AchievementStats {
  total_achievements: number
  total_points_earned: number
  completion_percentage: number
}

export default function AchievementsPage() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  const [achievements, setAchievements] = useState<UserAchievement[]>([])
  const [stats, setStats] = useState<AchievementStats>({
    total_achievements: 0,
    total_points_earned: 0,
    completion_percentage: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCurrentUser()
    fetchAchievements()
  }, [])

  const fetchCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('users')
        .select('id, username, grade_level, total_points, friend_count')
        .eq('id', user.id)
        .single()

      if (error) throw error
      setCurrentUser(data)
    } catch (err) {
      console.error('Error fetching current user:', err)
    }
  }

  const fetchAchievements = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('user_achievements')
        .select('*')
        .eq('user_id', user.id)
        .order('unlocked_at', { ascending: false })

      if (error) throw error

      setAchievements(data || [])
      
      // Calculate stats
      const totalPointsEarned = (data || []).reduce((sum, achievement) => sum + achievement.points_awarded, 0)
      const totalAchievements = data?.length || 0
      const completionPercentage = Math.round((totalAchievements / 5) * 100) // Assuming 5 total achievements

      setStats({
        total_achievements: totalAchievements,
        total_points_earned: totalPointsEarned,
        completion_percentage: completionPercentage
      })
    } catch (err) {
      console.error('Error fetching achievements:', err)
      toast.error('Failed to load achievements')
    } finally {
      setLoading(false)
    }
  }

  const getAchievementColor = (achievementType: string) => {
    switch (achievementType) {
      case 'first_practice':
        return 'bg-blue-100 text-blue-800'
      case 'practice_enthusiast':
        return 'bg-orange-100 text-orange-800'
      case 'perfectionist':
        return 'bg-yellow-100 text-yellow-800'
      case 'topic_explorer':
        return 'bg-green-100 text-green-800'
      case 'division_master':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getAchievementProgress = (achievementType: string) => {
    // This would be calculated based on user's current progress
    // For now, return a placeholder
    return {
      current: 0,
      required: 0,
      percentage: 0
    }
  }

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 py-8">
        <Toaster />
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Achievements</h1>
          <p className="text-gray-600">Track your progress and unlock achievements</p>
        </div>

        {/* Current User Stats */}
        {currentUser && (
          <div className="bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg p-6 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold mb-2">Your Achievement Stats</h2>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm opacity-90">Achievements Unlocked</p>
                    <p className="text-2xl font-bold">{stats.total_achievements}/5</p>
                  </div>
                  <div>
                    <p className="text-sm opacity-90">Points from Achievements</p>
                    <p className="text-2xl font-bold">{stats.total_points_earned}</p>
                  </div>
                  <div>
                    <p className="text-sm opacity-90">Completion</p>
                    <p className="text-2xl font-bold">{stats.completion_percentage}%</p>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm opacity-90">Total Points</p>
                <p className="text-lg font-semibold">{currentUser.total_points}</p>
              </div>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-900">Overall Progress</h3>
            <span className="text-sm text-gray-500">{stats.total_achievements}/5 achievements</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-gradient-to-r from-purple-500 to-pink-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${stats.completion_percentage}%` }}
            />
          </div>
        </div>

        {/* Achievements Grid */}
        <div className="bg-white rounded-lg shadow">
          {loading ? (
            <div className="p-6">
              <div className="animate-pulse grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-48 bg-gray-200 rounded-lg"></div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Available Achievements</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* First Practice Achievement */}
                <div className={`p-6 rounded-lg border-2 ${
                  achievements.some(a => a.achievement_type === 'first_practice')
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 bg-gray-50'
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-3xl">🎯</span>
                    {achievements.some(a => a.achievement_type === 'first_practice') && (
                      <span className="text-green-600 text-sm font-medium">✓ Unlocked</span>
                    )}
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">First Steps</h4>
                  <p className="text-sm text-gray-600 mb-3">Complete your first practice question</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">50 points</span>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      achievements.some(a => a.achievement_type === 'first_practice')
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {achievements.some(a => a.achievement_type === 'first_practice') ? 'Completed' : 'Not Started'}
                    </span>
                  </div>
                </div>

                {/* Practice Enthusiast Achievement */}
                <div className={`p-6 rounded-lg border-2 ${
                  achievements.some(a => a.achievement_type === 'practice_enthusiast')
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 bg-gray-50'
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-3xl">🔥</span>
                    {achievements.some(a => a.achievement_type === 'practice_enthusiast') && (
                      <span className="text-green-600 text-sm font-medium">✓ Unlocked</span>
                    )}
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">Practice Enthusiast</h4>
                  <p className="text-sm text-gray-600 mb-3">Complete 10 practice questions</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">100 points</span>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      achievements.some(a => a.achievement_type === 'practice_enthusiast')
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {achievements.some(a => a.achievement_type === 'practice_enthusiast') ? 'Completed' : 'In Progress'}
                    </span>
                  </div>
                </div>

                {/* Perfectionist Achievement */}
                <div className={`p-6 rounded-lg border-2 ${
                  achievements.some(a => a.achievement_type === 'perfectionist')
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 bg-gray-50'
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-3xl">⭐</span>
                    {achievements.some(a => a.achievement_type === 'perfectionist') && (
                      <span className="text-green-600 text-sm font-medium">✓ Unlocked</span>
                    )}
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">Perfectionist</h4>
                  <p className="text-sm text-gray-600 mb-3">Achieve 95%+ accuracy on 5+ questions</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">200 points</span>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      achievements.some(a => a.achievement_type === 'perfectionist')
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {achievements.some(a => a.achievement_type === 'perfectionist') ? 'Completed' : 'In Progress'}
                    </span>
                  </div>
                </div>

                {/* Topic Explorer Achievement */}
                <div className={`p-6 rounded-lg border-2 ${
                  achievements.some(a => a.achievement_type === 'topic_explorer')
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 bg-gray-50'
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-3xl">🗺️</span>
                    {achievements.some(a => a.achievement_type === 'topic_explorer') && (
                      <span className="text-green-600 text-sm font-medium">✓ Unlocked</span>
                    )}
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">Topic Explorer</h4>
                  <p className="text-sm text-gray-600 mb-3">Practice in 3 different topics</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">150 points</span>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      achievements.some(a => a.achievement_type === 'topic_explorer')
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {achievements.some(a => a.achievement_type === 'topic_explorer') ? 'Completed' : 'In Progress'}
                    </span>
                  </div>
                </div>

                {/* Division Master Achievement */}
                <div className={`p-6 rounded-lg border-2 ${
                  achievements.some(a => a.achievement_type === 'division_master')
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 bg-gray-50'
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-3xl">🏆</span>
                    {achievements.some(a => a.achievement_type === 'division_master') && (
                      <span className="text-green-600 text-sm font-medium">✓ Unlocked</span>
                    )}
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">Division Master</h4>
                  <p className="text-sm text-gray-600 mb-3">Practice in 2 different divisions</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">200 points</span>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      achievements.some(a => a.achievement_type === 'division_master')
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {achievements.some(a => a.achievement_type === 'division_master') ? 'Completed' : 'In Progress'}
                    </span>
                  </div>
                </div>

                {/* Coming Soon Achievement */}
                <div className="p-6 rounded-lg border-2 border-gray-200 bg-gray-50 opacity-60">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-3xl">🔮</span>
                    <span className="text-gray-500 text-sm font-medium">Coming Soon</span>
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">More Achievements</h4>
                  <p className="text-sm text-gray-600 mb-3">New achievements will be added regularly</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">??? points</span>
                    <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600">
                      Locked
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Recent Unlocks */}
        {achievements.length > 0 && (
          <div className="bg-white rounded-lg shadow mt-8">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recently Unlocked</h3>
              <div className="space-y-3">
                {achievements.slice(0, 5).map((achievement) => (
                  <div key={achievement.id} className="flex items-center space-x-4 p-3 bg-green-50 rounded-lg border border-green-200">
                    <span className="text-2xl">{achievement.icon}</span>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{achievement.achievement_name}</h4>
                      <p className="text-sm text-gray-600">{achievement.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-green-600">+{achievement.points_awarded} points</p>
                      <p className="text-xs text-gray-500">
                        {new Date(achievement.unlocked_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
} 
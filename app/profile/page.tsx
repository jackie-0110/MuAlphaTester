'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../utils/supabase'
import { ProtectedRoute } from '../../components/ProtectedRoute'
import { useAuth } from '../../contexts/AuthContext'
import Badges from '@/components/Badges'

interface UserProfile {
  username: string
  grade_level: string
  created_at: string
  streak: number
  badges: string[]
}

interface UserStats {
  total_points: number
  total_questions: number
  correct_answers: number
  best_streak: number
  topic_completions: number
}

export default function ProfilePage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [newGradeLevel, setNewGradeLevel] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [stats, setStats] = useState<UserStats | null>(null)

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
    fetchProfile()
    fetchUserData()
  }, [user])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      setError(null)
      
      if (!user) return

      // First try to fetch the profile
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (fetchError) {
        console.error('Fetch error:', fetchError)
        if (fetchError.code !== 'PGRST116') { // PGRST116 is "not found"
          throw fetchError
        }
      }

      if (!data) {
        // If profile doesn't exist, create it
        const username = user.user_metadata?.username || user.email?.split('@')[0] || 'user'
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert([
            {
              id: user.id,
              username: username,
              grade_level: user.user_metadata?.grade_level || '',
              streak: 0,
              badges: []
            }
          ])
          .select()
          .single()

        if (insertError) {
          console.error('Insert error:', insertError)
          throw insertError
        }

        if (!newProfile) {
          throw new Error('Failed to create profile')
        }

        setProfile(newProfile)
      } else {
        setProfile(data)
      }

      setNewGradeLevel(profile?.grade_level || '')
    } catch (error: any) {
      console.error('Profile error:', error)
      setError(error.message || 'Failed to fetch profile')
    } finally {
      setLoading(false)
    }
  }

  const fetchUserData = async () => {
    try {
      if (!user) return

      // Fetch user statistics
      const { data: statsData, error: statsError } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (statsError) throw statsError

      setStats(statsData)
    } catch (err) {
      setError('Failed to fetch user data')
      console.error(err)
    }
  }

  const handleUpdateGradeLevel = async () => {
    try {
      setError(null)
      setSuccessMessage(null)

      if (!user) return

      const { error } = await supabase
        .from('profiles')
        .update({ grade_level: newGradeLevel })
        .eq('id', user.id)

      if (error) throw error

      setProfile(prev => prev ? { ...prev, grade_level: newGradeLevel } : null)
      setSuccessMessage('Grade level updated successfully')
      setIsEditing(false)
    } catch (error: any) {
      setError(error.message || 'Failed to update grade level')
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

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50">
          <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <div className="px-4 py-6 sm:px-0">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
                <div className="h-10 bg-gray-200 rounded mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
                <div className="h-10 bg-gray-200 rounded"></div>
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
            <div className="bg-white rounded-xl shadow-lg p-8">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
                  <p className="text-gray-600 mt-1">Manage your account settings</p>
                </div>
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-2xl">
                    {profile?.username?.[0]?.toUpperCase() || '?'}
                  </span>
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

              <div className="space-y-8">
                {/* User Information */}
                <div>
                  <h2 className="text-lg font-medium text-gray-900 mb-4">User Information</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Username</label>
                      <p className="mt-1 text-gray-900">{profile?.username}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email</label>
                      <p className="mt-1 text-gray-900">{user?.email}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Member Since</label>
                      <p className="mt-1 text-gray-900">
                        {new Date(profile?.created_at || '').toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Current Streak</label>
                      <p className="mt-1 text-gray-900">{profile?.streak || 0} days</p>
                    </div>
                  </div>
                </div>

                {/* Badges */}
                <div>
                  <h2 className="text-lg font-medium text-gray-900 mb-4">Badges Earned</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {profile?.badges?.map((badge, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-4 text-center">
                        <div className="w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center mx-auto mb-2">
                          <span className="text-white">🏆</span>
                        </div>
                        <p className="text-sm font-medium text-gray-900">{badge}</p>
                      </div>
                    ))}
                    {(!profile?.badges || profile.badges.length === 0) && (
                      <p className="text-gray-500">No badges earned yet</p>
                    )}
                  </div>
                </div>

                {/* Grade Level */}
                <div>
                  <h2 className="text-lg font-medium text-gray-900 mb-4">Grade Level</h2>
                  <div className="flex items-center gap-4">
                    {isEditing ? (
                      <>
                        <select
                          value={newGradeLevel}
                          onChange={(e) => setNewGradeLevel(e.target.value)}
                          className="flex-1 p-3 bg-white rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          {gradeLevels.map((grade) => (
                            <option key={grade} value={grade}>
                              {grade}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={handleUpdateGradeLevel}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setIsEditing(false)
                            setNewGradeLevel(profile?.grade_level || '')
                          }}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="text-gray-900">{profile?.grade_level || 'Not set'}</p>
                        <button
                          onClick={() => setIsEditing(true)}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                        >
                          Edit
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Password Change */}
                <div>
                  <h2 className="text-lg font-medium text-gray-900 mb-4">Change Password</h2>
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

            {stats && (
              <div className="mt-8 bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Statistics</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-500">Total Points</h3>
                    <p className="mt-1 text-2xl font-semibold text-gray-900">{stats.total_points}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-500">Accuracy</h3>
                    <p className="mt-1 text-2xl font-semibold text-gray-900">
                      {Math.round((stats.correct_answers / stats.total_questions) * 100)}%
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-500">Best Streak</h3>
                    <p className="mt-1 text-2xl font-semibold text-gray-900">{stats.best_streak}</p>
                  </div>
                </div>
              </div>
            )}

            <Badges />
          </div>
        </main>
      </div>
    </ProtectedRoute>
  )
} 
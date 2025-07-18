'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ProtectedRoute } from '../components/ProtectedRoute'
import { toast, Toaster } from 'react-hot-toast'

interface LeaderboardEntry {
  id: string
  user_id: string
  username: string
  division: string
  topic: string
  grade_level: string
  points: number
  average_score: number
  attempts: number
  perfect_scores: number
  questions_attempted: number
  last_updated: string
}

interface UserProfile {
  id: string
  username: string
  grade_level: string
  total_points: number
  friend_count: number
}

export default function Leaderboard() {
  const [divisions, setDivisions] = useState<string[]>([])
  const [topics, setTopics] = useState<string[]>([])
  const [gradeLevels, setGradeLevels] = useState<string[]>([])
  const [selectedDivision, setSelectedDivision] = useState<string>('')
  const [selectedTopic, setSelectedTopic] = useState<string>('')
  const [selectedGradeLevel, setSelectedGradeLevel] = useState<string>('')
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([])
  const [globalLeaderboard, setGlobalLeaderboard] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'topic' | 'global'>('topic')
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)

  useEffect(() => {
    fetchInitialData()
    fetchCurrentUser()
  }, [])

  useEffect(() => {
    if (activeTab === 'topic') {
    fetchLeaderboard()
    } else {
      fetchGlobalLeaderboard()
    }
  }, [selectedDivision, selectedTopic, selectedGradeLevel, activeTab])

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

  const fetchInitialData = async () => {
    try {
      const { data, error } = await supabase
        .from('leaderboard')
        .select('division, grade_level, topic')
        .order('division')

      if (error) throw error

      const uniqueDivisions = [...new Set(data.map(d => d.division))]
      const uniqueGradeLevels = [...new Set(data.map(d => d.grade_level))]
      const uniqueTopics = [...new Set(data.map(d => d.topic))]
      
      setDivisions(uniqueDivisions)
      setGradeLevels(uniqueGradeLevels)
      setTopics(uniqueTopics)
    } catch (err) {
      setError('Failed to fetch initial data')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchLeaderboard = async () => {
    try {
      setLoading(true)
      let query = supabase
        .from('leaderboard')
        .select('*')
        .order('points', { ascending: false })
        .limit(50)

      if (selectedDivision) {
        query = query.eq('division', selectedDivision)
      }
      if (selectedTopic) {
        query = query.eq('topic', selectedTopic)
      }
      if (selectedGradeLevel) {
        query = query.eq('grade_level', selectedGradeLevel)
      }

      const { data, error } = await query

      if (error) throw error

      setLeaderboardData(data || [])
    } catch (err) {
      setError('Failed to fetch leaderboard data')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchGlobalLeaderboard = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('users')
        .select('id, username, grade_level, total_points, friend_count')
        .order('total_points', { ascending: false })
        .limit(50)

      if (error) throw error

      setGlobalLeaderboard(data || [])
    } catch (err) {
      setError('Failed to fetch global leaderboard data')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const getRankIcon = (rank: number) => {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return `#${rank}`
  }

  const getCurrentUserRank = () => {
    if (!currentUser) return null
    
    if (activeTab === 'global') {
      return globalLeaderboard.findIndex(user => user.id === currentUser.id) + 1
    } else {
      return leaderboardData.findIndex(entry => entry.user_id === currentUser.id) + 1
    }
  }

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 py-8">
        <Toaster />
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Leaderboard</h1>
          <p className="text-gray-600">Compete with other students and track your progress</p>
        </div>

        {/* current user stats */}
        {currentUser && (
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg p-6 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold mb-2">Your Stats</h2>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm opacity-90">Total Points</p>
                    <p className="text-2xl font-bold">{currentUser.total_points}</p>
                  </div>
                  <div>
                    <p className="text-sm opacity-90">Friends</p>
                    <p className="text-2xl font-bold">{currentUser.friend_count}</p>
                  </div>
                  <div>
                    <p className="text-sm opacity-90">Global Rank</p>
                    <p className="text-2xl font-bold">
                      {getCurrentUserRank() ? `#${getCurrentUserRank()}` : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm opacity-90">Grade Level</p>
                <p className="text-lg font-semibold">{currentUser.grade_level}</p>
              </div>
            </div>
          </div>
        )}

        {/* tab navigation */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-6">
          <button
            onClick={() => setActiveTab('topic')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'topic'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Topic Leaderboard
          </button>
          <button
            onClick={() => setActiveTab('global')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'global'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Global Leaderboard
          </button>
        </div>

        {/* filters - only show for topic leaderboard */}
        {activeTab === 'topic' && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Division
            </label>
            <select
              value={selectedDivision}
              onChange={(e) => setSelectedDivision(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="">All Divisions</option>
              {divisions.map((division) => (
                <option key={division} value={division}>
                  {division}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Topic
            </label>
            <select
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="">All Topics</option>
              {topics.map((topic) => (
                <option key={topic} value={topic}>
                  {topic}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Grade Level
            </label>
            <select
              value={selectedGradeLevel}
              onChange={(e) => setSelectedGradeLevel(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="">All Grade Levels</option>
              {gradeLevels.map((grade) => (
                <option key={grade} value={grade}>
                  {grade}
                </option>
              ))}
            </select>
          </div>
        </div>
          </div>
        )}

        {/* leaderboard content */}
        <div className="bg-white rounded-lg shadow">
        {loading ? (
            <div className="p-6">
          <div className="animate-pulse space-y-4">
                {[...Array(10)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded-lg"></div>
            ))}
              </div>
          </div>
        ) : error ? (
            <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">{error}</p>
          </div>
            </div>
          ) : activeTab === 'topic' ? (
            leaderboardData.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <p>No data available for the selected filters</p>
              </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Username
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Division
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Topic
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Grade Level
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Points
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Score
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Attempts
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {leaderboardData.map((entry, index) => (
                      <tr 
                        key={`${entry.user_id}-${entry.division}-${entry.topic}-${index}`}
                        className={entry.user_id === currentUser?.id ? 'bg-blue-50' : ''}
                      >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          <span className="text-lg">{getRankIcon(index + 1)}</span>
                    </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                      {entry.username}
                          {entry.user_id === currentUser?.id && (
                            <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                              You
                            </span>
                          )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {entry.division}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {entry.topic}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {entry.grade_level}
                    </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                      {entry.points}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {entry.average_score.toFixed(1)}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {entry.attempts}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            // Global Leaderboard
            globalLeaderboard.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <p>No global leaderboard data available</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rank
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Username
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Grade Level
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Points
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Friends
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {globalLeaderboard.map((user, index) => (
                      <tr 
                        key={user.id}
                        className={user.id === currentUser?.id ? 'bg-blue-50' : ''}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          <span className="text-lg">{getRankIcon(index + 1)}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                          {user.username}
                          {user.id === currentUser?.id && (
                            <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                              You
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {user.grade_level}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                          {user.total_points}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {user.friend_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
            )
        )}
      </div>
    </div>
    </ProtectedRoute>
  )
} 
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'

interface LeaderboardEntry {
  username: string
  grade_level: string
  division: string
  topic: string
  average_score: number
  attempts: number
  perfect_scores: number
  questions_attempted: number
  last_updated: string
}

interface LeaderboardFilters {
  grade_level: string
  division: string
  topic: string
}

interface Division {
  division: string
}

interface Topic {
  topic: string
}

export function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<LeaderboardFilters>({
    grade_level: '',
    division: '',
    topic: ''
  })
  const [divisions, setDivisions] = useState<string[]>([])
  const [topics, setTopics] = useState<string[]>([])
  const [gradeLevels] = useState([
    'Below 6th',
    '6th',
    '7th',
    '8th',
    '9th',
    '10th',
    '11th',
    '12th',
    'Post-High School'
  ])

  useEffect(() => {
    fetchDivisions()
    fetchTopics()
  }, [])

  useEffect(() => {
    fetchLeaderboard()
  }, [filters])

  const fetchDivisions = async () => {
    try {
      const { data, error } = await supabase
        .from('practice_attempts')
        .select('division')
        .eq('is_correct', true)

      if (error) throw error

      // Get unique divisions
      const uniqueDivisions = [...new Set(data?.map((d: Division) => d.division))]
      setDivisions(uniqueDivisions)
    } catch (error: any) {
      console.error('Error fetching divisions:', error)
    }
  }

  const fetchTopics = async () => {
    try {
      const { data, error } = await supabase
        .from('practice_attempts')
        .select('topic')
        .eq('is_correct', true)

      if (error) throw error

      // Get unique topics
      const uniqueTopics = [...new Set(data?.map((d: Topic) => d.topic))]
      setTopics(uniqueTopics)
    } catch (error: any) {
      console.error('Error fetching topics:', error)
    }
  }

  const fetchLeaderboard = async () => {
    try {
      setLoading(true)
      setError(null)

      let query = supabase
        .from('leaderboard')
        .select('*')

      if (filters.grade_level) {
        query = query.eq('grade_level', filters.grade_level)
      }
      if (filters.division) {
        query = query.eq('division', filters.division)
      }
      if (filters.topic) {
        query = query.eq('topic', filters.topic)
      }

      const { data, error } = await query
        .order('average_score', { ascending: false })
        .limit(100)

      if (error) throw error
      setEntries(data || [])
    } catch (error: any) {
      setError(error.message || 'Failed to fetch leaderboard')
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (key: keyof LeaderboardFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="h-10 bg-gray-200 rounded mb-4"></div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      <div className="mb-6 space-y-4">
        <h2 className="text-2xl font-bold text-gray-900">Leaderboard</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Grade Level
            </label>
            <select
              value={filters.grade_level}
              onChange={(e) => handleFilterChange('grade_level', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Grades</option>
              {gradeLevels.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Division
            </label>
            <select
              value={filters.division}
              onChange={(e) => handleFilterChange('division', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Divisions</option>
              {divisions.map((division) => (
                <option key={division} value={division}>
                  {division}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Topic
            </label>
            <select
              value={filters.topic}
              onChange={(e) => handleFilterChange('topic', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Topics</option>
              {topics.map((topic) => (
                <option key={topic} value={topic}>
                  {topic}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

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
                Grade
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Division
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Topic
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Avg Score
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Questions
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Perfect
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Attempts
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {entries.map((entry, index) => (
              <tr key={`${entry.username}-${entry.division}-${entry.topic}`} 
                  className={index < 3 ? 'bg-yellow-50' : ''}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {index + 1}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {entry.username}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {entry.grade_level}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {entry.division}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {entry.topic}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {entry.average_score.toFixed(1)}%
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {entry.questions_attempted}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {entry.perfect_scores}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {entry.attempts}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
} 
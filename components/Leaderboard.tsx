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
  avg_time_taken: number
}

interface LeaderboardFilters {
  grade_level: string
  division: string
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
        .from('user_progress')
        .select('division')
        .distinct()
        .order('division')

      if (error) throw error
      setDivisions(data.map(d => d.division))
    } catch (error: any) {
      console.error('Error fetching divisions:', error)
    }
  }

  const fetchTopics = async () => {
    try {
      const { data, error } = await supabase
        .from('user_progress')
        .select('topic')
        .distinct()
        .order('topic')

      if (error) throw error
      setTopics(data.map(d => d.topic))
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <select
          value={filters.grade_level}
          onChange={(e) => handleFilterChange('grade_level', e.target.value)}
          className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">All Grade Levels</option>
          {gradeLevels.map((grade) => (
            <option key={grade} value={grade}>
              {grade}
            </option>
          ))}
        </select>

        <select
          value={filters.division}
          onChange={(e) => handleFilterChange('division', e.target.value)}
          className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">All Divisions</option>
          {divisions.map((division) => (
            <option key={division} value={division}>
              {division}
            </option>
          ))}
        </select>

        <select
          value={filters.topic}
          onChange={(e) => handleFilterChange('topic', e.target.value)}
          className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">All Topics</option>
          {topics.map((topic) => (
            <option key={topic} value={topic}>
              {topic}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-lg">
          {error}
        </div>
      )}

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
                Attempts
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Perfect Scores
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Avg Time
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {entries.map((entry, index) => (
              <tr key={`${entry.username}-${entry.division}-${entry.topic}`}>
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
                  {entry.average_score}%
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {entry.attempts}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {entry.perfect_scores}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {Math.round(entry.avg_time_taken / 60)}m {entry.avg_time_taken % 60}s
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
} 
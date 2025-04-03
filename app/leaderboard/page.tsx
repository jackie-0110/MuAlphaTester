'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface LeaderboardEntry {
  id: string
  username: string
  division: string
  topic: string
  grade_level: string
  points: number
  last_updated: string
}

export default function Leaderboard() {
  const [divisions, setDivisions] = useState<string[]>([])
  const [topics, setTopics] = useState<string[]>([])
  const [gradeLevels, setGradeLevels] = useState<string[]>([])
  const [selectedDivision, setSelectedDivision] = useState<string>('')
  const [selectedTopic, setSelectedTopic] = useState<string>('')
  const [selectedGradeLevel, setSelectedGradeLevel] = useState<string>('')
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchInitialData()
  }, [])

  useEffect(() => {
    fetchLeaderboard()
  }, [selectedDivision, selectedTopic, selectedGradeLevel])

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
      fetchLeaderboard() // Fetch all entries initially
    } catch (err) {
      setError('Failed to fetch initial data')
      console.error(err)
    }
  }

  const fetchLeaderboard = async () => {
    try {
      setLoading(true)
      let query = supabase
        .from('leaderboard')
        .select('*')
        .order('points', { ascending: false })

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

      setLeaderboardData(data)
    } catch (err) {
      setError('Failed to fetch leaderboard data')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Leaderboard</h1>
        
        <div className="flex flex-col md:flex-row gap-4 mb-6">
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

        {loading ? (
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">{error}</p>
          </div>
        ) : leaderboardData.length === 0 ? (
          <p className="text-gray-500">No data available</p>
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
                    Last Updated
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {leaderboardData.map((entry, index) => (
                  <tr key={`${entry.username}-${entry.division}-${entry.topic}-${entry.grade_level}-${index}`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {entry.username}
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {entry.points}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(entry.last_updated).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
} 
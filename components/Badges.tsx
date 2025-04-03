'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Badge {
  id: string
  name: string
  description: string
  icon: string
  earned_at: string
}

export default function Badges() {
  const [badges, setBadges] = useState<Badge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchBadges()
  }, [])

  const fetchBadges = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('user_badges')
        .select(`
          badge_id,
          earned_at,
          badges (
            id,
            name,
            description,
            icon
          )
        `)
        .eq('user_id', user.id)
        .order('earned_at', { ascending: false })

      if (error) throw error

      const formattedBadges = data.map(b => ({
        id: b.badges.id,
        name: b.badges.name,
        description: b.badges.description,
        icon: b.badges.icon,
        earned_at: b.earned_at
      }))

      setBadges(formattedBadges)
    } catch (err) {
      setError('Failed to fetch badges')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900">Your Badges</h2>
      {badges.length === 0 ? (
        <p className="text-gray-500">No badges earned yet. Keep practicing!</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {badges.map((badge) => (
            <div
              key={badge.id}
              className="bg-white rounded-lg shadow p-4 flex items-start space-x-4"
            >
              <div className="text-2xl">{badge.icon}</div>
              <div>
                <h3 className="font-medium text-gray-900">{badge.name}</h3>
                <p className="text-sm text-gray-500">{badge.description}</p>
                <p className="text-xs text-gray-400 mt-1">
                  Earned on {new Date(badge.earned_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 
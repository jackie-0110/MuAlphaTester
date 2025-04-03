import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'

interface Badge {
  id: string
  name: string
  description: string
  icon: string
  earned_at: string
}

export default function BadgeDisplay() {
  const [badges, setBadges] = useState<Badge[]>([])
  const [loading, setLoading] = useState(true)

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

      const formattedBadges = data.map(item => ({
        id: item.badges.id,
        name: item.badges.name,
        description: item.badges.description,
        icon: item.badges.icon,
        earned_at: item.earned_at
      }))

      setBadges(formattedBadges)
    } catch (error) {
      console.error('Error fetching badges:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Badges</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {badges.map((badge) => (
          <div
            key={badge.id}
            className="bg-white p-4 rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow"
          >
            <div className="text-3xl mb-2">{badge.icon}</div>
            <h3 className="font-medium text-gray-900">{badge.name}</h3>
            <p className="text-sm text-gray-500 mt-1">{badge.description}</p>
            <p className="text-xs text-gray-400 mt-2">
              Earned: {new Date(badge.earned_at).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
} 
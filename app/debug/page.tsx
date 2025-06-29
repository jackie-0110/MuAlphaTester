'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../utils/supabase'
import { checkAdminStatus } from '../../utils/adminUtils'

export default function DebugPage() {
  const [userData, setUserData] = useState<any>(null)
  const [profileData, setProfileData] = useState<any>(null)
  const [usersData, setUsersData] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    debugUserData()
  }, [])

  const debugUserData = async () => {
    try {
      setLoading(true)
      
      // Get current auth user
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      setUserData({ user, error: userError })

      if (user) {
        // Check admin status using our utility
        const adminStatus = await checkAdminStatus()
        setIsAdmin(adminStatus)

        // Try to get data from profiles table
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        setProfileData({ data: profileData, error: profileError })

        // Try to get data from users table
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single()
        setUsersData({ data: usersData, error: usersError })
      }
    } catch (error) {
      console.error('Debug error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Debug Information</h1>
      
      <div className="space-y-6">
        {/* Auth User Info */}
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Auth User</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(userData, null, 2)}
          </pre>
        </div>

        {/* Admin Status */}
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Admin Status</h2>
          <div className="text-lg">
            <span className="font-medium">Is Admin: </span>
            <span className={`font-bold ${isAdmin ? 'text-green-600' : 'text-red-600'}`}>
              {isAdmin === null ? 'Loading...' : isAdmin ? 'YES' : 'NO'}
            </span>
          </div>
        </div>

        {/* Profiles Table */}
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Profiles Table Data</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(profileData, null, 2)}
          </pre>
        </div>

        {/* Users Table */}
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Users Table Data</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(usersData, null, 2)}
          </pre>
        </div>

        {/* Action Buttons */}
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Actions</h2>
          <div className="space-y-4">
            <button
              onClick={debugUserData}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Refresh Debug Data
            </button>
            <div className="text-sm text-gray-600">
              <p>If you see that your user has a role in the profiles table but not in the users table (or vice versa), 
              that's the issue. Make sure the role is set in the correct table.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../utils/supabase'
import { toast, Toaster } from 'react-hot-toast'
import AdminRoute from '../../../components/AdminRoute'
import { getAdminUsers, updateUserRole } from '../../../utils/adminUtils'

interface User {
  id: string
  email: string
  username?: string
  role: 'user' | 'admin'
  created_at: string
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRole, setSelectedRole] = useState<string>('all')

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      
      // Get all users from users table
      const { data, error } = await supabase
        .from('users')
        .select('id, username, role, created_at')
        .order('created_at', { ascending: false })

      if (error) throw error

      // Get email addresses for all users
      const usersWithEmails: User[] = []
      for (const profile of data || []) {
        try {
          // Note: This requires admin privileges in Supabase
          const { data: authUser } = await supabase.auth.admin.getUserById(profile.id)
          usersWithEmails.push({
            id: profile.id,
            email: authUser?.user?.email || 'No email',
            username: profile.username,
            role: profile.role || 'user',
            created_at: profile.created_at
          })
        } catch (error) {
          // If we can't get the email, still show the user
          usersWithEmails.push({
            id: profile.id,
            email: 'Email not accessible',
            username: profile.username,
            role: profile.role || 'user',
            created_at: profile.created_at
          })
        }
      }

      setUsers(usersWithEmails)
    } catch (error) {
      console.error('Error fetching users:', error)
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const handleRoleUpdate = async (userId: string, newRole: 'user' | 'admin') => {
    try {
      const success = await updateUserRole(userId, newRole)
      
      if (success) {
        toast.success(`User role updated to ${newRole}`)
        fetchUsers() // Refresh the list
      } else {
        toast.error('Failed to update user role')
      }
    } catch (error) {
      console.error('Error updating user role:', error)
      toast.error('Failed to update user role')
    }
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.username?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = selectedRole === 'all' || user.role === selectedRole
    return matchesSearch && matchesRole
  })

  return (
    <AdminRoute>
      <div className="container mx-auto px-4 py-8">
        <Toaster />
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">User Management</h1>
          <p className="text-gray-600">Manage user roles and permissions</p>
        </div>

        {/* Filters */}
        <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Users
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by email or username..."
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Role
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Roles</option>
                <option value="user">Users</option>
                <option value="admin">Admins</option>
              </select>
            </div>
          </div>
        </div>

        {/* Users List */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Joined
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                        No users found
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr key={user.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {user.username || 'No username'}
                            </div>
                            <div className="text-sm text-gray-500">
                              {user.email}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            user.role === 'admin' 
                              ? 'bg-red-100 text-red-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {user.role === 'admin' ? (
                            <button
                              onClick={() => handleRoleUpdate(user.id, 'user')}
                              className="text-red-600 hover:text-red-900"
                            >
                              Remove Admin
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRoleUpdate(user.id, 'admin')}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              Make Admin
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminRoute>
  )
} 
import { supabase } from './supabase'

export interface AdminUser {
  id: string
  email: string
  username?: string
  role: 'user' | 'admin'
}

/**
 * Check if the current user is an admin
 */
export async function checkAdminStatus(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('Error checking admin status:', error)
      return false
    }

    return data?.role === 'admin'
  } catch (error) {
    console.error('Error checking admin status:', error)
    return false
  }
}

/**
 * Get admin user information
 */
export async function getAdminUser(): Promise<AdminUser | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('users')
      .select('role, username')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('Error getting admin user:', error)
      return null
    }

    return {
      id: user.id,
      email: user.email || '',
      username: data?.username,
      role: data?.role || 'user'
    }
  } catch (error) {
    console.error('Error getting admin user:', error)
    return null
  }
}

/**
 * Update a user's role (admin only)
 */
export async function updateUserRole(userId: string, role: 'user' | 'admin'): Promise<boolean> {
  try {
    // First check if current user is admin
    const isAdmin = await checkAdminStatus()
    if (!isAdmin) {
      console.error('Only admins can update user roles')
      return false
    }

    const { error } = await supabase
      .from('users')
      .update({ role })
      .eq('id', userId)

    if (error) {
      console.error('Error updating user role:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error updating user role:', error)
    return false
  }
}

/**
 * Get all admin users
 */
export async function getAdminUsers(): Promise<AdminUser[]> {
  try {
    const isAdmin = await checkAdminStatus()
    if (!isAdmin) {
      console.error('Only admins can view admin users')
      return []
    }

    const { data, error } = await supabase
      .from('users')
      .select('id, username, role')
      .eq('role', 'admin')

    if (error) {
      console.error('Error getting admin users:', error)
      return []
    }

    // Get email addresses for admin users
    const adminUsers: AdminUser[] = []
    for (const user of data || []) {
      const { data: authUser } = await supabase.auth.admin.getUserById(user.id)
      adminUsers.push({
        id: user.id,
        email: authUser?.user?.email || '',
        username: user.username,
        role: user.role
      })
    }

    return adminUsers
  } catch (error) {
    console.error('Error getting admin users:', error)
    return []
  }
} 
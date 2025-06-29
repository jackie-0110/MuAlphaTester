'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { checkAdminStatus } from '../utils/adminUtils'

interface AdminRouteProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export default function AdminRoute({ children, fallback }: AdminRouteProps) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const adminStatus = await checkAdminStatus()
        setIsAdmin(adminStatus)
        
        if (!adminStatus) {
          // Redirect to home page if not admin
          router.push('/')
        }
      } catch (error) {
        console.error('Error checking admin status:', error)
        setIsAdmin(false)
        router.push('/')
      } finally {
        setLoading(false)
      }
    }

    checkAdmin()
  }, [router])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!isAdmin) {
    return fallback || (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-lg">
          Access denied. Admin privileges required.
        </div>
      </div>
    )
  }

  return <>{children}</>
} 
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { checkAdminStatus } from '../../utils/adminUtils'
import AdminRoute from '../components/AdminRoute'

export default function AdminDashboard() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const adminStatus = await checkAdminStatus()
        setIsAdmin(adminStatus)
      } catch (error) {
        console.error('Error checking admin status:', error)
        setIsAdmin(false)
      } finally {
        setLoading(false)
      }
    }

    checkAdmin()
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-lg">
          Access denied. Admin privileges required.
        </div>
      </div>
    )
  }

  const adminFeatures = [
    {
      title: 'Flagged Questions',
      description: 'Review and manage questions that have been flagged by users',
      href: '/admin/flags',
      icon: '🚩',
      color: 'bg-red-500'
    },
    {
      title: 'User Management',
      description: 'Manage user roles and permissions',
      href: '/admin/users',
      icon: '👥',
      color: 'bg-blue-500'
    },
    {
      title: 'Import Questions',
      description: 'Import new questions into the database',
      href: '/admin/import',
      icon: '📥',
      color: 'bg-green-500'
    }
  ]

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
        <p className="text-gray-600">Manage your Mu Alpha Tester application</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {adminFeatures.map((feature) => (
          <Link
            key={feature.href}
            href={feature.href}
            className="block group"
          >
            <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow duration-200 border border-gray-200 hover:border-gray-300">
              <div className="flex items-center mb-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl mr-4 ${feature.color} text-white`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {feature.title}
                </h3>
              </div>
              <p className="text-gray-600 mb-4">
                {feature.description}
              </p>
              <div className="flex items-center text-blue-600 group-hover:text-blue-800 transition-colors">
                <span className="text-sm font-medium">Access</span>
                <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </Link>
        ))}
      </div>

              {/* quick stats section */}
      <div className="mt-12 bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Quick Stats</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">3</div>
            <div className="text-sm text-gray-600">Admin Features</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">Active</div>
            <div className="text-sm text-gray-600">System Status</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600">24/7</div>
            <div className="text-sm text-gray-600">Availability</div>
          </div>
        </div>
      </div>
    </div>
  )
} 
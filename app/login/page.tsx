'use client'

import { LoginForm } from '../components/AuthForm'
import { useEffect } from 'react'
import { supabase } from '../../utils/supabase'

export default function LoginPage() {
  useEffect(() => {
    // test supabase connection
    const testConnection = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (error) {
          console.error('Supabase connection error:', error)
        } else {
          console.log('Supabase connected successfully')
        }
      } catch (err) {
        console.error('Failed to connect to Supabase:', err)
      }
    }
    
    testConnection()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Sign in to your account
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <LoginForm/>
        </div>
      </div>
    </div>
  )
} 
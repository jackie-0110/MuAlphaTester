'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../utils/supabase'

export default function DebugDBPage() {
  const [results, setResults] = useState<any>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    testDatabase()
  }, [])

  const testDatabase = async () => {
    const tests: any = {}

    try {
      // Test 1: Check if question_flags table exists
      const { data: flagsData, error: flagsError } = await supabase
        .from('question_flags')
        .select('count')
        .limit(1)
      
      tests.questionFlagsTable = {
        exists: !flagsError,
        error: flagsError?.message || null,
        data: flagsData
      }

      // Test 2: Check if users table exists
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('count')
        .limit(1)
      
      tests.usersTable = {
        exists: !usersError,
        error: usersError?.message || null,
        data: usersData
      }

      // Test 3: Check if questions table exists
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('count')
        .limit(1)
      
      tests.questionsTable = {
        exists: !questionsError,
        error: questionsError?.message || null,
        data: questionsData
      }

      // Test 4: Check current user
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      tests.currentUser = {
        exists: !!user,
        error: userError?.message || null,
        data: user ? { id: user.id, email: user.email } : null
      }

      // Test 5: Check user role if user exists
      if (user) {
        const { data: roleData, error: roleError } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single()
        
        tests.userRole = {
          exists: !roleError,
          error: roleError?.message || null,
          data: roleData
        }
      }

    } catch (error) {
      tests.generalError = {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : null
      }
    }

    setResults(tests)
    setLoading(false)
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
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Database Debug</h1>
      
      <div className="space-y-6">
        {Object.entries(results).map(([testName, result]: [string, any]) => (
          <div key={testName} className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 capitalize">
              {testName.replace(/([A-Z])/g, ' $1').trim()}
            </h2>
            
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="font-medium">Status:</span>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  result.exists ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {result.exists ? 'EXISTS' : 'ERROR'}
                </span>
              </div>
              
              {result.error && (
                <div>
                  <span className="font-medium text-red-600">Error:</span>
                  <p className="text-red-600 text-sm mt-1">{result.error}</p>
                </div>
              )}
              
              {result.data && (
                <div>
                  <span className="font-medium">Data:</span>
                  <pre className="bg-gray-100 p-2 rounded text-sm mt-1 overflow-auto">
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-blue-50 p-4 rounded-lg">
        <h3 className="font-medium text-blue-900 mb-2">Next Steps:</h3>
        <ul className="text-blue-800 text-sm space-y-1">
          <li>• If question_flags table doesn't exist, you need to run the migration</li>
          <li>• If users table doesn't exist, check your database structure</li>
          <li>• If user role is missing, add the role column to your users table</li>
        </ul>
      </div>
    </div>
  )
} 
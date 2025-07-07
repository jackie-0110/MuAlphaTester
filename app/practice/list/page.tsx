'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Toaster } from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import PracticeQuestionTable from '../PracticeQuestionTable'

interface Question {
  id: string
  question_text: string
  options: string[]
  answer: string
  difficulty: number
  topic: string
  division: string
  attempts?: number
  last_attempt?: string
  last_correct?: boolean
}

interface QuestionAttempt {
  attempts: number
  last_attempt: string
  last_correct: boolean
  user_answers: string[]
  is_completed: boolean
  gave_up: boolean
}

export default function ListPracticePage() {
  const router = useRouter()
  const [divisions, setDivisions] = useState<string[]>([])
  const [topics, setTopics] = useState<string[]>([])
  const [selectedDivision, setSelectedDivision] = useState<string>('')
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [restoringState, setRestoringState] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [questionHistory, setQuestionHistory] = useState<Record<string, QuestionAttempt>>({})
  const [searchValue, setSearchValue] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Check URL parameters for practice mode
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const mode = urlParams.get('mode')
      if (mode === 'list') {
        // Already in list mode, load saved state
        loadSavedState()
      }
    }
  }, [])

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true)
        
        // Always load saved state when the component mounts
        loadSavedState()
        
        await Promise.all([
          fetchDivisions(),
        ])
      } catch (error) {
        console.error('Error loading initial data:', error)
        setError('Failed to load initial data')
      } finally {
        setLoading(false)
      }
    }

    loadInitialData()
  }, [])

  // Load saved state from localStorage
  const loadSavedState = () => {
    if (typeof window !== 'undefined') {
      const savedDivision = localStorage.getItem('listPracticeDivision')
      const savedTopics = localStorage.getItem('listPracticeTopics')
      const savedSearch = localStorage.getItem('listPracticeSearch')
      
      if (savedDivision) {
        setSelectedDivision(savedDivision)
      }
      if (savedTopics) {
        try {
          setSelectedTopics(JSON.parse(savedTopics))
        } catch (e) {
          console.error('Error parsing saved topics:', e)
        }
      }
      if (savedSearch) {
        setSearchValue(savedSearch)
      }
    }
  }

  // Load topics when division changes
  useEffect(() => {
    if (selectedDivision) {
      fetchTopics(selectedDivision)
    } else {
      setTopics([])
      setSelectedTopics([])
    }
  }, [selectedDivision])

  // Load questions when division, topics, or search changes
  useEffect(() => {
    if (selectedDivision && selectedTopics.length > 0) {
      // First fetch question history, then fetch questions
      const loadData = async () => {
        await fetchQuestionHistory()
        await fetchQuestions()
      }
      loadData()
    } else {
      setQuestions([])
      setQuestionHistory({})
    }
  }, [selectedDivision, selectedTopics])

  // Save list practice state to localStorage
  const saveListPracticeState = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('listPracticeDivision', selectedDivision)
      localStorage.setItem('listPracticeTopics', JSON.stringify(selectedTopics))
      localStorage.setItem('listPracticeSearch', searchValue)
    }
  }

  // Save state whenever list practice state changes
  useEffect(() => {
    saveListPracticeState()
  }, [selectedDivision, selectedTopics, searchValue])

  // Handle state restoration - load topics and questions when saved state is restored
  useEffect(() => {
    const handleStateRestoration = async () => {
      if (selectedDivision && topics.length === 0) {
        // If we have a saved division but no topics loaded yet, fetch them
        setRestoringState(true)
        await fetchTopics(selectedDivision)
        setRestoringState(false)
      }
      
      if (selectedDivision && selectedTopics.length > 0 && questions.length === 0) {
        // If we have saved division and topics but no questions, fetch them
        setRestoringState(true)
        await fetchQuestions()
        setRestoringState(false)
      }
    }

    handleStateRestoration()
  }, [selectedDivision, selectedTopics, topics.length, questions.length])

  const fetchDivisions = async () => {
    try {
      const { data, error } = await supabase
        .from('questions')
        .select('division')
        .order('division')

      if (error) throw error

      const uniqueDivisions = [...new Set(data?.map(q => q.division) || [])]
      setDivisions(uniqueDivisions)
    } catch (error) {
      console.error('Error fetching divisions:', error)
    }
  }

  const fetchTopics = async (division: string) => {
    try {
      const { data, error } = await supabase
        .from('questions')
        .select('topic')
        .eq('division', division)
        .order('topic')

      if (error) throw error

      const uniqueTopics = [...new Set(data?.map(q => q.topic) || [])]
      setTopics(uniqueTopics)
      
      // Preserve selected topics that are still valid for this division
      setSelectedTopics(prevSelected => 
        prevSelected.filter(topic => uniqueTopics.includes(topic))
      )
    } catch (error) {
      console.error('Error fetching topics:', error)
    }
  }

  const fetchQuestionHistory = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        console.log('No session found, returning empty history')
        return {}
      }

      console.log('Fetching question history for division:', selectedDivision, 'topics:', selectedTopics)

      // Query practice_attempts to get all attempts for this user, division, and topics
      let query = supabase
        .from('question_attempts')
        .select('question_id, is_correct')
        .eq('user_id', session.user.id)
        .eq('division', selectedDivision)

      if (selectedTopics.length > 0) {
        query = query.in('topic', selectedTopics)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching question history:', error)
        return {}
      }

      console.log('Raw practice attempts data:', data)

      // Process the data to determine status for each question
      const history: Record<string, QuestionAttempt> = {}
      
      data?.forEach(attempt => {
        const questionId = attempt.question_id
        
        if (!history[questionId]) {
          history[questionId] = {
            attempts: 0,
            last_attempt: '',
            last_correct: false,
            user_answers: [],
            is_completed: false,
            gave_up: false
          }
        }
        
        history[questionId].attempts++
        history[questionId].last_correct = attempt.is_correct
        
        // If any attempt was correct, mark as completed
        if (attempt.is_correct) {
          history[questionId].is_completed = true
        }
      })

      console.log('Processed question history:', history)
      setQuestionHistory(history)
      return history
    } catch (error) {
      console.error('Error in fetchQuestionHistory:', error)
      return {}
    }
  }

  const fetchQuestions = async () => {
    try {
      setLoading(true)
      setError(null)

      let query = supabase
        .from('questions')
        .select('id, question_text, options, answer, division, topic, difficulty')
        .eq('division', selectedDivision)

      if (selectedTopics.length > 0) {
        query = query.in('topic', selectedTopics)
      }

      const { data: questionsData, error: questionsError } = await query.limit(200).order('id')

      if (questionsError) {
        console.error('Error fetching questions:', questionsError)
        throw questionsError
      }

      if (!questionsData || questionsData.length === 0) {
        setError('No questions available for the selected topics')
        return
      }

      // Use the history data directly
      const questionsWithHistory = questionsData.map(q => ({
        ...q,
        completed: questionHistory[q.id]?.last_correct || false,
        correct: questionHistory[q.id]?.last_correct || false
      }))

      setQuestions(questionsWithHistory)
    } catch (error: any) {
      console.error('Error fetching questions:', error)
      setError(error.message || 'Failed to fetch questions')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading practice questions...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (restoringState) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Restoring your previous selections...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (error) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Questions</h3>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => {
                saveListPracticeState();
                router.push('/practice');
              }}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Back to Practice Hub
            </button>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => {
                    saveListPracticeState();
                    router.push('/practice');
                  }}
                  className="flex items-center text-blue-600 hover:text-blue-700 transition-colors"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to Practice Hub
                </button>
                <h1 className="text-2xl font-bold text-gray-900">List Practice</h1>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500 hidden sm:block">
                  {questions.length} questions available
                </span>
                {/* Mobile sidebar toggle */}
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="sm:hidden p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-6">
          <div className="flex gap-6">
            {/* Sidebar */}
            <div className={`${sidebarOpen ? 'fixed inset-0 z-50' : 'hidden'} sm:block sm:relative sm:inset-auto sm:z-auto`}>
              {/* Mobile overlay */}
              {sidebarOpen && (
                <div 
                  className="fixed inset-0 bg-black bg-opacity-50 sm:hidden"
                  onClick={() => setSidebarOpen(false)}
                />
              )}
              
              {/* Sidebar content */}
              <div className={`${sidebarOpen ? 'fixed left-0 top-0 h-full w-80' : 'hidden'} sm:block sm:relative sm:h-auto sm:w-80 flex-shrink-0`}>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 h-full sm:sticky sm:top-6 overflow-y-auto">
                  <div className="flex items-center justify-between mb-4 sm:hidden">
                    <h2 className="text-lg font-semibold text-gray-900">Filter Questions</h2>
                    <button
                      onClick={() => setSidebarOpen(false)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 hidden sm:block">Filter Questions</h2>
                  
                  {/* Division Selection */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Division
                    </label>
                    <select
                      value={selectedDivision}
                      onChange={(e) => {
                        setSelectedDivision(e.target.value)
                        setSelectedTopics([])
                      }}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    >
                      <option value="">Select a division</option>
                      {divisions.map((division) => (
                        <option key={division} value={division}>
                          {division}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Topic Selection */}
                  {selectedDivision && (
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Topics
                      </label>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {topics.map((topic) => (
                          <label key={topic} className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedTopics.includes(topic)}
                              onChange={(e) => {
                                const newTopics = e.target.checked
                                  ? [...selectedTopics, topic]
                                  : selectedTopics.filter(t => t !== topic)
                                setSelectedTopics(newTopics)
                              }}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">{topic}</span>
                          </label>
                        ))}
                      </div>
                      <p className="text-sm text-gray-500 mt-2">
                        {selectedTopics.length} topic(s) selected
                      </p>
                    </div>
                  )}

                  {/* Search */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Search Questions
                    </label>
                    <input
                      type="text"
                      placeholder="Search by question text..."
                      value={searchValue}
                      onChange={(e) => {
                        setSearchValue(e.target.value)
                      }}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {/* Clear Filters */}
                  {(selectedTopics.length > 0 || searchValue) && (
                    <button
                      onClick={() => {
                        setSelectedTopics([])
                        setSearchValue('')
                        if (typeof window !== 'undefined') {
                          localStorage.removeItem('listPracticeTopics')
                          localStorage.removeItem('listPracticeSearch')
                        }
                      }}
                      className="w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1">
              {selectedDivision && selectedTopics.length > 0 && questions.length > 0 && (
                <PracticeQuestionTable
                  questions={questions}
                  questionHistory={questionHistory}
                  onFlag={(question: Question) => {
                    console.log('Flagged question:', question.id)
                  }}
                  onAnswer={(question: Question, answer: string) => {
                    console.log('Answered question:', question.id, answer)
                  }}
                  topics={topics}
                  selectedTopics={selectedTopics}
                  setSelectedTopics={setSelectedTopics}
                  searchValue={searchValue}
                  setSearchValue={setSearchValue}
                />
              )}

              {selectedDivision && selectedTopics.length > 0 && questions.length === 0 && !loading && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                  <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No Questions Found</h3>
                  <p className="text-gray-600">
                    No questions available for the selected topics. Try selecting different topics.
                  </p>
                </div>
              )}

              {(!selectedDivision || selectedTopics.length === 0) && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                  <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Select Topics to Start</h3>
                  <p className="text-gray-600">
                    Choose a division and topics from the sidebar to view available questions.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
} 
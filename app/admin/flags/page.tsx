'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../utils/supabase'
import { toast, Toaster } from 'react-hot-toast'
import 'katex/dist/katex.min.css'
import renderMathInElement from 'katex/dist/contrib/auto-render'

interface FlaggedQuestion {
  id: string
  question_id: string
  user_id: string
  flag_type: string
  description: string | null
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed'
  admin_notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  question: {
    question_text: string
    answer: string
    options: string[]
    division: string
    topic: string
  }
  user?: {
    username: string
  }
}

const FLAG_TYPE_LABELS = {
  incorrect_answer: 'Incorrect Answer',
  wrong_latex: 'Wrong LaTeX/Math',
  typo: 'Typo/Spelling Error',
  unclear_question: 'Unclear Question',
  duplicate: 'Duplicate Question',
  other: 'Other Issue'
}

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  reviewed: 'bg-blue-100 text-blue-800',
  resolved: 'bg-green-100 text-green-800',
  dismissed: 'bg-gray-100 text-gray-800'
}

function KatexContent({ text }: { text: string }) {
  const elementRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (elementRef.current) {
      renderMathInElement(elementRef.current, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
        ],
      })
    }
  }, [text])

  return <div ref={elementRef} dangerouslySetInnerHTML={{ __html: text }} />
}

function renderLatex(text: string) {
  return <KatexContent text={text} />
}

export default function AdminFlagsPage() {
  const [flags, setFlags] = useState<FlaggedQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['pending', 'reviewed', 'resolved', 'dismissed'])
  const [selectedFlagTypes, setSelectedFlagTypes] = useState<string[]>(['incorrect_answer', 'wrong_latex', 'typo', 'unclear_question', 'duplicate', 'other'])
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({})
  const [isAdmin, setIsAdmin] = useState(false)
  const [editingFlag, setEditingFlag] = useState<string | null>(null)
  const [expandedFlags, setExpandedFlags] = useState<Set<string>>(new Set())
  const [editForm, setEditForm] = useState<{
    question_text: string
    answer: string
    options: string[]
    division: string
    topic: string
  }>({
    question_text: '',
    answer: '',
    options: [],
    division: '',
    topic: ''
  })

  useEffect(() => {
    checkAdminStatus()
    fetchFlags()
  }, [])

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

      if (error) return

      setIsAdmin(data.role === 'admin')
    } catch (error) {
      console.error('Error checking admin status:', error)
    }
  }

  const fetchFlags = async () => {
    try {
      setLoading(true)
      
      // First, let's try a simple query without joins
      const { data, error } = await supabase
        .from('question_flags')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error in simple query:', error)
        throw error
      }

      console.log('Flags data:', data)

      // If simple query works, try with question join
      if (data && data.length > 0) {
        const { data: fullData, error: fullError } = await supabase
          .from('question_flags')
          .select(`
            *,
            question:questions(
              question_text,
              answer,
              options,
              division,
              topic
            )
          `)
          .order('created_at', { ascending: false })

        if (fullError) {
          console.error('Error in full query:', fullError)
          // Use the simple data if the full query fails
          setFlags(data.map(flag => ({
            ...flag,
            question: { question_text: 'Question not found', answer: '', options: [], division: '', topic: '' },
            user: { username: 'Unknown' }
          })))
        } else {
          console.log('Full data:', fullData)
          setFlags(fullData || [])
        }
      } else {
        setFlags([])
      }
    } catch (error) {
      console.error('Error fetching flags:', error)
      toast.error('Failed to load flagged questions')
    } finally {
      setLoading(false)
    }
  }

  const updateFlagStatus = async (flagId: string, status: string, notes?: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('question_flags')
        .update({
          status,
          admin_notes: notes || null,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', flagId)

      if (error) throw error

      toast.success('Flag status updated successfully')
      fetchFlags()
    } catch (error) {
      console.error('Error updating flag status:', error)
      toast.error('Failed to update flag status')
    }
  }

  const startEditing = (flag: FlaggedQuestion) => {
    setEditingFlag(flag.id)
    setEditForm({
      question_text: flag.question.question_text,
      answer: flag.question.answer,
      options: flag.question.options || [],
      division: flag.question.division,
      topic: flag.question.topic
    })
  }

  const cancelEditing = () => {
    setEditingFlag(null)
    setEditForm({
      question_text: '',
      answer: '',
      options: [],
      division: '',
      topic: ''
    })
  }

  const saveQuestionEdit = async (flagId: string) => {
    try {
      // Find the flag to get the question_id
      const flag = flags.find(f => f.id === flagId)
      if (!flag) {
        toast.error('Flag not found')
        return
      }

      console.log('Updating question:', flag.question_id, 'with data:', editForm)

      const { data, error } = await supabase
        .from('questions')
        .update({
          question_text: editForm.question_text,
          answer: editForm.answer,
          options: editForm.options,
          division: editForm.division,
          topic: editForm.topic
        })
        .eq('id', flag.question_id)
        .select()

      if (error) {
        console.error('Supabase error:', error)
        throw error
      }

      console.log('Update result:', data)

      toast.success('Question updated successfully')
      cancelEditing()
      fetchFlags()
    } catch (error) {
      console.error('Error updating question:', error)
      toast.error('Failed to update question')
    }
  }

  const addOption = () => {
    setEditForm(prev => ({
      ...prev,
      options: [...prev.options, '']
    }))
  }

  const removeOption = (index: number) => {
    setEditForm(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }))
  }

  const updateOption = (index: number, value: string) => {
    setEditForm(prev => ({
      ...prev,
      options: prev.options.map((option, i) => i === index ? value : option)
    }))
  }

  const toggleFlagExpansion = (flagId: string) => {
    setExpandedFlags(prev => {
      const newSet = new Set(prev)
      if (newSet.has(flagId)) {
        newSet.delete(flagId)
      } else {
        newSet.add(flagId)
      }
      return newSet
    })
  }

  const toggleStatusFilter = (status: string) => {
    setSelectedStatuses(prev => {
      if (prev.includes(status)) {
        return prev.filter(s => s !== status)
      } else {
        return [...prev, status]
      }
    })
  }

  const toggleFlagTypeFilter = (flagType: string) => {
    setSelectedFlagTypes(prev => {
      if (prev.includes(flagType)) {
        return prev.filter(t => t !== flagType)
      } else {
        return [...prev, flagType]
      }
    })
  }

  const selectAllStatuses = () => {
    setSelectedStatuses(['pending', 'reviewed', 'resolved', 'dismissed'])
  }

  const clearAllStatuses = () => {
    setSelectedStatuses([])
  }

  const selectAllFlagTypes = () => {
    setSelectedFlagTypes(['incorrect_answer', 'wrong_latex', 'typo', 'unclear_question', 'duplicate', 'other'])
  }

  const clearAllFlagTypes = () => {
    setSelectedFlagTypes([])
  }

  const filteredFlags = flags.filter(flag => {
    if (selectedStatuses.includes(flag.status) && selectedFlagTypes.includes(flag.flag_type)) return true
    return false
  })

  if (!isAdmin) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-lg">
          Access denied. Admin privileges required.
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Toaster />
      
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Flagged Questions</h1>
        <p className="text-gray-600">Review and manage questions flagged by users</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar Filters */}
        <div className="w-64 flex-shrink-0">
          <div className="bg-white rounded-lg shadow-lg p-6 sticky top-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Filters</h3>
            
            {/* Status Filters */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-sm font-medium text-gray-700">Status</h4>
                <div className="flex space-x-1">
                  <button
                    onClick={selectAllStatuses}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    All
                  </button>
                  <span className="text-gray-400">|</span>
                  <button
                    onClick={clearAllStatuses}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    None
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {Object.entries(STATUS_COLORS).map(([status, colorClass]) => (
                  <label key={status} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedStatuses.includes(status)}
                      onChange={() => toggleStatusFilter(status)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${colorClass}`}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Flag Type Filters */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-sm font-medium text-gray-700">Flag Type</h4>
                <div className="flex space-x-1">
                  <button
                    onClick={selectAllFlagTypes}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    All
                  </button>
                  <span className="text-gray-400">|</span>
                  <button
                    onClick={clearAllFlagTypes}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    None
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {Object.entries(FLAG_TYPE_LABELS).map(([type, label]) => (
                  <label key={type} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedFlagTypes.includes(type)}
                      onChange={() => toggleFlagTypeFilter(type)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Results Count */}
            <div className="pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Showing {filteredFlags.length} of {flags.length} flags
              </p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredFlags.length === 0 ? (
                <div className="bg-white p-6 rounded-lg shadow-lg text-center text-gray-500">
                  No flagged questions found
                </div>
              ) : (
                filteredFlags.map((flag) => (
                  <div key={flag.id} className="bg-white rounded-lg shadow-lg overflow-hidden">
                    {/* Flag Header - Always Visible */}
                    <div 
                      className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => toggleFlagExpansion(flag.id)}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-3">
                          <svg 
                            className={`w-5 h-5 transition-transform ${expandedFlags.has(flag.id) ? 'rotate-90' : ''}`}
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[flag.status]}`}>
                              {flag.status.charAt(0).toUpperCase() + flag.status.slice(1)}
                            </span>
                            <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                              {FLAG_TYPE_LABELS[flag.flag_type as keyof typeof FLAG_TYPE_LABELS]}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">
                            {flag.user?.username || 'Unknown'} • {new Date(flag.created_at).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-gray-400">
                            {flag.question.division} - {flag.question.topic}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Collapsible Content */}
                    {expandedFlags.has(flag.id) && (
                      <div className="border-t border-gray-200 p-4">
                        {/* Question Content */}
                        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                          <div className="flex justify-between items-center mb-4">
                            <h3 className="font-medium text-gray-900">Question:</h3>
                            {editingFlag === flag.id ? (
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => saveQuestionEdit(flag.id)}
                                  className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={cancelEditing}
                                  className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => startEditing(flag)}
                                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                              >
                                Edit Question
                              </button>
                            )}
                          </div>

                          {editingFlag === flag.id ? (
                            // Edit Mode
                            <div className="space-y-4">
                              {/* Question Text */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Question Text
                                </label>
                                <textarea
                                  value={editForm.question_text}
                                  onChange={(e) => setEditForm(prev => ({ ...prev, question_text: e.target.value }))}
                                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  rows={3}
                                />
                              </div>

                              {/* Division and Topic */}
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Division
                                  </label>
                                  <input
                                    type="text"
                                    value={editForm.division}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, division: e.target.value }))}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Topic
                                  </label>
                                  <input
                                    type="text"
                                    value={editForm.topic}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, topic: e.target.value }))}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  />
                                </div>
                              </div>

                              {/* Options */}
                              <div>
                                <div className="flex justify-between items-center mb-2">
                                  <label className="block text-sm font-medium text-gray-700">
                                    Options
                                  </label>
                                  <button
                                    type="button"
                                    onClick={addOption}
                                    className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                                  >
                                    Add Option
                                  </button>
                                </div>
                                <div className="space-y-2">
                                  {editForm.options.map((option, index) => (
                                    <div key={index} className="flex items-center space-x-2">
                                      <span className="font-medium text-sm w-6">{String.fromCharCode(65 + index)}.</span>
                                      <input
                                        type="text"
                                        value={option}
                                        onChange={(e) => updateOption(index, e.target.value)}
                                        className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder={`Option ${String.fromCharCode(65 + index)}`}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => removeOption(index)}
                                        className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Correct Answer */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Correct Answer
                                </label>
                                <input
                                  type="text"
                                  value={editForm.answer}
                                  onChange={(e) => setEditForm(prev => ({ ...prev, answer: e.target.value }))}
                                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                              </div>
                            </div>
                          ) : (
                            // View Mode
                            <>
                              <div className="text-gray-700 mb-3">
                                {renderLatex(flag.question.question_text)}
                              </div>
                              
                              {flag.question.options && flag.question.options.length > 0 && (
                                <div className="mb-3">
                                  <h4 className="font-medium text-gray-900 mb-1">Options:</h4>
                                  <div className="space-y-1">
                                    {flag.question.options.map((option, index) => (
                                      <div key={index} className="flex items-center space-x-2">
                                        <span className="font-medium">{String.fromCharCode(65 + index)}.</span>
                                        <span>{renderLatex(option)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              <div>
                                <h4 className="font-medium text-gray-900 mb-1">Correct Answer:</h4>
                                <p className="text-gray-700">{renderLatex(flag.question.answer)}</p>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Flag Description */}
                        {flag.description && (
                          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <h3 className="font-medium text-yellow-800 mb-2">User's Description:</h3>
                            <p className="text-yellow-700">{flag.description}</p>
                          </div>
                        )}

                        {/* Admin Notes */}
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Admin Notes
                          </label>
                          <textarea
                            value={adminNotes[flag.id] || flag.admin_notes || ''}
                            onChange={(e) => setAdminNotes(prev => ({ ...prev, [flag.id]: e.target.value }))}
                            placeholder="Add notes about this flag..."
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            rows={3}
                          />
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap gap-2">
                          {flag.status === 'pending' && (
                            <>
                              <button
                                onClick={() => updateFlagStatus(flag.id, 'reviewed', adminNotes[flag.id])}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                              >
                                Mark as Reviewed
                              </button>
                              <button
                                onClick={() => updateFlagStatus(flag.id, 'resolved', adminNotes[flag.id])}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                              >
                                Mark as Resolved
                              </button>
                              <button
                                onClick={() => updateFlagStatus(flag.id, 'dismissed', adminNotes[flag.id])}
                                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
                              >
                                Dismiss Flag
                              </button>
                            </>
                          )}
                          {flag.status === 'reviewed' && (
                            <>
                              <button
                                onClick={() => updateFlagStatus(flag.id, 'resolved', adminNotes[flag.id])}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                              >
                                Mark as Resolved
                              </button>
                              <button
                                onClick={() => updateFlagStatus(flag.id, 'dismissed', adminNotes[flag.id])}
                                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
                              >
                                Dismiss Flag
                              </button>
                            </>
                          )}
                          {(flag.status === 'resolved' || flag.status === 'dismissed') && (
                            <button
                              onClick={() => updateFlagStatus(flag.id, 'pending', adminNotes[flag.id])}
                              className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm"
                            >
                              Reopen Flag
                            </button>
                          )}
                        </div>

                        {/* Review Info */}
                        {flag.reviewed_by && (
                          <div className="mt-4 text-sm text-gray-500">
                            Reviewed by {flag.reviewed_by} on {new Date(flag.reviewed_at!).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 
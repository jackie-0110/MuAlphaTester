'use client'

import { useState } from 'react'
import { supabase } from '../../utils/supabase'
import { toast } from 'react-hot-toast'

interface FlagQuestionProps {
  questionId: string
  questionText: string
  onFlagged?: () => void
}

const FLAG_TYPES = [
  { value: 'incorrect_answer', label: 'Incorrect Answer' },
  { value: 'wrong_latex', label: 'Wrong LaTeX/Math' },
  { value: 'typo', label: 'Typo/Spelling Error' },
  { value: 'unclear_question', label: 'Unclear Question' },
  { value: 'duplicate', label: 'Duplicate Question' },
  { value: 'other', label: 'Other Issue' }
]

export default function FlagQuestion({ questionId, questionText, onFlagged }: FlagQuestionProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [flagType, setFlagType] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!flagType) {
      toast.error('Please select a flag type')
      return
    }

    try {
      setIsSubmitting(true)
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('You must be logged in to flag questions')
        return
      }

      const { error } = await supabase
        .from('question_flags')
        .insert({
          question_id: questionId,
          user_id: user.id,
          flag_type: flagType,
          description: description.trim() || null
        })

      if (error) {
        if (error.message.includes('already flagged')) {
          toast.error('You have already flagged this question')
        } else {
          throw error
        }
        return
      }

      toast.success('Question flagged successfully! Thank you for your feedback.')
      setIsOpen(false)
      setFlagType('')
      setDescription('')
      onFlagged?.()
    } catch (error: any) {
      console.error('Error flagging question:', error)
      toast.error('Failed to flag question. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="relative">
      {/* Flag Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center px-3 py-1 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors"
        title="Flag this question"
      >
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2z" />
        </svg>
        Flag
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Flag Question</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Question Preview */}
              <div className="bg-gray-50 p-3 rounded-md">
                <p className="text-sm text-gray-600 mb-1">Question:</p>
                <p className="text-sm text-gray-900 line-clamp-3">{questionText}</p>
              </div>

              {/* Flag Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Issue Type *
                </label>
                <select
                  value={flagType}
                  onChange={(e) => setFlagType(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select an issue type</option>
                  {FLAG_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Details (Optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Please provide more details about the issue..."
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                />
              </div>

              {/* Buttons */}
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !flagType}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Flag'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
} 
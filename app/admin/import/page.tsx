'use client'

import { useState } from 'react'
import { importQuestions } from '../../utils/importQuestions'
import { toast } from 'react-hot-toast'

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [importedCount, setImportedCount] = useState(0)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleImport = async () => {
    if (!file) {
      toast.error('Please select a file first')
      return
    }

    try {
      setLoading(true)
      const text = await file.text()
      const questions = JSON.parse(text)

      // Validate questions format
      if (!Array.isArray(questions)) {
        throw new Error('File must contain an array of questions')
      }

      // Add required fields if missing
      const processedQuestions = questions.map(q => ({
        ...q,
        division: q.division || 'Uncategorized',
        topic: q.topic || 'General',
        difficulty: q.difficulty || 1
      }))

      const result = await importQuestions(processedQuestions)
      
      if (result.success) {
        setImportedCount(processedQuestions.length)
        toast.success(`Successfully imported ${processedQuestions.length} questions!`)
        setFile(null)
      } else {
        throw result.error
      }
    } catch (error: any) {
      console.error('Import error:', error)
      toast.error(error.message || 'Failed to import questions')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Import Questions</h1>
      
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select JSON File
          </label>
          <input
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {file && (
            <p className="mt-2 text-sm text-gray-500">
              Selected file: {file.name}
            </p>
          )}
        </div>

        <button
          onClick={handleImport}
          disabled={!file || loading}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Importing...' : 'Import Questions'}
        </button>

        {importedCount > 0 && (
          <div className="mt-4 p-4 bg-green-50 text-green-700 rounded-lg border border-green-200">
            Successfully imported {importedCount} questions!
          </div>
        )}
      </div>

      <div className="mt-8 bg-white p-6 rounded-lg shadow-lg">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">File Format</h2>
        <p className="text-gray-600 mb-4">
          Your JSON file should contain an array of questions in the following format:
        </p>
        <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto">
          {`[
  {
    "question_text": "Your question here",
    "answer_choices": {
      "A": "First choice",
      "B": "Second choice",
      "C": "Third choice",
      "D": "Fourth choice",
      "E": "None of the above"
    },
    "division": "Category name",
    "topic": "Specific topic",
    "difficulty": 1
  }
]`}
        </pre>
        <p className="mt-4 text-sm text-gray-500">
          Note: division, topic, and difficulty are optional. If not provided, they will be set to default values.
        </p>
      </div>
    </div>
  )
} 
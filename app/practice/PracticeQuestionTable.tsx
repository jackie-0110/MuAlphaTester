import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import FlagQuestion from '../components/FlagQuestion'
import { logQuestionAttempt } from '@/app/utils/logQuestionAttempt'
import { supabase } from '@/utils/supabase'

interface PracticeQuestionTableProps {
  questions: any[]
  questionHistory: Record<string, any>
  onFlag: (question: any) => void
  onAnswer: (question: any, answer: string) => void
  topics: string[]
  selectedTopics: string[]
  setSelectedTopics: (topics: string[]) => void
  searchValue: string
  setSearchValue: (v: string) => void
}

export default function PracticeQuestionTable({
  questions,
  questionHistory,
  onFlag,
  onAnswer,
  topics,
  selectedTopics,
  setSelectedTopics,
  searchValue,
  setSearchValue,
}: PracticeQuestionTableProps) {
  const router = useRouter()
  const [page, setPage] = useState(1)
  const pageSize = 10

  // Debug logging
  console.log('PracticeQuestionTable received questionHistory:', questionHistory)
  console.log('PracticeQuestionTable received questions:', questions.length)

  // Filter and search
  const filtered = useMemo(() => {
    let q = questions
    if (selectedTopics.length > 0) {
      q = q.filter(qn => selectedTopics.includes(qn.topic))
    }
    if (searchValue.trim()) {
      q = q.filter(qn => qn.question_text.toLowerCase().includes(searchValue.toLowerCase()))
    }
    return q
  }, [questions, selectedTopics, searchValue])

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page])

  const totalPages = Math.ceil(filtered.length / pageSize)

  const handleQuestionClick = (question: any) => {
    router.push(`/practice/question/${question.id}`)
  }

  const handleAnswer = async (question: any, answer: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await logQuestionAttempt({
          userId: session.user.id,
          questionId: question.id,
          division: question.division,
          topic: question.topic,
          attempts: 1, // For now, always 1 per submission
          gaveUp: false,
          userAnswers: [answer],
        });
      }
    } catch (err) {
      console.error('Failed to log question attempt:', err);
    }
    // Call the original onAnswer prop if needed
    onAnswer(question, answer);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Table header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Questions ({filtered.length} total)
          </h3>
          <div className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </div>
        </div>
      </div>
      
      {/* Table */}
      <div className="overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-5 gap-4 px-6 py-3 text-sm font-semibold text-gray-600 border-b border-gray-100 bg-gray-50">
          <div>Question</div>
          <div>Topic</div>
          <div>Difficulty</div>
          <div>Status</div>
          <div>Actions</div>
        </div>
        
        {/* Table rows */}
        {paginated.map((q, i) => (
          <div
            key={q.id}
            className="grid grid-cols-5 gap-4 px-6 py-4 items-center border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
            onClick={() => handleQuestionClick(q)}
          >
            <div className="truncate max-w-xs" title={q.question_text}>
              <div className="font-medium text-gray-900">{q.question_text}</div>
            </div>
            <div className="text-sm text-gray-600">{q.topic}</div>
            <div>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                q.difficulty <= 3 
                  ? 'bg-green-100 text-green-800' 
                  : q.difficulty <= 6 
                    ? 'bg-yellow-100 text-yellow-800' 
                    : 'bg-red-100 text-red-800'
              }`}>
                {q.difficulty <= 3 ? 'Easy' : q.difficulty <= 6 ? 'Medium' : 'Hard'}
              </span>
            </div>
            <div>
              {(() => {
                const history = questionHistory[q.id]
                
                console.log(`Question ${q.id} status:`, {
                  history,
                  hasAttempts: !!history,
                  isCompleted: history?.is_completed,
                  lastCorrect: history?.last_correct
                })
                
                // If no history exists, question is unattempted
                if (!history) {
                  return (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      Unattempted
                    </span>
                  )
                }
                
                // If history exists and any attempt was correct, question is solved
                if (history.is_completed) {
                  return (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Solved
                    </span>
                  )
                }
                
                // If history exists but no correct attempts, question was attempted but wrong
                return (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    Attempted
                  </span>
                )
              })()}
            </div>
            <div onClick={e => { e.stopPropagation(); onFlag(q); }}>
              <FlagQuestion questionId={q.id} questionText={q.question_text} />
            </div>
          </div>
        ))}
        
        {paginated.length === 0 && (
          <div className="px-6 py-8 text-center text-gray-500">
            No questions match your current filters.
          </div>
        )}
      </div>
      
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center px-6 py-4 border-t border-gray-200">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <div className="flex items-center space-x-2">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = Math.max(1, Math.min(totalPages - 4, page - 2)) + i
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    page === pageNum
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {pageNum}
                </button>
              )
            })}
          </div>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
} 
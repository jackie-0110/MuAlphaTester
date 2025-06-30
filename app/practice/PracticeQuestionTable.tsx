import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import FlagQuestion from '../components/FlagQuestion'

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

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200">
      {/* Search and filter bar */}
      <div className="flex flex-wrap items-center gap-2 p-4 border-b border-gray-100">
        <input
          type="text"
          placeholder="Search questions..."
          value={searchValue}
          onChange={e => setSearchValue(e.target.value)}
          className="p-2 border rounded w-64"
        />
        <select
          multiple
          value={selectedTopics}
          onChange={e => setSelectedTopics(Array.from(e.target.selectedOptions, o => o.value))}
          className="p-2 border rounded min-w-[120px]"
        >
          {topics.map(topic => (
            <option key={topic} value={topic}>{topic}</option>
          ))}
        </select>
      </div>
      {/* Table header */}
      <div className="grid grid-cols-5 gap-2 px-4 py-2 text-xs font-semibold text-gray-600 border-b border-gray-100">
        <div>Title</div>
        <div>Topic</div>
        <div>Difficulty</div>
        <div>Status</div>
        <div>Flag</div>
      </div>
      {/* Table rows */}
      {paginated.map((q, i) => (
        <div
          key={q.id}
          className="grid grid-cols-5 gap-2 px-4 py-3 items-center border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
          onClick={() => handleQuestionClick(q)}
        >
          <div className="truncate max-w-xs" title={q.question_text}>{q.question_text}</div>
          <div className="text-sm text-gray-600">{q.topic}</div>
          <div>{q.difficulty <= 3 ? 'Easy' : q.difficulty <= 6 ? 'Medium' : 'Hard'}</div>
          <div>{questionHistory[q.id]?.last_correct ? 'Solved' : 'Unsolved'}</div>
          <div onClick={e => { e.stopPropagation(); onFlag(q); }}>
            <FlagQuestion questionId={q.id} questionText={q.question_text} />
          </div>
        </div>
      ))}
      {/* Pagination */}
      <div className="flex justify-between items-center p-4">
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >Prev</button>
        <span>Page {page} of {totalPages}</span>
        <button
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >Next</button>
      </div>
    </div>
  )
} 
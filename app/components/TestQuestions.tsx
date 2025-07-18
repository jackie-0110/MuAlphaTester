'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../utils/supabase'
import 'katex/dist/katex.min.css'
import renderMathInElement from 'katex/dist/contrib/auto-render'

interface Question {
  id: string
  question_text: string
  options: string[]
  answer: string
  division: string
  topic: string
  difficulty: number
}

function KatexContent({ text }: { text: string }) {
  const katexRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (katexRef.current) {
      renderMathInElement(katexRef.current, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
        ],
        throwOnError: false,
        output: 'html',
      })
    }
  }, [text])

  return <div ref={katexRef}>{text}</div>
}

export function TestQuestions() {
  const [divisions, setDivisions] = useState<string[]>([])
  const [topics, setTopics] = useState<string[]>([])
  const [selectedDivision, setSelectedDivision] = useState<string>('')
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [difficultyRange, setDifficultyRange] = useState<[number, number]>([0, 10])
  const [numProblems, setNumProblems] = useState<number>(5)
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    fetchDivisions()
  }, [])

  useEffect(() => {
    if (selectedDivision) {
      fetchTopics(selectedDivision)
    }
  }, [selectedDivision])

  useEffect(() => {
    if (isPrinting) {
      document.body.classList.add('printing-mode');
    } else {
      document.body.classList.remove('printing-mode');
    }
    
    return () => {
      document.body.classList.remove('printing-mode');
    };
  }, [isPrinting]);

  const fetchDivisions = async () => {
    try {
      const { data, error } = await supabase
        .from('questions')
        .select('division')
        .order('division')

      if (error) throw error

      const uniqueDivisions = [...new Set(data.map(d => d.division))]
      setDivisions(uniqueDivisions)
    } catch (error) {
      console.error('Error fetching divisions:', error)
      setError('Failed to load divisions')
    } finally {
      setLoading(false)
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

      const uniqueTopics = [...new Set(data.map(t => t.topic))]
      setTopics(uniqueTopics)
      setSelectedTopics([])
    } catch (error) {
      console.error('Error fetching topics:', error)
      setError('Failed to load topics')
    }
  }

  const handleDifficultyChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'min' | 'max') => {
    const value = parseInt(e.target.value)
    if (type === 'min') {
      if (value < difficultyRange[1]) {
        setDifficultyRange([value, difficultyRange[1]])
      }
    } else {
      if (value > difficultyRange[0]) {
        setDifficultyRange([difficultyRange[0], value])
      }
    }
  }

  const fetchQuestions = async () => {
    if (!selectedDivision || selectedTopics.length === 0) {
      setError('Please select a division and at least one topic')
      return
    }

    try {
      setLoading(true)
      setError(null)

      console.log('Fetching questions with params:', {
        division: selectedDivision,
        topics: selectedTopics,
        difficultyRange,
        numProblems
      })

      // fetch more questions than needed to ensure we have enough to randomize
      const fetchCount = Math.min(numProblems * 3, 100); // limit to 100 max for performance
      
      let query = supabase
        .from('questions')
        .select('id, division, topic, difficulty, question_text, answer, options')
        .eq('division', selectedDivision)
        .in('topic', selectedTopics)
        .gte('difficulty', difficultyRange[0])
        .lte('difficulty', difficultyRange[1])
        .order('id') 
        .limit(fetchCount)

      const { data, error } = await query

      console.log('Query response:', { data, error })

      if (error) {
        console.error('Supabase error:', error)
        throw error
      }

      if (!data || !Array.isArray(data)) {
        console.error('No data returned or invalid data format:', data)
        throw new Error('No questions found')
      }

      const validatedQuestions = data.map(question => ({
        ...question,
        options: Array.isArray(question.options) ? question.options : [],
        answer: question.answer || '',
        question_text: question.question_text || '',
      }))

      // randomize the questions using fisher-yates shuffle algorithm
      const shuffledQuestions = [...validatedQuestions];
      for (let i = shuffledQuestions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledQuestions[i], shuffledQuestions[j]] = [shuffledQuestions[j], shuffledQuestions[i]];
      }

      // take only the number of problems requested
      const selectedQuestions = shuffledQuestions.slice(0, numProblems);

      console.log('Randomized questions:', selectedQuestions)
      setQuestions(selectedQuestions)
    } catch (error) {
      console.error('Error fetching questions:', error)
      setError('Failed to load questions: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  const handleTopicChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const options = e.target.options;
    const selectedValues: string[] = [];
    
    for (let i = 0; i < options.length; i++) {
      if (options[i].selected) {
        selectedValues.push(options[i].value);
      }
    }
    
    setSelectedTopics(selectedValues);
  }

  const handlePrint = () => {
    setIsPrinting(true);
    
          // use setTimeout to ensure the state updates before printing
    setTimeout(() => {
      window.print();
      // return to normal view after print dialog closes
      setTimeout(() => {
        setIsPrinting(false);
      }, 500);
    }, 100);
  };

  return (
    <div className="space-y-8">
              {/* only show controls when not printing */}
      {!isPrinting && (
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold mb-6">Generate Problem Set</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* division selection */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Division</h3>
              <select
                value={selectedDivision}
                onChange={(e) => setSelectedDivision(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a division</option>
                {divisions.map((division) => (
                  <option key={division} value={division}>
                    {division}
                  </option>
                ))}
              </select>
            </div>

                          {/* topic selection - multiple select */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Topics (Hold Ctrl/Cmd to select multiple)</h3>
              <select
                multiple
                value={selectedTopics}
                onChange={handleTopicChange}
                disabled={!selectedDivision}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 min-h-[120px]"
              >
                {topics.map((topic) => (
                  <option key={topic} value={topic}>
                    {topic}
                  </option>
                ))}
              </select>
              <p className="text-sm text-gray-500 mt-1">
                {selectedTopics.length} topic(s) selected
              </p>
            </div>
          </div>

                      {/* difficulty range slider */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Difficulty range</h3>
            <div className="relative h-2 mb-8">
              <div className="absolute w-full h-full bg-gray-200 rounded-lg"></div>
              <div 
                className="absolute h-full bg-teal-500 rounded-lg"
                style={{
                  left: `${(difficultyRange[0] / 10) * 100}%`,
                  right: `${100 - (difficultyRange[1] / 10) * 100}%`
                }}
              ></div>
              <input
                type="range"
                min="0"
                max="10"
                step="1"
                value={difficultyRange[0]}
                onChange={(e) => handleDifficultyChange(e, 'min')}
                className="absolute w-full h-full appearance-none bg-transparent pointer-events-auto cursor-pointer"
              />
              <input
                type="range"
                min="0"
                max="10"
                step="1"
                value={difficultyRange[1]}
                onChange={(e) => handleDifficultyChange(e, 'max')}
                className="absolute w-full h-full appearance-none bg-transparent pointer-events-auto cursor-pointer"
              />
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>{difficultyRange[0]}</span>
              <span>{difficultyRange[1]}</span>
            </div>
          </div>

                      {/* number of problems slider */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2"># of problems</h3>
            <div className="flex items-center space-x-4">
              <input
                type="range"
                min="0"
                max="40"
                step="1"
                value={numProblems}
                onChange={(e) => setNumProblems(parseInt(e.target.value))}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-sm text-gray-600 min-w-[2rem] text-center">
                {numProblems}
              </span>
            </div>
          </div>

                      {/* generate button */}
          <button
            onClick={fetchQuestions}
            disabled={!selectedDivision || selectedTopics.length === 0}
            className="w-full px-6 py-3 bg-teal-500 text-white text-lg font-semibold rounded-lg hover:bg-teal-600 disabled:opacity-50 transition-colors"
          >
            Generate Problem Set
          </button>
        </div>
      )}

              {/* loading state */}
      {loading && !questions.length && !isPrinting && (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      )}

              {/* error state */}
      {error && !isPrinting && (
        <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-lg">
          {error}
        </div>
      )}

              {/* questions display */}
      {Array.isArray(questions) && questions.length > 0 ? (
        <div className={`printable-test ${isPrinting ? 'print-view' : 'bg-white p-6 rounded-lg shadow-lg'}`}>
          <div className="mb-8 flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold mb-2">Problem Set</h2>
              <p className="text-gray-600">
                {selectedDivision} - {selectedTopics.join(', ')}
              </p>
            </div>
            
            {/* print button - only show when not in printing mode */}
            {!isPrinting && (
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print Problem Set
              </button>
            )}
          </div>

          <div className="space-y-8">
            {questions.map((question, index) => (
              <div key={question.id} className="question-item">
                <div className="mb-4">
                  <span className="font-semibold">PROBLEM {index + 1}</span>
                  {question.question_text && <KatexContent text={question.question_text} />}
                </div>
                <div className="space-y-2 ml-4">
                  {Array.isArray(question.options) && question.options.map((option, optionIndex) => (
                    <div key={optionIndex} className="flex items-start">
                      <span className="mr-2">({String.fromCharCode(65 + optionIndex)})</span>
                      <KatexContent text={option} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
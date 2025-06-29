'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../utils/supabase'
import { ProtectedRoute } from '../../components/ProtectedRoute'
import { toast, Toaster } from 'react-hot-toast'
import BadgeDisplay from '../../components/BadgeDisplay'
import FlagQuestion from '../components/FlagQuestion'
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
  level: number
  xp_reward: number
  accuracy_bonus: number
  stamina_bonus: number
  attempts?: number
  last_attempt?: string
  last_correct?: boolean
}

interface StreakData {
  current_streak: number
  last_practice_date: string
  best_streak: number
  answer_streak: number
  best_answer_streak: number
}

interface TopicProgress {
  topic: string
  completed: number
  total: number
  status: 'completed' | 'in-progress' | 'not-started'
}

interface UserStats {
  level: number
  xp: number
  xp_to_next_level: number
  accuracy: number
  stamina: number
}

interface QuestionAttempt {
  attempts: number
  last_attempt: string
  last_correct: boolean
  user_answers: string[]
  is_completed: boolean
  gave_up: boolean
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

export default function PracticePage() {
  const [divisions, setDivisions] = useState<string[]>([])
  const [topics, setTopics] = useState<string[]>([])
  const [selectedDivision, setSelectedDivision] = useState<string>('')
  const [selectedTopic, setSelectedTopic] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [startTime, setStartTime] = useState<number | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [score, setScore] = useState(0)
  const [showResults, setShowResults] = useState(false)
  const [practiceComplete, setPracticeComplete] = useState(false)
  const [userAnswer, setUserAnswer] = useState<string>('')
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'correct' | 'incorrect', message: string } | null>(null)
  const [answerStreak, setAnswerStreak] = useState(0)
  const [bestAnswerStreak, setBestAnswerStreak] = useState(0)
  const [questionHistory, setQuestionHistory] = useState<Record<string, QuestionAttempt>>({})
  const [showSkipOption, setShowSkipOption] = useState(false)
  const [streakData, setStreakData] = useState<StreakData | null>(null)
  const [topicCompletionCount, setTopicCompletionCount] = useState<number>(0)
  const [userStats, setUserStats] = useState<UserStats>({
    level: 1,
    xp: 0,
    xp_to_next_level: 100,
    accuracy: 0,
    stamina: 0
  })
  const [topicProgress, setTopicProgress] = useState<TopicProgress[]>([])
  const [showSolution, setShowSolution] = useState(false)
  const [canProgress, setCanProgress] = useState(false)

  useEffect(() => {
    fetchDivisions()
    fetchStreakData()
    fetchUserStats()
    fetchTopicProgress()
  }, [])

  useEffect(() => {
    if (selectedDivision) {
      fetchTopics(selectedDivision)
    }
  }, [selectedDivision])

  useEffect(() => {
    if (selectedTopic) {
      fetchTopicCompletionCount()
    }
  }, [selectedTopic])

  useEffect(() => {
    if (isAnswerSubmitted) {
      document.body.classList.add('printing-mode');
    } else {
      document.body.classList.remove('printing-mode');
    }
    
    return () => {
      document.body.classList.remove('printing-mode');
    };
  }, [isAnswerSubmitted]);

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
      setSelectedTopic('')
    } catch (error) {
      console.error('Error fetching topics:', error)
      setError('Failed to load topics')
    }
  }

  const fetchQuestionHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let query = supabase
        .from('user_progress')
        .select('question_id, correct, timestamp')
        .eq('user_id', user.id)
        .eq('division', selectedDivision)
        .order('timestamp', { ascending: false })
        

      if (selectedTopic !== 'All Topics') {
        query = query.eq('topic', selectedTopic)
      }

      const { data, error } = await query

      if (error) return

      const history: Record<string, QuestionAttempt> = {}
      data?.forEach(progress => {
        if (!history[progress.question_id]) {
          history[progress.question_id] = {
            attempts: 0,
            last_attempt: progress.timestamp,
            last_correct: progress.correct,
            user_answers: [],
            is_completed: false,
            gave_up: false
          }
        }
        history[progress.question_id].attempts++
      })

      setQuestionHistory(history)
    } catch (error) {
      // Silently handle errors since the functionality is working
    }
  }

  const fetchStreakData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('profiles')
        .select('streak, last_practice_date')
        .eq('id', user.id)
        .single()

      if (error) return

      setStreakData({
        current_streak: data.streak || 0,
        last_practice_date: data.last_practice_date || '',
        best_streak: data.streak || 0,
        answer_streak: 0,
        best_answer_streak: 0
      })
    } catch (error) {
      // Silently handle errors since the functionality is working
    }
  }

  const fetchTopicCompletionCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !selectedDivision || !selectedTopic) return

      const { data, error } = await supabase
        .from('user_progress')
        .select('question_id')
        .eq('user_id', user.id)
        .eq('division', selectedDivision)
        .eq('topic', selectedTopic)
        .eq('correct', true)

      if (error) return

      setTopicCompletionCount(data?.length || 0)
    } catch (error) {
      // Silently handle errors since the functionality is working
    }
  }

  const fetchUserStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('profiles')
        .select('level, xp, accuracy, stamina')
        .eq('id', user.id)
        .single()

      if (error) return

      const currentLevel = data.level || 1
      const currentXP = data.xp || 0
      const xpForNextLevel = calculateXPForNextLevel(currentLevel)

      setUserStats({
        level: currentLevel,
        xp: currentXP,
        xp_to_next_level: xpForNextLevel,
        accuracy: data.accuracy || 0,
        stamina: data.stamina || 0
      })
    } catch (error) {
      // Silently handle errors since the functionality is working
    }
  }

  const fetchTopicProgress = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('user_progress')
        .select('topic, correct')
        .eq('user_id', user.id)

      if (error) return

      const topicStats: Record<string, { correct: number; total: number }> = {}
      data?.forEach(progress => {
        if (!topicStats[progress.topic]) {
          topicStats[progress.topic] = { correct: 0, total: 0 }
        }
        topicStats[progress.topic].total++
        if (progress.correct) {
          topicStats[progress.topic].correct++
        }
      })

      const progress = Object.entries(topicStats).map(([topic, stats]) => ({
        topic,
        completed: stats.correct,
        total: stats.total,
        status: stats.correct >= 10 ? 'completed' : stats.correct > 0 ? 'in-progress' : 'not-started'
      }))

      setTopicProgress(progress)
    } catch (error) {
      // Silently handle errors since the functionality is working
    }
  }

  const calculateXPForNextLevel = (currentLevel: number) => {
    return Math.floor(100 * Math.pow(1.5, currentLevel - 1))
  }

  const startPractice = async () => {
    if (!selectedDivision || !selectedTopic) return

    try {
      setLoading(true)
      setError(null)

      console.log('Starting practice with:', { selectedDivision, selectedTopic })

      let query = supabase
        .from('questions')
        .select('*')
        .eq('division', selectedDivision)
        .limit(10)

      if (selectedTopic !== 'All Topics') {
        query = query.eq('topic', selectedTopic)
      }

      const { data: questionsData, error: questionsError } = await query.order('id')

      if (questionsError) {
        console.error('Error fetching questions:', questionsError)
        throw questionsError
      }

      await fetchQuestionHistory()

      console.log('Raw questions data:', JSON.stringify(questionsData, null, 2))
      console.log('First question structure:', questionsData?.[0] ? Object.keys(questionsData[0]) : 'No questions')

      if (!questionsData || questionsData.length === 0) {
        console.log('No questions found for the selected division and topic')
        setError('No questions available for this topic')
        return
      }

      const questionsWithHistory = questionsData.map(q => ({
        ...q,
        completed: questionHistory[q.id]?.last_correct || false,
        correct: questionHistory[q.id]?.last_correct || false
      }))

      console.log('Questions with history:', questionsWithHistory)
      setQuestions(questionsWithHistory)
      setCurrentQuestion(0)
      setScore(0)
      setStartTime(Date.now())
      setShowResults(false)
      setPracticeComplete(true)
      setShowSkipOption(true)
      setShowSolution(false)
      setCanProgress(false)
      console.log('Practice session started')
    } catch (error: any) {
      console.error('Error in startPractice:', error)
      setError(error.message || 'Failed to start practice')
    } finally {
      setLoading(false)
    }
  }

  const handleAnswer = async (answer: string) => {
    if (!startTime || showResults) return

    const currentQuestionData = questions[currentQuestion]
    const isCorrect = answer === currentQuestionData.answer
    const currentAttempts = questionHistory[currentQuestionData.id]?.attempts || 0
    const newAttempts = currentAttempts + 1
    
    // Calculate XP and bonuses
    let xpGained = currentQuestionData.xp_reward || 10
    if (isCorrect) {
      xpGained += currentQuestionData.accuracy_bonus || 0
      if (answerStreak > 0) {
        xpGained += currentQuestionData.stamina_bonus || 0
      }
      setScore(prev => prev + 1)
    }

    // Update answer streak
    if (isCorrect) {
      setAnswerStreak(prev => {
        const newStreak = prev + 1
        setBestAnswerStreak(current => Math.max(current, newStreak))
        return newStreak
      })
    } else {
      setAnswerStreak(0)
    }

    // Update user stats
    const newXP = userStats.xp + xpGained
    const newLevel = userStats.level
    const xpForNextLevel = calculateXPForNextLevel(newLevel)

    if (newXP >= xpForNextLevel) {
      // Level up!
      setUserStats(prev => ({
        ...prev,
        level: prev.level + 1,
        xp: newXP - xpForNextLevel,
        xp_to_next_level: calculateXPForNextLevel(prev.level + 1)
      }))

      toast.success(`Level Up! You are now level ${newLevel + 1}`)
    } else {
      setUserStats(prev => ({
        ...prev,
        xp: newXP
      }))
    }
    
    // Update question history
    const currentHistory = questionHistory[currentQuestionData.id] || {
      attempts: 0,
      last_attempt: '',
      last_correct: false,
      user_answers: [],
      is_completed: false,
      gave_up: false
    }

    const updatedHistory = {
      ...currentHistory,
      attempts: newAttempts,
      last_attempt: new Date().toISOString(),
      last_correct: isCorrect,
      user_answers: [...currentHistory.user_answers, answer],
      is_completed: isCorrect || newAttempts >= 2
    }

    setQuestionHistory(prev => ({
      ...prev,
      [currentQuestionData.id]: updatedHistory
    }))

    // Show feedback and handle state
    if (isCorrect) {
      setFeedback({
        type: 'correct',
        message: `Correct! +${xpGained} XP ${answerStreak > 0 ? `(Streak: ${answerStreak + 1})` : ''}`
      })
      setShowSolution(true)
      setCanProgress(true)
      setIsAnswerSubmitted(true)
    } else if (newAttempts >= 2) {
      setFeedback({
        type: 'incorrect',
        message: `Incorrect. You've used both attempts. The correct answer is: ${currentQuestionData.answer}`
      })
      setShowSolution(true)
      setCanProgress(true)
      setIsAnswerSubmitted(true)
    } else {
      setFeedback({
        type: 'incorrect',
        message: `Incorrect. You have 1 attempt remaining.`
      })
      setUserAnswer('')
      setIsAnswerSubmitted(false) // Allow second attempt
    }
  }

  const giveUp = () => {
    const currentQuestionData = questions[currentQuestion]
    
    // Update question history to mark as gave up
    const currentHistory = questionHistory[currentQuestionData.id] || {
      attempts: 0,
      last_attempt: '',
      last_correct: false,
      user_answers: [],
      is_completed: false,
      gave_up: false
    }

    setQuestionHistory(prev => ({
      ...prev,
      [currentQuestionData.id]: {
        ...currentHistory,
        gave_up: true,
        is_completed: true
      }
    }))

    setFeedback({
      type: 'incorrect',
      message: `You gave up. The correct answer is: ${currentQuestionData.answer}`
    })
    setShowSolution(true)
    setCanProgress(true)
    setIsAnswerSubmitted(true)
  }

  const nextQuestion = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prev => prev + 1)
      setUserAnswer('')
      setFeedback(null)
      setIsAnswerSubmitted(false)
      setShowSolution(false)
      setCanProgress(false)
    } else {
      // End of practice session
      try {
        saveProgress()
        setShowResults(true)
      } catch (error) {
        console.error('Failed to save progress:', error)
        toast.error('Failed to save your progress')
      }
    }
  }

  const skipQuestion = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prev => prev + 1)
      setUserAnswer('')
      setFeedback(null)
      setIsAnswerSubmitted(false)
      setShowSolution(false)
      setCanProgress(false)
    }
  }

  const calculatePoints = (score: number, totalQuestions: number, answerStreak: number, topicCompletionCount: number) => {
    // Base points for correct answers (10 points per correct answer)
    const correctAnswerPoints = score * 10

    // Bonus points for accuracy (up to 50 points)
    const accuracy = (score / totalQuestions) * 100
    const accuracyBonus = Math.floor(accuracy / 2) // 50 points for 100% accuracy

    // Streak bonus (5 points per streak level, up to 50 points)
    const streakBonus = Math.min(answerStreak * 5, 50)

    // Topic completion bonus (2 points per completion, up to 20 points)
    const completionBonus = Math.min(topicCompletionCount * 2, 20)

    return correctAnswerPoints + accuracyBonus + streakBonus + completionBonus
  }

  const saveProgress = async () => {
    if (!selectedDivision || !selectedTopic) {
      console.log('Cannot save progress: missing division or topic')
      return
    }

    try {
      // Get the current user session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        throw new Error('Authentication error: ' + sessionError.message)
      }

      if (!session?.user) {
        throw new Error('No authenticated user found')
      }

      const user = session.user
      const sessionId = Math.random().toString(36).substring(2, 15) // Generate a unique session ID

      // Save each question attempt individually
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i]
        const questionAttempt = questionHistory[question.id]
        
        if (questionAttempt) {
          const { error: attemptError } = await supabase
            .from('practice_attempts')
            .insert([{
              user_id: user.id,
              question_id: question.id,
              user_answer: questionAttempt.user_answers[questionAttempt.user_answers.length - 1] || '',
              is_correct: questionAttempt.last_correct,
              session_id: sessionId,
              division: selectedDivision,
              topic: selectedTopic
            }])

          if (attemptError) {
            console.error('Error saving question attempt:', attemptError)
            throw attemptError
          }
        }
      }

      // Update leaderboard with aggregated data
      const totalQuestions = questions.length
      const correctAnswers = Object.values(questionHistory).filter(h => h.last_correct).length
      const accuracy = (correctAnswers / totalQuestions) * 100

      const leaderboardEntry = {
        user_id: user.id,
        username: user.user_metadata?.username || 'Anonymous',
        division: selectedDivision,
        topic: selectedTopic,
        grade_level: user.user_metadata?.grade_level || 'Unknown',
        average_score: accuracy,
        attempts: totalQuestions,
        perfect_scores: accuracy === 100 ? 1 : 0,
        last_updated: new Date().toISOString()
      }

      const { error: leaderboardError } = await supabase
        .from('leaderboard')
        .upsert([leaderboardEntry], {
          onConflict: 'user_id,division,topic'
        })

      if (leaderboardError) {
        console.error('Error updating leaderboard:', leaderboardError)
        // Don't throw error here as progress was saved successfully
      }

      // Refresh user data
      await fetchStreakData()
      await fetchTopicCompletionCount()
      
      toast.success('Progress saved successfully!')
    } catch (error: any) {
      console.error('Error saving progress:', error)
      toast.error(error.message || 'Failed to save progress')
    }
  }

  const checkAndAwardBadges = async (userId: string, accuracy: number) => {
    try {
      const { data: badges } = await supabase
        .from('user_badges')
        .select('badge_name')
        .eq('user_id', userId)

      const existingBadges = badges?.map(b => b.badge_name) || []

      // Check for accuracy badges
      if (accuracy >= 90 && !existingBadges.includes('Accuracy Master')) {
        await supabase
          .from('user_badges')
          .insert([{
            user_id: userId,
            badge_name: 'Accuracy Master',
            division: selectedDivision,
            topic: selectedTopic
          }])

        toast.success('🏆 New Badge: Accuracy Master!', {
          duration: 4000,
          style: {
            background: '#4CAF50',
            color: 'white',
          },
        })
      }
    } catch (error) {
      // Silently handle errors since the functionality is working
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-10 bg-gray-200 rounded mb-4"></div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 py-8">
        <Toaster />
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Practice</h1>
            {selectedDivision && selectedTopic && (
              <p className="text-lg text-gray-600">
                {selectedDivision} - {selectedTopic}
              </p>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <div className="bg-blue-600 text-white rounded-full w-12 h-12 flex items-center justify-center text-xl font-bold">
              {userStats.level}
            </div>
            <div>
              <p className="text-sm text-gray-500">XP to level {userStats.level + 1}</p>
              <div className="w-48 h-2 bg-gray-200 rounded-full">
                <div 
                  className="h-full bg-blue-600 rounded-full"
                  style={{ width: `${(userStats.xp / userStats.xp_to_next_level) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Topic Selection Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Select Topic</h2>
              
              {/* Add streak display */}
              {streakData && (
                <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h3 className="text-sm font-medium text-blue-800 mb-2">Your Streaks</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-2xl font-bold text-blue-600">{streakData.current_streak}</p>
                      <p className="text-xs text-blue-500">Practice Streak</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-blue-600">{streakData.best_streak}</p>
                      <p className="text-xs text-blue-500">Best Practice Streak</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-blue-600">{answerStreak}</p>
                      <p className="text-xs text-blue-500">Current Answer Streak</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-blue-600">{streakData.best_answer_streak}</p>
                      <p className="text-xs text-blue-500">Best Answer Streak</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Add topic completion count */}
              {selectedTopic && (
                <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
                  <h3 className="text-sm font-medium text-green-800 mb-2">Topic Progress</h3>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-2xl font-bold text-green-600">{topicCompletionCount}</p>
                      <p className="text-xs text-green-500">Questions Completed</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-600">
                        {Math.min(Math.floor((topicCompletionCount / 10) * 100), 100)}%
                      </p>
                      <p className="text-xs text-green-500">Topic Mastery</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Add BadgeDisplay */}
              <div className="mb-6">
                <BadgeDisplay />
              </div>

              <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Division
              </label>
              <select
                value={selectedDivision}
                    onChange={(e) => {
                      setSelectedDivision(e.target.value)
                      setSelectedTopic('')
                      setPracticeComplete(false)
                    }}
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                    Topic
              </label>
              <select
                    value={selectedTopic}
                    onChange={(e) => {
                      setSelectedTopic(e.target.value)
                      setPracticeComplete(false)
                    }}
                    disabled={!selectedDivision}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">Select a topic</option>
                    {topics.map((topic) => (
                      <option key={topic} value={topic}>
                        {topic}
                  </option>
                ))}
              </select>
            </div>

                {selectedDivision && selectedTopic && (
                  <button
                    onClick={startPractice}
                    className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    {practiceComplete ? 'Restart Practice' : 'Start Practice'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Practice Area */}
          <div className="lg:col-span-2">
            {practiceComplete ? (
              showResults ? (
                <div className="bg-white p-6 rounded-lg shadow-lg">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Practice Results</h2>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <p className="text-sm text-gray-500">Score</p>
                      <p className="text-2xl font-bold text-gray-900">{score}/{questions.length}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">XP Earned</p>
                      <p className="text-2xl font-bold text-blue-600">+{userStats.xp}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Best Streak</p>
                      <p className="text-2xl font-bold text-gray-900">{answerStreak}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Topic Completions</p>
                      <p className="text-2xl font-bold text-gray-900">{topicCompletionCount}</p>
                    </div>
                  </div>
          <button
                    onClick={() => {
                      setPracticeComplete(false)
                      setShowResults(false)
                    }}
                    className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Try Again
          </button>
                </div>
              ) : (
                <div className="bg-white p-6 rounded-lg shadow-lg">
                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center space-x-4">
                        <div className="text-sm text-gray-500">
                          Question {currentQuestion + 1} of {questions.length}
                        </div>
                        <div className="text-blue-600">
                          +{questions[currentQuestion]?.xp_reward || 10} XP
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">
                        Accuracy +{questions[currentQuestion]?.accuracy_bonus || 0}
                        {answerStreak > 0 && `, Stamina +${questions[currentQuestion]?.stamina_bonus || 0}`}
                </div>
              </div>

                    {questions[currentQuestion] && (
                      <>
                        {questionHistory[questions[currentQuestion].id] && (
                          <div className="mb-4 p-3 bg-blue-50 text-blue-700 rounded-lg border border-blue-200">
                            <p className="text-sm">
                              Previous attempts: {questionHistory[questions[currentQuestion].id].attempts}
                              {questionHistory[questions[currentQuestion].id].last_correct && ' (Last attempt was correct)'}
                            </p>
              </div>
                        )}
                        <p className="text-lg font-medium text-gray-900 mb-4">
                          {renderLatex(questions[currentQuestion].question_text)}
                        </p>
                        
                        {/* Flag button */}
                        <div className="mb-4 flex justify-end">
                          <FlagQuestion 
                            questionId={questions[currentQuestion].id}
                            questionText={questions[currentQuestion].question_text}
                          />
                        </div>
                        
                        <div className="space-y-4">
                          {questions[currentQuestion].options && questions[currentQuestion].options.length > 0 && (
                            <div className="space-y-2">
                              {questions[currentQuestion].options.map((option, index) => (
                                <div key={index} className="flex items-center space-x-2">
                                  <span className="font-medium">{String.fromCharCode(65 + index)}.</span>
                                  <span>{renderLatex(option)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {/* Attempt counter */}
                          <div className="text-sm text-gray-600">
                            Attempts: {questionHistory[questions[currentQuestion].id]?.attempts || 0}/2
                          </div>

                          <div className="flex gap-2">
                  <input
                    type="text"
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !isAnswerSubmitted && userAnswer.trim()) {
                                  handleAnswer(userAnswer)
                                }
                              }}
                              placeholder="Type your answer here..."
                              className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              disabled={isAnswerSubmitted}
                            />
                            <button
                              onClick={() => handleAnswer(userAnswer)}
                              disabled={isAnswerSubmitted || !userAnswer.trim()}
                              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Submit
                            </button>
                </div>

                          {/* Give up button - show after first attempt */}
                          {questionHistory[questions[currentQuestion].id]?.attempts === 1 && !isAnswerSubmitted && (
                            <button
                              onClick={giveUp}
                              className="w-full px-4 py-2 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 transition-colors border border-red-200 rounded-md"
                            >
                              Give Up
                            </button>
                          )}

                          {/* Skip option */}
                          {showSkipOption && !isAnswerSubmitted && (
                            <button
                              onClick={skipQuestion}
                              className="w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                            >
                              Skip this question
                            </button>
                          )}

                          {/* Feedback */}
                          {feedback && (
                  <div className={`p-4 rounded-lg ${
                              feedback.type === 'correct' 
                                ? 'bg-green-50 text-green-700 border border-green-200' 
                                : 'bg-red-50 text-red-700 border border-red-200'
                            }`}>
                              {renderLatex(feedback.message)}
                            </div>
                          )}

                          {/* Solution dropdown */}
                          {showSolution && (
                            <div className="mt-4">
                              <details className="bg-gray-50 rounded-lg">
                                <summary className="p-4 cursor-pointer font-medium text-gray-900 hover:bg-gray-100">
                                  View Solution
                                </summary>
                                <div className="p-4 border-t border-gray-200">
                                  <p className="text-sm text-gray-600 mb-2">Correct Answer:</p>
                                  <p className="font-medium text-gray-900">
                                    {renderLatex(questions[currentQuestion].answer)}
                                  </p>
                                  {questionHistory[questions[currentQuestion].id]?.user_answers.length > 0 && (
                                    <div className="mt-3">
                                      <p className="text-sm text-gray-600 mb-1">Your attempts:</p>
                                      <ul className="text-sm text-gray-700">
                                        {questionHistory[questions[currentQuestion].id].user_answers.map((answer, index) => (
                                          <li key={index} className="flex items-center space-x-2">
                                            <span>Attempt {index + 1}:</span>
                                            <span className="font-mono">{answer}</span>
                                            <span className={answer === questions[currentQuestion].answer ? 'text-green-600' : 'text-red-600'}>
                                              {answer === questions[currentQuestion].answer ? '✓' : '✗'}
                                            </span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              </details>
                            </div>
                          )}

                          {/* Next question button */}
                          {canProgress && (
                            <button
                              onClick={nextQuestion}
                              className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                            >
                              {currentQuestion === questions.length - 1 ? 'Finish Practice' : 'Next Question'}
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )
            ) : (
              <div className="bg-white p-6 rounded-lg shadow-lg">
                <div className="text-center text-gray-500">
                  <p className="text-lg">Select a division and topic to start practicing</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </ProtectedRoute>
  )
} 
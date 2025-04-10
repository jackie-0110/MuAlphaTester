'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../utils/supabase'
import { ProtectedRoute } from '../../components/ProtectedRoute'
import { toast, Toaster } from 'react-hot-toast'
import BadgeDisplay from '../../components/BadgeDisplay'
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

function KatexContent({ text }: { text: string }) {
  const katexRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (katexRef.current) {
      renderMathInElement(katexRef.current, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
        ],
        throwOnError: false,
        output: 'html',
      });
    }
  }, [text]);

  return <div ref={katexRef}>{text}</div>;
}

function renderLatex(text: string) {
  if (!text) return text;
  return <KatexContent text={text} />;
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
  const [questionHistory, setQuestionHistory] = useState<Record<string, { attempts: number, last_attempt: string, last_correct: boolean }>>({})
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
    if (selectedDivision && selectedTopic) {
      fetchTopicCompletionCount()
    }
  }, [selectedDivision, selectedTopic])

  const fetchDivisions = async () => {
    try {
      console.log('Fetching divisions...')
      const { data, error } = await supabase
        .from('questions')
        .select('division')
        .order('division')

      if (error) {
        console.error('Error fetching divisions:', error)
        throw error
      }

      console.log('Raw divisions data:', data)
      
      if (!data || data.length === 0) {
        console.log('No divisions found in the questions table')
        setDivisions([])
        return
      }

      const uniqueDivisions = [...new Set(data.map(d => d.division))]
      console.log('Unique divisions:', uniqueDivisions)
      
      setDivisions(uniqueDivisions)
    } catch (error: any) {
      console.error('Error in fetchDivisions:', error)
      setError(error.message || 'Failed to fetch divisions')
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
      setTopics(['All Topics', ...uniqueTopics])
      setSelectedTopic('')
    } catch (error: any) {
      setError(error.message || 'Failed to fetch topics')
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

      const history: Record<string, { attempts: number, last_attempt: string, last_correct: boolean }> = {}
      data?.forEach(progress => {
        if (!history[progress.question_id]) {
          history[progress.question_id] = {
            attempts: 0,
            last_attempt: progress.timestamp,
            last_correct: progress.correct
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
        .from('practice_attempts')
        .select('created_at, is_correct')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      if (!data || data.length === 0) {
        setStreakData({
          current_streak: 0,
          last_practice_date: new Date().toISOString(),
          best_streak: 0,
          answer_streak: 0,
          best_answer_streak: 0
        })
        return
      }

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const lastPracticeDate = new Date(data[0].created_at)
      lastPracticeDate.setHours(0, 0, 0, 0)

      const daysSinceLastPractice = Math.floor((today.getTime() - lastPracticeDate.getTime()) / (1000 * 60 * 60 * 24))
      
      let currentStreak = 1
      let bestStreak = 1
      let tempStreak = 1
      let currentAnswerStreak = 0
      let bestAnswerStreak = 0
      let tempAnswerStreak = 0

      for (let i = 0; i < data.length; i++) {
        // Calculate practice streak
        if (i > 0) {
          const currentDate = new Date(data[i].created_at)
          currentDate.setHours(0, 0, 0, 0)
          const prevDate = new Date(data[i - 1].created_at)
          prevDate.setHours(0, 0, 0, 0)

          const daysBetween = Math.floor((prevDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24))
          
          if (daysBetween === 1) {
            tempStreak++
            bestStreak = Math.max(bestStreak, tempStreak)
          } else if (daysBetween > 1) {
            tempStreak = 1
          }
        }

        // Calculate answer streak
        if (data[i].is_correct) {
          tempAnswerStreak++
          bestAnswerStreak = Math.max(bestAnswerStreak, tempAnswerStreak)
        } else {
          tempAnswerStreak = 0
        }
      }

      if (daysSinceLastPractice === 1) {
        currentStreak = tempStreak
      } else if (daysSinceLastPractice === 0) {
        currentStreak = tempStreak
      } else {
        currentStreak = 0
      }

      currentAnswerStreak = tempAnswerStreak

      setStreakData({
        current_streak: currentStreak,
        last_practice_date: data[0].created_at,
        best_streak: bestStreak,
        answer_streak: currentAnswerStreak,
        best_answer_streak: bestAnswerStreak
      })
    } catch (error) {
      console.error('Error fetching streak data:', error)
    }
  }

  const fetchTopicCompletionCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !selectedDivision) return

      let query = supabase
        .from('practice_attempts')
        .select('question_id')
        .eq('user_id', user.id)
        .eq('division', selectedDivision)
        .eq('is_correct', true)

      if (selectedTopic !== 'All Topics') {
        query = query.eq('topic', selectedTopic)
      }

      const { data, error } = await query

      if (error) throw error

      // Count unique questions that were answered correctly
      const uniqueQuestions = new Set(data?.map(attempt => attempt.question_id) || [])
      setTopicCompletionCount(uniqueQuestions.size)
    } catch (error) {
      console.error('Error fetching topic completion count:', error)
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

      if (error) throw error

      setUserStats({
        level: data.level || 1,
        xp: data.xp || 0,
        xp_to_next_level: calculateXPForNextLevel(data.level || 1),
        accuracy: data.accuracy || 0,
        stamina: data.stamina || 0
      })
    } catch (error) {
      console.error('Error fetching user stats:', error)
    }
  }

  const fetchTopicProgress = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: attempts, error } = await supabase
        .from('practice_attempts')
        .select('topic, is_correct')
        .eq('user_id', user.id)

      if (error) throw error

      // Calculate progress for each topic
      const progress = topics.map(topic => {
        const topicAttempts = attempts?.filter(a => a.topic === topic) || []
        const completed = topicAttempts.filter(a => a.is_correct).length
        const total = 10 // Assuming 10 questions per topic
        
        let status: 'completed' | 'in-progress' | 'not-started'
        if (completed === total) {
          status = 'completed'
        } else if (completed > 0) {
          status = 'in-progress'
        } else {
          status = 'not-started'
        }

        return {
          topic,
          completed,
          total,
          status
        }
      })

      setTopicProgress(progress)
    } catch (error) {
      console.error('Error fetching topic progress:', error)
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
    
    // Show feedback
    setFeedback({
      type: isCorrect ? 'correct' : 'incorrect',
      message: isCorrect 
        ? `Correct! +${xpGained} XP ${answerStreak > 0 ? `(Streak: ${answerStreak + 1})` : ''}` 
        : `Incorrect. The correct answer is: ${currentQuestionData.answer}`
    })

    // Update question history
    setQuestionHistory(prev => ({
      ...prev,
      [currentQuestionData.id]: {
        attempts: (prev[currentQuestionData.id]?.attempts || 0) + 1,
        last_attempt: new Date().toISOString(),
        last_correct: isCorrect
      }
    }))

    // Check if this is the last question
    if (currentQuestion === questions.length - 1) {
      try {
        await saveProgress()
        setShowResults(true)
      } catch (error) {
        console.error('Failed to save progress:', error)
        toast.error('Failed to save your progress')
      }
    } else {
      // Wait 2 seconds before moving to next question
      setTimeout(() => {
        setCurrentQuestion(prev => prev + 1)
        setUserAnswer('')
        setFeedback(null)
        setIsAnswerSubmitted(false)
      }, 2000)
    }
  }

  const skipQuestion = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prev => prev + 1)
      setUserAnswer('')
      setFeedback(null)
      setIsAnswerSubmitted(false)
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
        const isCorrect = questionHistory[question.id]?.last_correct || false
        const userAnswer = questionHistory[question.id]?.last_attempt || ''

        const { error: attemptError } = await supabase
          .from('practice_attempts')
          .insert([{
            user_id: user.id,
            question_id: question.id,
            user_answer: userAnswer,
            is_correct: isCorrect,
            session_id: sessionId,
            division: selectedDivision,
            topic: selectedTopic
          }])

        if (attemptError) {
          console.error('Error saving question attempt:', attemptError)
          throw attemptError
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
        .from('badges')
        .select('*')

      const { data: userBadges } = await supabase
        .from('user_badges')
        .select('badge_id')
        .eq('user_id', userId)

      const earnedBadgeIds = new Set(userBadges?.map(ub => ub.badge_id) || [])

      for (const badge of badges || []) {
        if (earnedBadgeIds.has(badge.id)) continue

        const requirements = badge.requirements
        let shouldAward = false

        switch (requirements.type) {
          case 'score':
            shouldAward = accuracy >= requirements.threshold * 100
            break
          case 'streak':
            shouldAward = streakData?.current_streak !== undefined && streakData.current_streak >= requirements.days
            break
          case 'topic_completion':
            shouldAward = topicCompletionCount >= requirements.count
            break
        }

        if (shouldAward) {
          await supabase
            .from('user_badges')
            .insert([
              {
                user_id: userId,
                badge_id: badge.id
              }
            ])

          toast.success(`🏆 New Badge Earned: ${badge.name}!`, {
            duration: 5000,
            position: 'top-center',
            style: {
              background: '#4CAF50',
              color: 'white',
            },
          })
        }
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
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={userAnswer}
                              onChange={(e) => setUserAnswer(e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter' && !isAnswerSubmitted) {
                                  handleAnswer(userAnswer)
                                  setIsAnswerSubmitted(true)
                                }
                              }}
                              placeholder="Type your answer here..."
                              className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              disabled={isAnswerSubmitted}
                            />
                            <button
                              onClick={() => {
                                handleAnswer(userAnswer)
                                setIsAnswerSubmitted(true)
                              }}
                              disabled={isAnswerSubmitted || !userAnswer.trim()}
                              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Submit
                            </button>
                          </div>
                          {showSkipOption && (
                            <button
                              onClick={skipQuestion}
                              className="w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                            >
                              Skip this question
                            </button>
                          )}
                          {feedback && (
                            <div className={`p-4 rounded-lg ${
                              feedback.type === 'correct' 
                                ? 'bg-green-50 text-green-700 border border-green-200' 
                                : 'bg-red-50 text-red-700 border border-red-200'
                            }`}>
                              {renderLatex(feedback.message)}
                            </div>
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
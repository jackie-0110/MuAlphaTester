import { supabase } from '@/utils/supabase';

export async function logQuestionAttempt({
  userId,
  questionId,
  division,
  topic,
  attempts,
  gaveUp,
  userAnswers,
  isCorrect,
}: {
  userId: string;
  questionId: string;
  division: string;
  topic: string;
  attempts: number;
  gaveUp: boolean;
  userAnswers: string[];
  isCorrect?: boolean;
}) {
  const { error } = await supabase.from('question_attempts').insert([
    {
      user_id: userId,
      question_id: questionId,
      division,
      topic,
      attempts,
      gave_up: gaveUp,
      user_answers: userAnswers,
      is_correct: isCorrect || false,
    },
  ]);
  if (error) throw error;
} 
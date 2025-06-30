import { supabase } from '@/utils/supabase';

export async function logQuestionAttempt({
  userId,
  questionId,
  division,
  topic,
  attempts,
  gaveUp,
  userAnswers,
}: {
  userId: string;
  questionId: string;
  division: string;
  topic: string;
  attempts: number;
  gaveUp: boolean;
  userAnswers: string[];
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
    },
  ]);
  if (error) throw error;
} 
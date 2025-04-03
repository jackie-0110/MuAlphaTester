import { supabase } from './supabase'

interface QuestionImport {
  question_text: string
  answer_choices: {
    A: string
    B: string
    C: string
    D: string
    E: string
  }
  division: string
  topic: string
  difficulty: number
}

export async function importQuestions(questions: QuestionImport[]) {
  try {
    console.log(`Starting import of ${questions.length} questions...`)
    
    // Process questions in batches of 100 to avoid overwhelming the database
    const batchSize = 100
    for (let i = 0; i < questions.length; i += batchSize) {
      const batch = questions.slice(i, i + batchSize)
      
      const { data, error } = await supabase
        .from('questions')
        .insert(batch)
        .select()

      if (error) {
        console.error(`Error importing batch ${i / batchSize + 1}:`, error)
        throw error
      }

      console.log(`Successfully imported batch ${i / batchSize + 1} (${batch.length} questions)`)
    }

    console.log('Question import completed successfully!')
    return { success: true }
  } catch (error) {
    console.error('Failed to import questions:', error)
    return { success: false, error }
  }
}

// Example usage:
/*
const questions = [
  {
    question_text: "5+3(4-1*3+1)-3. Mansoo confused addition and subtraction...",
    answer_choices: {
      A: "-13",
      B: "-10",
      C: "8",
      D: "11",
      E: "NOTA"
    },
    division: "Algebra",
    topic: "Order of Operations",
    difficulty: 2
  },
  // ... more questions
]

await importQuestions(questions)
*/ 
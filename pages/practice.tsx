import { ProtectedRoute } from '../components/ProtectedRoute'
import { Navbar } from '../components/Navbar'

export default function PracticePage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          {/* Your existing practice page content */}
        </main>
      </div>
    </ProtectedRoute>
  )
} 
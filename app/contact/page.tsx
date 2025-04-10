'use client';


import { useAuth } from '../../contexts/AuthContext'


export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <main className="flex-grow flex items-center justify-center p-6">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Info/>
          </div>
        </div>
      </main>
    </div>
  )
}

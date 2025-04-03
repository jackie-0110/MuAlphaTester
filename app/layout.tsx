import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '../contexts/AuthContext'
import { Navbar } from '../components/Navbar'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'FAMATester',
  description: 'Practice and test your FAMAT skills',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white`}>
        <AuthProvider>
          <Navbar />
          <main className="min-h-screen bg-white">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  )
}

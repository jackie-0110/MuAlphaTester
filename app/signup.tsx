import Image from "next/image";
import Link from "next/link";
import { Navbar } from "./components/Navbar";
import { LoginForm, SignUpForm } from './components/AuthForm'

export default function AuthPage() {
  return (
    <div className="min-h-screen bg-blue-50 flex flex-col">
      <main className="flex-grow flex items-center justify-center p-6">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <LoginForm />
            <SignUpForm />
          </div>
        </div>
      </main>
    </div>
  )
}

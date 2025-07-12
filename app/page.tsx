'use client'

import Link from "next/link";
import { useState, useEffect } from "react";

export default function Home() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % 3);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const steps = [
    { title: "Practice", icon: "📚", description: "Master FAMAT concepts" },
    { title: "Adapt", icon: "🧠", description: "Learn at your pace" },
    { title: "Excel", icon: "🏆", description: "Achieve your goals" }
  ];

  return (
    <div className="min-h-screen overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-blue-50 to-purple-50"></div>
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-pink-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center px-4">
        <div className="max-w-7xl mx-auto text-center">
          {/* Floating Elements */}
          <div className="absolute top-20 left-10 w-20 h-20 bg-blue-200 rounded-full opacity-60 animate-bounce"></div>
          <div className="absolute top-40 right-20 w-16 h-16 bg-purple-200 rounded-full opacity-60 animate-bounce animation-delay-1000"></div>
          <div className="absolute bottom-40 left-20 w-12 h-12 bg-pink-200 rounded-full opacity-60 animate-bounce animation-delay-2000"></div>
          
          {/* Main Content */}
          <div className={`transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <div className="relative">
              <h1 className="text-5xl sm:text-7xl font-bold text-gray-900 mb-6 leading-tight">
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  FAMAT
                </span>
                <br />
                <span className="text-3xl sm:text-5xl text-gray-700">Training Platform</span>
              </h1>
            </div>
            
            <p className="text-xl sm:text-2xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed">
              Master mathematics through{" "}
              <span className="font-semibold text-blue-600">adaptive practice</span> and{" "}
              <span className="font-semibold text-purple-600">intelligent learning</span>
            </p>

                         {/* Interactive CTA Buttons */}
             <div className="flex justify-center items-center mb-16">
               <Link
                 href="/signup"
                 className="group relative px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-full text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 overflow-hidden"
               >
                 <span className="relative z-10">Get Started</span>
                 <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
               </Link>
             </div>

            {/* Animated Progress Steps */}
            <div className="max-w-md mx-auto">
              <div className="flex justify-center space-x-4 mb-4">
                {steps.map((step, index) => (
                  <div
                    key={index}
                    className={`w-3 h-3 rounded-full transition-all duration-500 ${
                      index === currentStep ? 'bg-blue-600 scale-125' : 'bg-gray-300'
                    }`}
                  />
                ))}
              </div>
              <div className="text-center">
                <div className="text-4xl mb-2">{steps[currentStep].icon}</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-1">
                  {steps[currentStep].title}
                </h3>
                <p className="text-gray-600">{steps[currentStep].description}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

             {/* Interactive Features Section */}
       <section className="relative py-20 bg-white">
         <div className="max-w-7xl mx-auto px-4">
           <div className="text-center mb-16">
             <h2 className="text-4xl font-bold text-gray-900 mb-4">
               Built for Mu Alpha Theta
             </h2>
             <p className="text-xl text-gray-600 max-w-2xl mx-auto">
               The first dedicated training platform designed specifically for MAΘ competition preparation
             </p>
           </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Column - Interactive Demo */}
            <div className="space-y-8">
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-8 border border-gray-100 shadow-lg">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900">Adaptive Learning</h3>
                </div>
                                 <p className="text-gray-600 leading-relaxed">
                   Practice with questions specifically designed for MAΘ competitions, with difficulty levels that match real tournament challenges.
                 </p>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-8 border border-gray-100 shadow-lg">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900">Real-time Analytics</h3>
                </div>
                                 <p className="text-gray-600 leading-relaxed">
                   Track your performance across different MAΘ topics and divisions, with detailed analytics to identify your strengths and areas for improvement.
                 </p>
              </div>
            </div>

            {/* Right Column - Visual Elements */}
            <div className="relative">
              <div className="relative z-10 bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-500">Progress</span>
                    <span className="text-sm font-bold text-blue-600">85%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-1000" style={{ width: '85%' }}></div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">24</div>
                      <div className="text-sm text-gray-600">Questions</div>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">18</div>
                      <div className="text-sm text-gray-600">Correct</div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Floating Elements */}
              <div className="absolute -top-4 -right-4 w-8 h-8 bg-yellow-400 rounded-full animate-pulse"></div>
              <div className="absolute -bottom-4 -left-4 w-6 h-6 bg-green-400 rounded-full animate-pulse animation-delay-1000"></div>
            </div>
          </div>
        </div>
      </section>

             {/* Call to Action */}
       <section className="relative py-20 bg-gradient-to-r from-blue-600 to-purple-600 overflow-hidden">
         <div className="absolute inset-0 bg-black opacity-10"></div>
         <div className="relative max-w-4xl mx-auto text-center px-4">
           <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
             Ready to Excel in MAΘ?
           </h2>
           <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
             Start practicing with questions designed specifically for Mu Alpha Theta competitions.
           </p>
           <div className="flex justify-center">
             <Link
               href="/signup"
               className="group px-8 py-4 bg-white text-blue-600 font-semibold rounded-full text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
             >
               Get Started
             </Link>
           </div>
         </div>
       </section>
    </div>
  );
}

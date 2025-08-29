'use client'

import Link from "next/link";
import { useState, useEffect } from "react";

export default function Home() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);



  return (
    <div className="min-h-screen overflow-hidden">
      {/* simple background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gray-50"></div>
      </div>

      {/* main hero section */}
      <section className="relative min-h-screen flex items-center justify-center px-4">
        <div className="max-w-7xl mx-auto text-center">

          
          {/* main content area */}
          <div className={`transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <div className="relative">
              <h1 className="text-5xl sm:text-7xl font-bold text-gray-900 mb-6 leading-tight">
                <span className="bg-blue-600 bg-clip-text text-transparent">
                  MAΘ
                </span>
                <br />
                <span className="text-3xl sm:text-5xl text-gray-700">Training Platform</span>
              </h1>
            </div>
            
            <p className="text-xl sm:text-2xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed">
              Master mathematics through{" "}
              <span className="font-semibold text-blue-600">adaptive practice</span> and{" "}
              <span className="font-semibold text-blue-600">intelligent learning</span>
            </p>

                         {/* call to action buttons */}
             <div className="flex justify-center items-center mb-16">
               <Link
                 href="/signup"
                 className="group relative px-8 py-4 bg-blue-600 text-white font-semibold rounded-full text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 overflow-hidden"
               >
                 <span className="relative z-10">Get Started</span>
                 <div className="absolute inset-0 bg-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
               </Link>
             </div>


          </div>
        </div>
      </section>

             {/* features showcase section */}
       <section className="relative py-20 bg-white">
         <div className="max-w-7xl mx-auto px-4">
           <div className="text-center mb-16">
             <h2 className="text-4xl font-bold text-gray-900 mb-4">
               Built for MAΘ
             </h2>
             <p className="text-xl text-gray-600 max-w-2xl mx-auto">
               The first dedicated training platform designed specifically for MAΘ competition preparation
             </p>
           </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* left column with feature cards */}
            <div className="space-y-8">
              <div className="bg-blue-50 rounded-2xl p-8 border border-gray-100 shadow-lg">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900">Adaptive Learning</h3>
                </div>
                                 <p className="text-gray-600 leading-relaxed">
                   Practice that adapts to your level based on your performance.
                 </p>
              </div>

              <div className="bg-gray-50 rounded-2xl p-8 border border-gray-100 shadow-lg">
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

            {/* right column with progress demo */}
            <div className="relative">
              <div className="relative z-10 bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-500">Progress</span>
                    <span className="text-sm font-bold text-blue-600">85%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div className="bg-blue-500 h-3 rounded-full transition-all duration-1000" style={{ width: '85%' }}></div>
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
              

            </div>
          </div>
        </div>
      </section>

       {/* Footer */}
       <footer className="bg-gray-800 text-white py-6">
         <div className="max-w-7xl mx-auto px-4 text-center">
           <div className="flex flex-wrap justify-center items-center space-x-4 mb-3">
             <Link href="/features" className="text-blue-300 hover:text-blue-200 transition-colors">
               About
             </Link>
             <span className="text-gray-500">•</span>
             <Link href="https://github.com/jackie-0110/MuAlphaTester" className="text-blue-300 hover:text-blue-200 transition-colors">
               Github
             </Link>
             <span className="text-gray-500">•</span>
             <Link href="mailto:jackieec956@gmail.com" className="text-blue-300 hover:text-blue-200 transition-colors">
               Contact
             </Link>
           </div>
           <p className="text-gray-300">
             Made by John (Jackie) Courtney
           </p>
         </div>
       </footer>
    </div>
  );
}

'use client';

import Image from 'next/image';

export default function Info() {
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Shoutout Phil Savage!</h2>
      <div className="relative w-64 h-64">
        <Image
          src="/savage.png"
          alt="Savage"
          fill
          className="object-cover rounded-lg"
          priority
        />
      </div>
      <p className="text-center text-gray-500">Email: <a href="mailto:jackieec956@gmail.com" className="text-blue-500 hover:text-blue-700">jackieec956@gmail.com</a> </p>
    </div>
  );
}

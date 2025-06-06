'use client';

import * as React from 'react';
const { useState } = React;
import Image from 'next/image';

interface Agent {
  id: string;
  name: string;
  isActive?: boolean;
}

interface ChatInterfaceProps {
  userName: string;
  agents?: Agent[];
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ userName }: ChatInterfaceProps) => {
  const [message, setMessage] = useState('');

  return (
    <div className="flex flex-col h-full max-w-6xl mx-auto w-full">
      {/* Welcome Header */}
      <div className="mb-10 md:mb-12 text-center">
        <h1 className="text-3xl md:text-4xl font-bold">
          Olá, <span className="text-[#FF6B00]">{userName}.</span>
        </h1>
        <p className="text-gray-400 mt-2">Como está seu dia hoje?</p>
      </div>

      {/* Chat Input */}
      <div className="mt-auto w-full">
        <div className="relative max-w-4xl mx-auto w-full">
          <input
            type="text"
            className="w-full bg-gray-800 border border-gray-700 focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] text-white rounded-lg py-3 px-4 pr-20 outline-none transition-colors duration-200"
            placeholder="Pergunte alguma coisa"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
            <button className="p-1 text-gray-400 hover:text-[#FF6B00] transition-colors duration-200">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </button>
            <button className="p-1 text-gray-400 hover:text-[#FF6B00] transition-colors duration-200">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
            <button className="p-2 rounded-full bg-[#FF6B00] hover:bg-[#E05E00] text-white transition-colors duration-200">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;

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
  agents: Agent[];
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ userName, agents }: ChatInterfaceProps) => {
  const [message, setMessage] = useState('');

  return (
    <div className="flex flex-col h-full max-w-6xl mx-auto w-full">
      {/* Welcome Header */}
      <div className="mb-6 md:mb-8 text-center">
        <h1 className="text-3xl md:text-4xl font-bold">
          Seja bem-vinda, <span className="text-[#FF6B00]">{userName}.</span>
        </h1>
        <p className="text-gray-400 mt-2">Como está seu dia hoje?</p>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row justify-center gap-3 md:gap-4 mb-6 md:mb-8">
        <button className="bg-[#FF6B00] hover:bg-[#E05E00] text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
            <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
          </svg>
          Iniciar novo chat
        </button>
        <button className="bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
          Buscar chats
        </button>
        <a href="/dashboard/scripts" className="bg-[#FF6B00] hover:bg-[#E05E00] text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
          Gerar Script de Reunião
        </a>
      </div>

      {/* Agents Section */}
      <div className="mb-8">
        <h2 className="text-[#FF6B00] font-semibold mb-4">Seus agentes</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {agents.map((agent: Agent) => (
            <button 
              key={agent.id}
              className={`flex items-center gap-2 p-3 rounded-md border transition-all duration-200 ${
                agent.isActive 
                  ? 'border-[#FF6B00] bg-gray-800' 
                  : 'border-gray-700 hover:border-[#FF6B00] hover:bg-gray-800/50'
              }`}
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#FF6B00] text-white">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 005 10a6 6 0 0012 0c0-.35-.035-.691-.1-1.02A5 5 0 0010 11z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="font-medium">{agent.name}</span>
            </button>
          ))}
        </div>
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

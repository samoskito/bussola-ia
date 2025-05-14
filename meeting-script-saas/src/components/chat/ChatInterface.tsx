import React, { useState } from 'react';
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

const ChatInterface: React.FC<ChatInterfaceProps> = ({ userName, agents }) => {
  const [message, setMessage] = useState('');

  return (
    <div className="flex flex-col h-full">
      {/* Welcome Header */}
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold">
          Seja bem-vinda, <span className="text-primary">{userName}.</span>
        </h1>
        <p className="text-gray-400 mt-2">Como está seu dia hoje?</p>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center gap-4 mb-8">
        <button className="btn-primary">
          Iniciar novo chat
        </button>
        <button className="btn-secondary flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
          Buscar chats
        </button>
      </div>

      {/* Agents Section */}
      <div className="mb-8">
        <h2 className="text-primary font-semibold mb-4">Seus agentes</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {agents.map((agent) => (
            <button 
              key={agent.id}
              className={`flex items-center gap-2 p-3 rounded-md border ${
                agent.isActive 
                  ? 'border-primary bg-dark-300' 
                  : 'border-gray-700 hover:border-primary'
              }`}
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 005 10a6 6 0 0012 0c0-.35-.035-.691-.1-1.02A5 5 0 0010 11z" clipRule="evenodd" />
                </svg>
              </div>
              <span>{agent.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Input */}
      <div className="mt-auto">
        <div className="relative">
          <input
            type="text"
            className="input-field pr-20"
            placeholder="Pergunte alguma coisa"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
            <button className="p-1 text-gray-400 hover:text-white">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </button>
            <button className="p-1 text-gray-400 hover:text-white">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
            <button className="p-1 text-gray-400 hover:text-white">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;

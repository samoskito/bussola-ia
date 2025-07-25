'use client';

import * as React from 'react';
const { useState, useEffect } = React;
import { useRouter } from 'next/navigation';

interface Agent {
  id: string;
  name: string;
  isActive?: boolean;
}

interface ApresentacaoInterfaceProps {
  userName: string;
  agents?: Agent[];
}

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  isTyping?: boolean; // Indica se a mensagem é uma animação de digitação
}

const ApresentacaoInterface: React.FC<ApresentacaoInterfaceProps> = ({ userName }: ApresentacaoInterfaceProps) => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const router = useRouter();
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    // Não enviar mensagem vazia
    if (!message.trim()) return;
    
    // Resetar erro
    setError(null);
    
    // Adicionar mensagem do usuário à lista local
    const userMessage: Message = {
      id: Date.now().toString(),
      content: message,
      role: 'user',
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    
    // Limpar campo de mensagem
    setMessage('');
    
    // Iniciar loading
    setIsLoading(true);
    
    try {
      // Enviar mensagem para API
      const response = await fetch('/api/chats/create-apresentacao', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage.content }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao enviar mensagem');
      }
      
      const data = await response.json();
      
      // Armazenar ID do chat atual
      if (data.chat && data.chat.id) {
        setCurrentChatId(data.chat.id);
        
        // Redirecionar para a página do chat específico com parâmetro indicando novo chat
        router.push(`/dashboard/chat/${data.chat.id}?new=true&type=apresentacao`);
      }
      
      // Adicionar mensagem de confirmação
      setMessages(prev => [
        ...prev, 
        {
          id: 'system-' + Date.now().toString(),
          content: '...',
          role: 'assistant',
          timestamp: new Date(),
          isTyping: true // Marcador para identificar que é uma mensagem de "pensando"
        }
      ]);
      
    } catch (err: any) {
      console.error('Erro ao enviar mensagem:', err);
      setError(err.message || 'Ocorreu um erro ao enviar sua mensagem');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Welcome Header */}
      <div className="text-center py-6 md:py-10 bg-gradient-to-b from-gray-900 to-gray-950 border-b border-gray-800 px-4">
        <h1 className="text-2xl md:text-4xl font-bold">
          Olá, <span className="text-[#FF6B00]">{userName}.</span>
        </h1>
        <p className="text-gray-400 mt-2 text-base md:text-lg">
          Como posso ajudar você com a apresentação de resultados hoje?
        </p>
      </div>
      
      {/* Messages Area */}
      <div className="flex-grow overflow-y-auto space-y-3 md:space-y-4 px-4 md:px-8 py-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900">
        {messages.length === 0 && !isLoading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-400 max-w-md mx-auto px-4">
              <div className="mb-8">
                <div className="w-28 h-28 mx-auto bg-[#FF6B00]/10 rounded-full flex items-center justify-center shadow-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-14 w-14 text-[#FF6B00]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
              </div>
              <h3 className="text-2xl font-medium mb-4">Inicie uma nova conversa</h3>
              <p className="text-lg">Envie uma mensagem para começar a conversar com o assistente de Apresentação de Resultado</p>
            </div>
          </div>
        )}
        
        {messages.map((msg) => (
          <div 
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn mb-4`}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-orange-600 flex items-center justify-center mr-3 flex-shrink-0 shadow-md">
                <span className="text-white text-xs md:text-sm font-bold">IA</span>
              </div>
            )}
            <div 
              className={`max-w-[75%] md:max-w-[80%] rounded-xl px-4 py-3 md:px-5 md:py-4 shadow-lg ${msg.role === 'user' 
                ? 'bg-[#FF6B00] text-white' 
                : 'bg-gray-800 text-white border border-gray-700'}`}
            >
              {msg.isTyping ? (
                <div className="flex items-center space-x-2 py-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-gray-400 animate-bounce"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                </div>
              ) : (
                <p className="whitespace-pre-wrap text-sm md:text-base">{msg.content}</p>
              )}
              <p className="text-[10px] md:text-xs opacity-70 mt-2 md:mt-3 text-right">
                {msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </p>
            </div>
            {msg.role === 'user' && (
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gray-700 flex items-center justify-center ml-3 flex-shrink-0 shadow-md">
                <span className="text-white text-xs md:text-sm font-bold">EU</span>
              </div>
            )}
          </div>
        ))}
        
        {/* Removido o indicador de carregamento redundante, pois agora usamos a animação nas mensagens */}
      </div>
      
      {/* Error message */}
      {error && (
        <div className="px-4 py-2 bg-gray-900 border-t border-gray-800">
          <div className="bg-red-500 bg-opacity-10 border border-red-500 text-red-500 px-4 py-2 rounded-lg">
            {error}
            <button 
              onClick={() => setError(null)} 
              className="ml-2 text-red-400 hover:text-red-300"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Chat Input */}
      <div className="w-full px-4 sm:px-6 py-4 md:py-6 bg-gray-900 border-t border-gray-800 shadow-lg">
        <form onSubmit={handleSendMessage} className="relative max-w-5xl mx-auto w-full">
          <input
            type="text"
            className="w-full bg-gray-800 border border-gray-700 focus:border-[#FF6B00] focus:ring-2 focus:ring-[#FF6B00]/30 text-white rounded-xl py-3 md:py-4 px-4 md:px-5 pr-20 md:pr-24 text-sm md:text-base outline-none transition-colors duration-200 shadow-lg"
            placeholder="Envie uma mensagem..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          <div className="absolute right-2 md:right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2 md:gap-3">
            <button 
              type="button"
              className="p-1.5 text-gray-400 hover:text-[#FF6B00] transition-colors duration-200"
              disabled={isLoading}
              title="Anexar arquivo"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-6 md:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>
            <button 
              type="submit"
              className={`p-2 md:p-2.5 rounded-full ${isLoading ? 'bg-gray-600' : 'bg-[#FF6B00] hover:bg-[#E05E00]'} text-white transition-colors duration-200 shadow-md`}
              disabled={isLoading || !message.trim()}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ApresentacaoInterface;

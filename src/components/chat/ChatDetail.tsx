'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

interface ChatDetailProps {
  chatId: string;
  userName: string;
}

const ChatDetail: React.FC<ChatDetailProps> = ({ chatId, userName }) => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  
  // Função para rolar para o final das mensagens
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  // Efeito para carregar mensagens do chat quando o componente montar
  useEffect(() => {
    // Aqui você implementaria a lógica para carregar as mensagens do chat do backend
    // Por enquanto, vamos simular uma mensagem inicial do sistema
    setMessages([
      {
        id: 'system-welcome',
        content: `Olá! Este é o início da sua conversa. ID do Chat: ${chatId}`,
        role: 'assistant',
        timestamp: new Date()
      }
    ]);
  }, [chatId]);
  
  // Rolar para o final quando as mensagens mudarem
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
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
      // Enviar mensagem para o webhook
      const response = await fetch('/api/chats/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          chatId: chatId,
          message: userMessage.content 
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao enviar mensagem');
      }
      
      // Adicionar mensagem de confirmação
      setMessages(prev => [
        ...prev, 
        {
          id: 'system-' + Date.now().toString(),
          content: 'Mensagem enviada com sucesso! Aguardando resposta...',
          role: 'assistant',
          timestamp: new Date()
        }
      ]);
      
    } catch (err: any) {
      console.error('Erro ao enviar mensagem:', err);
      setError(err.message || 'Ocorreu um erro ao enviar sua mensagem');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-80px)] w-full px-0">
      {/* Messages Area */}
      <div className="flex-grow overflow-y-auto space-y-4 px-6 md:px-8 py-6 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900">
        {messages.length === 0 && !isLoading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-400">
              <div className="mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <h3 className="text-xl font-medium mb-2">Inicie uma nova conversa</h3>
              <p>Envie uma mensagem para começar a conversar com a Bússola IA</p>
            </div>
          </div>
        )}
        
        {messages.map((msg) => (
          <div 
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-orange-600 flex items-center justify-center mr-2 flex-shrink-0">
                <span className="text-white text-xs font-bold">IA</span>
              </div>
            )}
            <div 
              className={`max-w-[80%] rounded-lg px-4 py-3 shadow-md ${msg.role === 'user' 
                ? 'bg-[#FF6B00] text-white' 
                : 'bg-gray-800 text-white border border-gray-700'}`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              <p className="text-xs opacity-70 mt-2 text-right">
                {msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </p>
            </div>
            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center ml-2 flex-shrink-0 mt-1">
                <span className="text-white text-xs font-bold">EU</span>
              </div>
            )}
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start animate-fadeIn">
            <div className="w-8 h-8 rounded-full bg-orange-600 flex items-center justify-center mr-2 flex-shrink-0">
              <span className="text-white text-xs font-bold">IA</span>
            </div>
            <div className="bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-3 shadow-md">
              <div className="flex space-x-2">
                <div className="w-2 h-2 rounded-full bg-gray-500 animate-pulse"></div>
                <div className="w-2 h-2 rounded-full bg-gray-500 animate-pulse delay-100"></div>
                <div className="w-2 h-2 rounded-full bg-gray-500 animate-pulse delay-200"></div>
              </div>
            </div>
          </div>
        )}
        
        {/* Elemento invisível para rolar para o final */}
        <div ref={messagesEndRef} className="h-4" />
      </div>
      
      {/* Error message */}
      {error && (
        <div className="px-4 py-2 bg-gray-900 border-t border-gray-800">
          <div className="bg-red-500 bg-opacity-10 border border-red-500 text-red-500 px-4 py-2 rounded-lg flex items-center justify-between">
            <span>{error}</span>
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
      <div className="w-full px-6 md:px-8 py-4 bg-gray-900 border-t border-gray-800">
        <form onSubmit={handleSendMessage} className="relative w-full">
          <input
            type="text"
            className="w-full bg-gray-800 border border-gray-700 focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] text-white rounded-lg py-3 px-4 pr-20 outline-none transition-colors duration-200 shadow-lg"
            placeholder="Envie uma mensagem..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
            <button 
              type="button"
              className="p-1 text-gray-400 hover:text-[#FF6B00] transition-colors duration-200"
              disabled={isLoading}
              title="Anexar arquivo"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>
            <button 
              type="submit"
              className={`p-2 rounded-full ${isLoading ? 'bg-gray-600' : 'bg-[#FF6B00] hover:bg-[#E05E00]'} text-white transition-colors duration-200 shadow-md`}
              disabled={isLoading || !message.trim()}
              title="Enviar mensagem"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatDetail;

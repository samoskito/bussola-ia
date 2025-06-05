"use client";

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { v4 as uuidv4 } from 'uuid';

interface Agent {
  id: string;
  name: string;
  isActive?: boolean;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ScriptGeneratorChatProps {
  userName: string;
  agents: Agent[];
}

const ScriptGeneratorChat: React.FC<ScriptGeneratorChatProps> = ({ 
  userName, 
  agents 
}) => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(agents.find(agent => agent.isActive) || null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Rolar para a última mensagem quando novas mensagens são adicionadas
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!message.trim()) return;
    
    try {
      setLoading(true);
      
      // Adicionar mensagem do usuário
      const userMessage: Message = {
        id: uuidv4(),
        role: 'user',
        content: message,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, userMessage]);
      setMessage('');
      
      // Simular resposta do assistente após um pequeno delay
      setTimeout(() => {
        // Adicionar mensagem do assistente
        const assistantMessage: Message = {
          id: uuidv4(),
          role: 'assistant',
          content: generateAssistantResponse(message),
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, assistantMessage]);
        setLoading(false);
      }, 1500);
      
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      setLoading(false);
    }
  };

  const generateAssistantResponse = (userMessage: string): string => {
    // Simular resposta do assistente baseada na mensagem do usuário
    if (userMessage.toLowerCase().includes('script')) {
      return `Claro, posso ajudar a gerar um script para sua reunião. Para criar um script eficaz, preciso de algumas informações:\n\n1. Qual é o objetivo principal da reunião?\n2. Quem são os participantes?\n3. Quanto tempo está previsto para a reunião?\n4. Quais tópicos específicos você gostaria de abordar?`;
    } else if (userMessage.toLowerCase().includes('reunião')) {
      return `Para preparar sua reunião, posso ajudar com um script estruturado. Me conte mais sobre o contexto da reunião e seus objetivos principais.`;
    } else {
      return `Olá! Sou o assistente de geração de scripts da Bússola Executiva. Posso ajudar você a criar scripts para reuniões, apresentações e outros eventos profissionais. Como posso ajudar hoje?`;
    }
  };

  const selectAgent = (agent: Agent) => {
    setSelectedAgent(agent);
    // Reset das mensagens ao trocar de agente
    setMessages([]);
    // Foco no input após selecionar um agente
    inputRef.current?.focus();
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const startNewChat = () => {
    setMessages([]);
    inputRef.current?.focus();
  };

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
        <button 
          className="btn-primary flex items-center gap-2"
          onClick={startNewChat}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Iniciar novo chat
        </button>
        <button className="btn-secondary flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
          Buscar chats
        </button>
        <a href="/dashboard/scripts" className="btn-primary flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
          Gerar Script de Reunião
        </a>
      </div>

      {/* Agents Section */}
      <div className="mb-8">
        <h2 className="text-primary font-semibold mb-4">Seus agentes</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {agents.map((agent) => (
            <button 
              key={agent.id}
              className={`flex items-center gap-2 p-3 rounded-md border ${
                selectedAgent?.id === agent.id 
                  ? 'border-primary bg-dark-300' 
                  : 'border-gray-700 hover:border-primary'
              }`}
              onClick={() => selectAgent(agent)}
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

      {/* Messages */}
      <div className="flex-grow overflow-y-auto mb-4 px-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64">
            <div className="text-primary mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-gray-400">Nenhuma mensagem ainda. Comece uma conversa!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-3/4 p-3 rounded-lg ${
                    msg.role === 'user'
                      ? 'bg-primary text-white'
                      : 'bg-dark-300 text-white'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                  <div className={`text-xs mt-1 ${msg.role === 'user' ? 'text-white/70' : 'text-gray-400'}`}>
                    {formatTime(msg.timestamp)}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Chat Input */}
      <div className="mt-auto">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            className="input-field pr-20"
            placeholder="Pergunte alguma coisa"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
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
            <button 
              className="p-1 text-primary hover:text-white"
              onClick={handleSendMessage}
              disabled={loading}
            >
              {loading ? (
                <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScriptGeneratorChat;

'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { AgentType } from '@/lib/agents';
import { getAgentByType, getAgentLabel } from '@/lib/agents';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  isTyping?: boolean; // Indica se a mensagem é uma animação de digitação
}

interface ScriptMessage {
  id: string;
  user_id: string;
  chat_id: string;
  input: string;
  output: string | null;
  created_at: string;
  updated_at: string;
}

interface ChatDetailProps {
  chatId: string;
  userName: string;
  chatType?: 'script' | 'apresentacao';
  agentType?: AgentType | null;
  agentName?: string;
}

const ChatDetail: React.FC<ChatDetailProps> = ({ chatId, userName, chatType, agentType, agentName }) => {
  // Determinar o tipo de chat a partir da URL se não for fornecido como prop
  const [chatTypeState, setChatTypeState] = useState<'script' | 'apresentacao' | undefined>(chatType);
  const [agentTypeState, setAgentTypeState] = useState<AgentType>(
    agentType || (chatType === 'apresentacao' ? 'apresentacao' : 'comunicacao')
  );

  useEffect(() => {
    if (agentType) {
      setAgentTypeState(agentType);
      setChatTypeState(agentType === 'apresentacao' ? 'apresentacao' : 'script');
    }
  }, [agentType]);
  
  useEffect(() => {
    if (!chatTypeState) {
      // Verificar se há parâmetro de tipo na URL
      const urlParams = new URLSearchParams(window.location.search);
      const typeParam = urlParams.get('type');
      const urlAgent = typeParam ? getAgentByType(typeParam) : null;
      
      if (urlAgent) {
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.log(`[ChatDetail] Detectado agente do chat: ${urlAgent.type} (da URL)`);
        }
        setAgentTypeState(urlAgent.type);
        setChatTypeState(urlAgent.type === 'apresentacao' ? 'apresentacao' : 'script');
      } else {
        // Padrão é script
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.log(`[ChatDetail] Detectado tipo de chat: script (padrão)`);
        }
        setAgentTypeState('comunicacao');
        setChatTypeState('script');
      }
    } else {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log(`[ChatDetail] Usando tipo de chat definido por props: ${chatTypeState}`);
      }
    }
  }, [chatTypeState]);
  
  // Efeito para verificar o tipo de chat quando o componente montar
  useEffect(() => {
    // Verificar o tipo de chat a partir dos dados do chat
    const fetchChatType = async () => {
      try {
        const response = await fetch(`/api/chats/${chatId}`);
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.chat) {
            const chatAgent = getAgentByType((data.chat.agent_type as string | null) || 'comunicacao');
            const resolvedAgentType = chatAgent?.type || 'comunicacao';
            setAgentTypeState(resolvedAgentType);
            setChatTypeState(resolvedAgentType === 'apresentacao' ? 'apresentacao' : 'script');
          }
        }
      } catch (error) {
        console.error('Erro ao buscar tipo de chat:', error);
      }
    };
    
    // Tentar detectar o tipo de chat a partir dos dados do chat
    fetchChatType();
  }, [chatId]);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPendingMessages, setHasPendingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Função para rolar para o final das mensagens
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  // Função para buscar mensagens do chat
  const fetchChatMessages = async () => {
    try {
      setError(null);
      
      const response = await fetch(`/api/chats/${chatId}/messages`);
      
      if (!response.ok) {
        throw new Error('Erro ao carregar mensagens do chat');
      }
      
      const data = await response.json();
      
      if (data.success && data.messages) {
        // Converter as mensagens do formato da API para o formato usado pelo componente
        const formattedMessages: Message[] = [];
        let pendingMessages = false;
        let lastUserMessageWithoutResponse = false;
        
        data.messages.forEach((msg: ScriptMessage) => {
          // Adicionar mensagem do usuário
          formattedMessages.push({
            id: `user-${msg.id}`,
            content: msg.input,
            role: 'user',
            timestamp: new Date(msg.created_at)
          });
          
          // Adicionar resposta da IA se existir
          if (msg.output) {
            formattedMessages.push({
              id: `assistant-${msg.id}`,
              content: msg.output,
              role: 'assistant',
              timestamp: new Date(msg.updated_at)
            });
            lastUserMessageWithoutResponse = false;
          } else {
            // Se não houver resposta, marcar como pendente
            pendingMessages = true;
            lastUserMessageWithoutResponse = true;
          }
        });
        
        // Se a última mensagem do usuário não tem resposta, adicionar a animação de digitação
        if (lastUserMessageWithoutResponse) {
          formattedMessages.push({
            id: `typing-${Date.now()}`,
            content: '...',
            role: 'assistant',
            timestamp: new Date(),
            isTyping: true
          });
        }
        
        setMessages(formattedMessages);
        setHasPendingMessages(pendingMessages);
        
        // Se não há mais mensagens pendentes, podemos parar o polling
        if (!pendingMessages && pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        
        // Se há mensagens pendentes e não há polling ativo, iniciar polling
        if (pendingMessages && !pollingIntervalRef.current) {
          startPolling();
        }
      } else {
        // Se não houver mensagens, mostrar mensagem de boas-vindas
        setMessages([
          {
            id: 'system-welcome',
            content: `Olá! Este é o início da sua conversa. ID do Chat: ${chatId}`,
            role: 'assistant',
            timestamp: new Date()
          }
        ]);
      }
    } catch (err) {
      console.error('Erro ao carregar mensagens:', err);
      setError('Não foi possível carregar as mensagens do chat');
    } finally {
      setIsLoading(false);
    }
  };

  // Função para iniciar o polling
  const startPolling = () => {
    // Limpar qualquer intervalo existente
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    // Iniciar novo intervalo de polling (verificar a cada 2 segundos)
    pollingIntervalRef.current = setInterval(() => {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log('Verificando novas respostas...');
      }
      fetchChatMessages();
    }, 2000);
  };
  
  // Efeito para carregar mensagens do chat quando o componente montar
  useEffect(() => {
    setIsLoading(true);
    fetchChatMessages();
    
    // Limpar o intervalo quando o componente for desmontado
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [chatId]);
  
  // Rolar para o final quando as mensagens mudarem
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!message.trim() || isLoading) return;
    
    // Criar objeto de mensagem do usuário
    const userMessage = {
      id: 'user-' + Date.now().toString(),
      content: message.trim(),
      role: 'user' as const,
      timestamp: new Date()
    };
    
    // Adicionar mensagem do usuário à lista
    setMessages(prev => [...prev, userMessage]);
    
    // Limpar campo de mensagem
    setMessage('');
    
    // Iniciar loading
    setIsLoading(true);
    
    try {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log(`Enviando mensagem para endpoint: /api/chats/message-agent (agente: ${agentTypeState})`);
      }
      
      // Enviar mensagem para a API
      const response = await fetch('/api/chats/message-agent', {
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
      
      const responseData = await response.json();
      
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
      
      // Iniciar polling para verificar se a resposta da IA já está disponível
      if (responseData.scriptId) {
        checkForAIResponse(responseData.scriptId);
      }
      
    } catch (err: any) {
      console.error('Erro ao enviar mensagem:', err);
      setError(err.message || 'Ocorreu um erro ao enviar sua mensagem');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Função para verificar se a resposta da IA já está disponível
  const checkForAIResponse = async (scriptId: string) => {
    let attempts = 0;
    const maxAttempts = 30; // Tentar por até 5 minutos (30 tentativas com 10 segundos de intervalo)
    
    const checkResponse = async () => {
      try {
        if (attempts >= maxAttempts) {
          setError('Tempo limite excedido ao aguardar resposta da IA');
          return;
        }
        
        attempts++;
        
        // Buscar mensagens atualizadas
        const response = await fetch(`/api/chats/${chatId}/messages`);
        
        if (!response.ok) {
          throw new Error('Erro ao verificar resposta da IA');
        }
        
        const data = await response.json();
        
        if (data.success && data.messages) {
          // Procurar pelo script com o ID específico
          const script = data.messages.find((msg: ScriptMessage) => msg.id === scriptId);
          
          if (script && script.output) {
            // Resposta da IA encontrada, atualizar a interface
            setMessages(prev => {
              // Remover a mensagem de "aguardando resposta"
              const filteredMessages = prev.filter(msg => !msg.id.includes('system-'));
              
              // Adicionar a resposta da IA
              return [...filteredMessages, {
                id: `assistant-${scriptId}`,
                content: script.output,
                role: 'assistant',
                timestamp: new Date(script.updated_at)
              }];
            });
            return; // Encerrar o polling
          }
        }
        
        // Se ainda não tiver resposta, continuar verificando
        setTimeout(checkResponse, 10000); // Verificar a cada 10 segundos
        
      } catch (err) {
        console.error('Erro ao verificar resposta da IA:', err);
        // Continuar tentando mesmo em caso de erro
        setTimeout(checkResponse, 10000);
      }
    };
    
    // Iniciar o processo de verificação
    setTimeout(checkResponse, 5000); // Primeira verificação após 5 segundos
  }
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const resolvedAgentName = agentName || getAgentLabel(agentTypeState);

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-80px)] w-full">
      {/* Messages Area */}
      <div className="flex-grow overflow-y-auto space-y-3 md:space-y-4 px-3 md:px-6 py-3 md:py-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900">
        {messages.length === 0 && !isLoading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-400 max-w-md mx-auto px-4">
              <div className="mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 mx-auto text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <h3 className="text-2xl font-medium mb-3">Inicie uma nova conversa</h3>
              <p className="text-gray-400">Envie uma mensagem para começar a conversar com {resolvedAgentName}</p>
            </div>
          </div>
        )}
        
        {messages.map((msg) => (
          <div 
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn mb-4`}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-orange-600 flex items-center justify-center mr-2 md:mr-3 flex-shrink-0 shadow-lg">
                <span className="text-white text-xs md:text-sm font-bold">IA</span>
              </div>
            )}
            <div 
              className={`max-w-[75%] md:max-w-[80%] rounded-2xl px-4 py-3 md:px-5 md:py-4 shadow-lg ${msg.role === 'user' 
                ? 'bg-[#FF6B00] text-white' 
                : 'bg-gray-800 text-white border border-gray-700'}`}
            >
              {msg.isTyping ? (
                <div className="flex items-center space-x-1 py-2">
                  <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"></div>
                  <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                </div>
              ) : (
                <p className="whitespace-pre-wrap text-sm md:text-base leading-relaxed">{msg.content}</p>
              )}
              <p className="text-[10px] md:text-xs opacity-70 mt-2 text-right">
                {msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </p>
            </div>
            {msg.role === 'user' && (
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gray-700 flex items-center justify-center ml-2 md:ml-3 flex-shrink-0 shadow-lg">
                <span className="text-white text-xs md:text-sm font-bold">EU</span>
              </div>
            )}
          </div>
        ))}
        
        {/* Elemento invisível para rolar para o final */}
        <div ref={messagesEndRef} className="h-8" />
      </div>
      
      {/* Error message */}
      {error && (
        <div className="px-4 py-3 bg-gray-900 border-t border-gray-800">
          <div className="bg-red-500 bg-opacity-10 border border-red-500 text-red-500 px-4 py-3 rounded-lg flex items-center justify-between">
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
      <div className="w-full px-3 sm:px-5 md:px-8 py-4 md:py-6 bg-gray-900 border-t border-gray-800 sticky bottom-0">
        <form onSubmit={handleSendMessage} className="relative w-full max-w-4xl mx-auto">
          <input
            type="text"
            className="w-full bg-gray-800 border border-gray-700 focus:border-[#FF6B00] focus:ring-2 focus:ring-[#FF6B00] text-white rounded-full py-3 md:py-4 px-5 md:px-6 pr-16 md:pr-24 text-sm md:text-base outline-none transition-colors duration-200 shadow-lg"
            placeholder="Envie uma mensagem..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          <div className="absolute right-2 md:right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2 md:gap-3">
            <button 
              type="button"
              className="p-1.5 md:p-2 text-gray-400 hover:text-[#FF6B00] transition-colors duration-200"
              disabled={isLoading}
              title="Anexar arquivo"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-6 md:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>
            <button 
              type="submit"
              className={`p-2 md:p-3 rounded-full ${isLoading ? 'bg-gray-600' : 'bg-[#FF6B00] hover:bg-[#E05E00]'} text-white transition-colors duration-200 shadow-lg`}
              disabled={isLoading || !message.trim()}
              title="Enviar mensagem"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-6 md:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

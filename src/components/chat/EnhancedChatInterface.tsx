"use client";

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { sendToWebhook, checkOutputStatus } from '@/lib/webhook';
import { supabase, uploadImage, STORAGE_BUCKETS } from '@/lib/supabase';

interface Agent {
  id: string;
  name: string;
  isActive?: boolean;
}

interface User {
  id: string;
  nome: string;
  email: string;
  imagem_perfil?: string;
}

interface Chat {
  id: string;
  titulo: string;
  ultima_mensagem: string;
}

interface Message {
  id: string;
  tipo: 'usuario' | 'assistente';
  conteudo: string;
  created_at: string;
  arquivos?: {
    id: string;
    nome: string;
    tipo: string;
    url: string;
  }[];
}

interface EnhancedChatInterfaceProps {
  user: User;
  currentChat?: Chat;
  agents: Agent[];
}

const EnhancedChatInterface: React.FC<EnhancedChatInterfaceProps> = ({ 
  user, 
  currentChat, 
  agents 
}) => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [chatId, setChatId] = useState<string>(currentChat?.id || '');
  const [webhookId, setWebhookId] = useState<string>('');
  const [outputPolling, setOutputPolling] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Carregar mensagens do chat atual
  useEffect(() => {
    if (chatId) {
      loadMessages();
    }
  }, [chatId]);

  // Rolar para a última mensagem
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Verificar status do output
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (outputPolling && webhookId) {
      interval = setInterval(async () => {
        const result = await checkOutputStatus(webhookId);
        
        if (result.success && (result.status === 'concluido' || result.status === 'erro')) {
          setOutputPolling(false);
          setLoading(false);
          
          if (result.status === 'concluido' && result.output) {
            // A mensagem já foi adicionada pelo processWebhookResponse
            loadMessages();
          }
        }
      }, 2000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [outputPolling, webhookId]);

  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('mensagens')
        .select(`
          id,
          tipo,
          conteudo,
          created_at,
          arquivos:arquivos(id, nome, tipo, url)
        `)
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      setMessages(data || []);
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleFileUpload = async () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(Array.from(e.target.files));
    }
  };

  const createNewChat = async () => {
    try {
      // Criar novo chat
      const { data, error } = await supabase
        .from('chats')
        .insert({
          user_id: user.id,
          titulo: `Chat ${new Date().toLocaleString('pt-BR')}`
        })
        .select()
        .single();
      
      if (error) throw error;
      
      setChatId(data.id);
      setMessages([]);
    } catch (error) {
      console.error('Erro ao criar novo chat:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() && files.length === 0) return;
    
    try {
      setLoading(true);
      
      // Se não houver chat atual, criar um novo
      if (!chatId) {
        await createNewChat();
      }
      
      // Upload de arquivos
      const uploadedFiles = [];
      
      if (files.length > 0) {
        for (const file of files) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
          const filePath = `${user.id}/${chatId}/${fileName}`;
          
          let bucket = STORAGE_BUCKETS.CHAT_FILES;
          if (file.type.startsWith('image/')) {
            bucket = STORAGE_BUCKETS.CHAT_FILES + '/images';
          } else if (file.type === 'application/pdf') {
            bucket = STORAGE_BUCKETS.CHAT_FILES + '/pdfs';
          } else if (file.type.startsWith('audio/')) {
            bucket = STORAGE_BUCKETS.CHAT_FILES + '/audios';
          }
          
          const uploadResult = await uploadImage(bucket, filePath, file);
          
          if (uploadResult) {
            const fileUrl = supabase.storage.from(bucket).getPublicUrl(filePath).data.publicUrl;
            
            // Registrar arquivo no banco de dados
            const { data: fileData, error: fileError } = await supabase
              .from('arquivos')
              .insert({
                user_id: user.id,
                chat_id: chatId,
                nome: file.name,
                tipo: file.type,
                tamanho: file.size,
                url: fileUrl,
                bucket,
                path: filePath
              })
              .select()
              .single();
            
            if (fileError) throw fileError;
            
            uploadedFiles.push({
              id: fileData.id,
              nome: file.name,
              tipo: file.type,
              url: fileUrl
            });
          }
        }
      }
      
      // Adicionar mensagem do usuário
      const { data: messageData, error: messageError } = await supabase
        .from('mensagens')
        .insert({
          chat_id: chatId,
          user_id: user.id,
          tipo: 'usuario',
          conteudo: message,
          arquivos: uploadedFiles.length > 0 ? uploadedFiles : null
        })
        .select()
        .single();
      
      if (messageError) throw messageError;
      
      // Adicionar mensagem à lista local
      const newMessage: Message = {
        id: messageData.id,
        tipo: 'usuario',
        conteudo: message,
        created_at: new Date().toISOString(),
        arquivos: uploadedFiles
      };
      
      setMessages([...messages, newMessage]);
      
      // Enviar para o webhook
      const result = await sendToWebhook(
        user.id,
        chatId,
        message,
        uploadedFiles
      );
      
      if (result.success) {
        setWebhookId(result.webhook_id);
        setOutputPolling(true);
        
        // Adicionar mensagem de "digitando..."
        setMessages([...messages, newMessage, {
          id: 'typing',
          tipo: 'assistente',
          conteudo: 'Gerando resposta...',
          created_at: new Date().toISOString()
        }]);
      } else {
        // Adicionar mensagem de erro
        setMessages([...messages, newMessage, {
          id: 'error',
          tipo: 'assistente',
          conteudo: 'Erro ao processar mensagem. Por favor, tente novamente.',
          created_at: new Date().toISOString()
        }]);
        
        setLoading(false);
      }
      
      // Limpar campos
      setMessage('');
      setFiles([]);
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      setLoading(false);
    }
  };

  const renderFilePreview = () => {
    if (files.length === 0) return null;
    
    return (
      <div className="flex flex-wrap gap-2 mt-2">
        {files.map((file, index) => (
          <div key={index} className="flex items-center gap-2 bg-dark-300 p-2 rounded-md">
            <div className="text-primary">
              {file.type.startsWith('image/') ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                </svg>
              ) : file.type === 'application/pdf' ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                </svg>
              ) : file.type.startsWith('audio/') ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <span className="text-sm truncate max-w-xs">{file.name}</span>
            <button
              className="text-gray-400 hover:text-white"
              onClick={() => setFiles(files.filter((_, i) => i !== index))}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    );
  };

  const renderMessages = () => {
    if (messages.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-64">
          <div className="text-primary mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
            </svg>
          </div>
          <p className="text-gray-400">Nenhuma mensagem ainda. Comece uma conversa!</p>
        </div>
      );
    }
    
    return (
      <div className="space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.tipo === 'usuario' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-3/4 p-3 rounded-lg ${
                msg.tipo === 'usuario'
                  ? 'bg-primary text-white'
                  : 'bg-dark-300 text-white'
              }`}
            >
              {msg.arquivos && msg.arquivos.length > 0 && (
                <div className="mb-2 space-y-2">
                  {msg.arquivos.map((file) => (
                    <div key={file.id} className="flex items-center gap-2">
                      {file.tipo.startsWith('image/') ? (
                        <a href={file.url} target="_blank" rel="noopener noreferrer" className="block">
                          <Image
                            src={file.url}
                            alt={file.nome}
                            width={200}
                            height={150}
                            className="rounded-md object-cover"
                          />
                        </a>
                      ) : (
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-blue-400 hover:underline"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clipRule="evenodd" />
                          </svg>
                          {file.nome}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="whitespace-pre-wrap">{msg.conteudo}</div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Welcome Header */}
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold">
          Seja bem-vindo(a), <span className="text-primary">{user.nome}</span>
        </h1>
        <p className="text-gray-400 mt-2">Como posso ajudar você hoje?</p>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center gap-4 mb-8">
        <button className="btn-primary" onClick={createNewChat}>
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
          {agents.map((agent: Agent) => (
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

      {/* Messages */}
      <div className="flex-grow overflow-y-auto mb-4 px-4">
        {renderMessages()}
      </div>

      {/* File Preview */}
      {renderFilePreview()}

      {/* Chat Input */}
      <div className="mt-auto">
        <div className="relative">
          <input
            type="text"
            className="input-field pr-20"
            placeholder="Pergunte alguma coisa"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            disabled={loading}
          />
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
            <button 
              className="p-1 text-gray-400 hover:text-white"
              onClick={handleFileUpload}
              disabled={loading}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileChange}
              multiple
              accept="image/*,application/pdf,audio/*"
            />
            <button 
              className="p-1 text-gray-400 hover:text-white"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
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

export default EnhancedChatInterface;

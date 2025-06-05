/**
 * Funções para comunicação com o webhook do n8n
 * 
 * Este arquivo contém as funções necessárias para enviar dados para o webhook do n8n
 * e receber as respostas geradas pela IA.
 */

import { supabase } from './supabase';

// URL do webhook do n8n
const WEBHOOK_URL = 'https://webhook.bussolaexecutiva.com.br/webhook/inputs-bussola-script';

/**
 * Interface para os dados do usuário
 */
interface UserData {
  id: string;
  nome: string;
  email: string;
}

/**
 * Interface para os dados do chat
 */
interface ChatData {
  id: string;
  titulo: string;
}

/**
 * Interface para os dados do arquivo
 */
interface FileData {
  id: string;
  nome: string;
  tipo: string;
  url: string;
}

/**
 * Interface para os dados enviados para o webhook
 */
interface WebhookPayload {
  user: UserData;
  chat: ChatData;
  input: string;
  files?: FileData[];
  timestamp: string;
  webhook_id: string;
}

/**
 * Interface para a resposta do webhook
 */
interface WebhookResponse {
  success: boolean;
  message?: string;
  webhook_id: string;
}

/**
 * Função para enviar dados para o webhook do n8n
 * 
 * @param userId ID do usuário
 * @param chatId ID do chat
 * @param input Texto enviado pelo usuário
 * @param files Arquivos enviados pelo usuário (opcional)
 * @returns Resposta do webhook
 */
export const sendToWebhook = async (
  userId: string,
  chatId: string,
  input: string,
  files?: FileData[]
): Promise<WebhookResponse> => {
  try {
    // Buscar dados do usuário
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, nome, email')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      throw new Error(`Erro ao buscar dados do usuário: ${userError?.message || 'Usuário não encontrado'}`);
    }

    // Buscar dados do chat
    const { data: chatData, error: chatError } = await supabase
      .from('chats')
      .select('id, titulo')
      .eq('id', chatId)
      .single();

    if (chatError || !chatData) {
      throw new Error(`Erro ao buscar dados do chat: ${chatError?.message || 'Chat não encontrado'}`);
    }

    // Gerar ID único para o webhook
    const webhook_id = crypto.randomUUID();

    // Criar payload para o webhook
    const payload: WebhookPayload = {
      user: {
        id: userData.id,
        nome: userData.nome,
        email: userData.email
      },
      chat: {
        id: chatData.id,
        titulo: chatData.titulo
      },
      input,
      files,
      timestamp: new Date().toISOString(),
      webhook_id
    };

    // Registrar output no banco de dados como pendente
    const { error: outputError } = await supabase
      .from('outputs')
      .insert({
        user_id: userId,
        chat_id: chatId,
        input,
        status: 'pendente',
        webhook_id
      });

    if (outputError) {
      throw new Error(`Erro ao registrar output: ${outputError.message}`);
    }

    // Enviar dados para o webhook
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    // Verificar resposta
    if (!response.ok) {
      // Atualizar status do output para erro
      await supabase
        .from('outputs')
        .update({
          status: 'erro'
        })
        .eq('webhook_id', webhook_id);

      throw new Error(`Erro ao enviar dados para o webhook: ${response.statusText}`);
    }

    // Atualizar status do output para processando
    await supabase
      .from('outputs')
      .update({
        status: 'processando'
      })
      .eq('webhook_id', webhook_id);

    return {
      success: true,
      webhook_id
    };
  } catch (error) {
    console.error('Erro ao enviar dados para o webhook:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erro desconhecido',
      webhook_id: ''
    };
  }
};

/**
 * Função para verificar o status de um output
 * 
 * @param webhook_id ID do webhook
 * @returns Status do output
 */
export const checkOutputStatus = async (webhook_id: string) => {
  try {
    const { data, error } = await supabase
      .from('outputs')
      .select('id, status, output')
      .eq('webhook_id', webhook_id)
      .single();

    if (error) {
      throw new Error(`Erro ao verificar status do output: ${error.message}`);
    }

    return {
      success: true,
      status: data.status,
      output: data.output,
      id: data.id
    };
  } catch (error) {
    console.error('Erro ao verificar status do output:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erro desconhecido',
      status: 'erro'
    };
  }
};

/**
 * Função para receber e processar a resposta do n8n
 * 
 * @param webhook_id ID do webhook
 * @param output Texto gerado pela IA
 * @returns Resultado do processamento
 */
export const processWebhookResponse = async (webhook_id: string, output: string) => {
  try {
    // Atualizar output no banco de dados
    const { error } = await supabase
      .from('outputs')
      .update({
        output,
        status: 'concluido',
        updated_at: new Date().toISOString()
      })
      .eq('webhook_id', webhook_id);

    if (error) {
      throw new Error(`Erro ao atualizar output: ${error.message}`);
    }

    // Buscar dados do output
    const { data: outputData, error: outputError } = await supabase
      .from('outputs')
      .select('id, user_id, chat_id')
      .eq('webhook_id', webhook_id)
      .single();

    if (outputError || !outputData) {
      throw new Error(`Erro ao buscar dados do output: ${outputError?.message || 'Output não encontrado'}`);
    }

    // Registrar mensagem do assistente no histórico
    const { error: messageError } = await supabase
      .from('mensagens')
      .insert({
        chat_id: outputData.chat_id,
        user_id: outputData.user_id,
        tipo: 'assistente',
        conteudo: output
      });

    if (messageError) {
      throw new Error(`Erro ao registrar mensagem: ${messageError.message}`);
    }

    return {
      success: true,
      message: 'Resposta processada com sucesso'
    };
  } catch (error) {
    console.error('Erro ao processar resposta do webhook:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
};

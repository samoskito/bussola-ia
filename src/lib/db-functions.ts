import { supabase, getServerSupabaseClient } from './supabase';
import { User, Chat, Script } from './database.types';

// Funções para gerenciar usuários
export const getUserProfile = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    return data as User;
  } catch (error) {
    console.error('Erro ao buscar perfil do usuário:', error);
    return null;
  }
};

export const updateUserProfile = async (userId: string, userData: Partial<User>) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .update(userData)
      .eq('id', userId)
      .select()
      .single();
    
    if (error) throw error;
    return data as User;
  } catch (error) {
    console.error('Erro ao atualizar perfil do usuário:', error);
    return null;
  }
};

export const updateUserPassword = async (userId: string, newPassword: string) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .update({ senha: newPassword })
      .eq('id', userId)
      .select()
      .single();
    
    if (error) throw error;
    return data as User;
  } catch (error) {
    console.error('Erro ao atualizar senha do usuário:', error);
    return null;
  }
};

// Funções para gerenciar chats
export const createChat = async (userId: string, title: string = 'Nova Conversa') => {
  try {
    const { data, error } = await supabase
      .from('chats')
      .insert([{ user_id: userId, title }])
      .select()
      .single();
    
    if (error) throw error;
    return data as Chat;
  } catch (error) {
    console.error('Erro ao criar chat:', error);
    return null;
  }
};

export const getUserChats = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    
    if (error) throw error;
    return data as Chat[];
  } catch (error) {
    console.error('Erro ao buscar chats do usuário:', error);
    return [];
  }
};

export const updateChatTitle = async (chatId: string, title: string) => {
  try {
    const { data, error } = await supabase
      .from('chats')
      .update({ title })
      .eq('id', chatId)
      .select()
      .single();
    
    if (error) throw error;
    return data as Chat;
  } catch (error) {
    console.error('Erro ao atualizar título do chat:', error);
    return null;
  }
};

export const deleteChat = async (chatId: string) => {
  try {
    const { error } = await supabase
      .from('chats')
      .delete()
      .eq('id', chatId);
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Erro ao deletar chat:', error);
    return false;
  }
};

// Funções para gerenciar scripts
export const createScript = async (userId: string, chatId: string, input: string) => {
  try {
    const { data, error } = await supabase
      .from('scripts')
      .insert([{ user_id: userId, chatid: chatId, input }])
      .select()
      .single();
    
    if (error) throw error;
    return data as Script;
  } catch (error) {
    console.error('Erro ao criar script:', error);
    return null;
  }
};

export const updateScriptOutput = async (scriptId: number, output: string) => {
  try {
    const { data, error } = await supabase
      .from('scripts')
      .update({ output })
      .eq('id', scriptId)
      .select()
      .single();
    
    if (error) throw error;
    return data as Script;
  } catch (error) {
    console.error('Erro ao atualizar output do script:', error);
    return null;
  }
};

export const getChatScripts = async (chatId: string) => {
  try {
    const { data, error } = await supabase
      .from('scripts')
      .select('*')
      .eq('chatid', chatId)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    return data as Script[];
  } catch (error) {
    console.error('Erro ao buscar scripts do chat:', error);
    return [];
  }
};

// Funções para administradores
export const getAllUsers = async () => {
  try {
    // Esta função deve ser usada apenas com o cliente do servidor
    const supabaseServer = getServerSupabaseClient();
    const { data, error } = await supabaseServer
      .from('users')
      .select('*')
      .order('nome', { ascending: true });
    
    if (error) throw error;
    return data as User[];
  } catch (error) {
    console.error('Erro ao buscar todos os usuários:', error);
    return [];
  }
};

export const getAllScripts = async () => {
  try {
    // Esta função deve ser usada apenas com o cliente do servidor
    const supabaseServer = getServerSupabaseClient();
    const { data, error } = await supabaseServer
      .from('scripts')
      .select('*, users(nome, email)')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erro ao buscar todos os scripts:', error);
    return [];
  }
};

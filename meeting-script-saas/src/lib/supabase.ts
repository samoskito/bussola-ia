import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Funções de autenticação
export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) throw error;
  return data;
};

export const signUp = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  
  if (error) throw error;
  return data;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

// Funções para gerenciar scripts
export const saveScript = async (userId: string, title: string, content: string) => {
  const { data, error } = await supabase
    .from('scripts')
    .insert([
      { user_id: userId, title, content, created_at: new Date() }
    ]);
  
  if (error) throw error;
  return data;
};

export const getScripts = async (userId: string) => {
  const { data, error } = await supabase
    .from('scripts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data;
};

export const deleteScript = async (scriptId: string) => {
  const { error } = await supabase
    .from('scripts')
    .delete()
    .eq('id', scriptId);
  
  if (error) throw error;
};

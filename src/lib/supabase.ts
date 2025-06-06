import { createClient as createBrowserClient } from '@supabase/supabase-js'
import { Database } from '@/types/supabase'

// Create a type for the Supabase client
type SupabaseClient = ReturnType<typeof createBrowserClient<Database>>
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          updated_at?: string | null
          username: string | null
          full_name: string | null
          avatar_url: string | null
          website: string | null
        }
        Insert: {
          id: string
          updated_at?: string | null
          username?: string | null
          full_name?: string | null
          avatar_url?: string | null
          website?: string | null
        }
        Update: {
          id?: string
          updated_at?: string | null
          username?: string | null
          full_name?: string | null
          avatar_url?: string | null
          website?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
  }
}

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env.local file.'
  )
}

// Client-side Supabase client
export const createClient = () => {
  // Check if we're in the browser
  if (typeof window === 'undefined') {
    // Server-side: Return a dummy client that will be overridden by the server client
    return {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        getUser: async () => ({ data: { user: null }, error: null }),
        signInWithPassword: async () => ({ data: { session: null, user: null }, error: null }),
        signUp: async () => ({ data: { session: null, user: null }, error: null }),
        signOut: async () => ({ error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      },
    } as any
  }

  // Browser: Create a new client with browser-specific options
  const client = createBrowserClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
      global: {
        headers: {},
      },
    }
  )

  // Return the client with proper typing
  return client as unknown as SupabaseClient
}

// Create a single instance for client-side usage
export const supabase = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
)

// Server-side Supabase client
export const createServerSupabaseClient = (cookies: () => any) => {
  const cookieStore = cookies()
  
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  )
  
  const client = createClientComponent(
    supabaseUrl,
    supabaseServiceKey
  )
  
  // Return the client with proper typing
  return client as unknown as SupabaseClient
}

// Alias for backward compatibility
export const getServerSupabaseClient = createServerSupabaseClient

// Tipos para as tabelas
export type User = {
  id: number;
  nome: string;
  email: string;
  telefone?: string;
  avatar?: string;
  rua?: string;
  numero?: string;
  bairro?: string;
  cep?: string;
  cidade?: string;
  estado?: string;
  pais?: string;
  nivel: 'admin' | 'user';
  created_at?: string;
  updated_at?: string;
};

export type Chat = {
  id: string;
  user_id: number;
  title: string;
  created_at?: string;
  updated_at?: string;
};

export type Script = {
  id: number;
  user_id: number;
  input: string;
  output?: string;
  chatid: string;
  created_at?: string;
  updated_at?: string;
};


// Constantes para buckets de armazenamento
export const STORAGE_BUCKETS = {
  PROFILE_IMAGES: 'profile_images',
  CHAT_FILES: 'chat_files',
  IMAGES: 'images',
  ASSETS: 'assets',
  DOCUMENTS: 'documents'
};

// Funções para gerenciar o armazenamento de imagens
export const uploadImage = async (bucket: string, filePath: string, file: File) => {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erro ao fazer upload da imagem:', error);
    throw error;
  }
};

export const getImageUrl = (bucket: string, filePath: string) => {
  try {
    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
    return data.publicUrl;
  } catch (error) {
    console.error('Erro ao obter URL da imagem:', error);
    return null;
  }
};

export const deleteImage = async (bucket: string, filePath: string) => {
  try {
    const { error } = await supabase.storage.from(bucket).remove([filePath]);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Erro ao excluir imagem:', error);
    throw error;
  }
};

export const listImages = async (bucket: string, folderPath?: string) => {
  try {
    const { data, error } = await supabase.storage.from(bucket).list(folderPath || '');
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erro ao listar imagens:', error);
    throw error;
  }
};

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

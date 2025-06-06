import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';
import type { CookieOptions } from '@supabase/ssr';

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env.local file.'
  );
}

/**
 * Create a Supabase client for client-side usage
 * Este código só deve ser executado no navegador
 */
export function createClient() {
  // Verificar se estamos no navegador
  if (typeof window === 'undefined') {
    throw new Error('createClient deve ser usado apenas no navegador');
  }
  
  return createBrowserClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          // Get the cookie value
          const value = `; ${document.cookie}`;
          const parts = value.split(`; ${name}=`);
          if (parts.length === 2) return parts.pop()?.split(';').shift();
          return '';
        },
        set(name: string, value: string, options: CookieOptions = {}) {
          // Set the cookie with options
          let cookieString = `${name}=${value}; path=${options.path || '/'};`;
          if (options.maxAge) cookieString += ` max-age=${options.maxAge};`;
          if (options.domain) cookieString += ` domain=${options.domain};`;
          if (options.secure) cookieString += ' secure;';
          if (options.httpOnly) cookieString += ' HttpOnly;';
          if (options.sameSite) cookieString += ` samesite=${options.sameSite};`;
          document.cookie = cookieString;
        },
        remove(name: string, options: CookieOptions = {}) {
          // Remove the cookie by setting an expired date
          document.cookie = `${name}=; path=${options.path || '/'}; expires=Thu, 01 Jan 1970 00:00:00 GMT;`;
        }
      }
    }
  );
}

// Create a single instance for client-side usage
export const supabase = createClient();

/**
 * Create a Supabase client for server-side usage
 */
export function createServerSupabaseClient(cookies: () => any) {
  return createBrowserClient<Database>(
    supabaseUrl,
    supabaseServiceKey,
    {
      cookies: {
        get(name: string) {
          return cookies().get(name)?.value || '';
        },
        set(name: string, value: string, options: CookieOptions = {}) {
          cookies().set(name, value, options);
        },
        remove(name: string, options: CookieOptions = {}) {
          cookies().delete(name, options);
        }
      }
    }
  );
}

// Alias for backward compatibility
export const getServerSupabaseClient = createServerSupabaseClient;

// Types for database tables
export interface User {
  id: string;
  email: string;
  nome: string;
  telefone?: string | null;
  avatar?: string | null;
  rua?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cep?: string | null;
  cidade?: string | null;
  estado?: string | null;
  pais?: string | null;
  nivel: 'admin' | 'user';
  created_at: string;
  updated_at?: string | null;
}

export interface Chat {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at?: string | null;
}

export interface Script {
  id: string;
  user_id: string;
  input: string;
  output?: string | null;
  chatid: string;
  created_at: string;
  updated_at?: string | null;
}

// Storage bucket constants
export const STORAGE_BUCKETS = {
  PROFILE_IMAGES: 'profile_images',
  CHAT_FILES: 'chat_files',
  IMAGES: 'images',
  ASSETS: 'assets',
  DOCUMENTS: 'documents'
} as const;

type StorageBucket = typeof STORAGE_BUCKETS[keyof typeof STORAGE_BUCKETS];

// File with metadata for upload
export interface UploadFile extends File {
  path?: string;
  preview?: string;
}

/**
 * Upload a file to Supabase Storage
 */
export async function uploadFile(
  bucket: StorageBucket,
  filePath: string,
  file: File,
  options: {
    cacheControl?: string;
    upsert?: boolean;
    contentType?: string;
  } = {}
) {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: options.cacheControl || '3600',
        upsert: options.upsert !== false,
        contentType: options.contentType || file.type,
      });
    
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error uploading file:', error);
    return { 
      data: null, 
      error: error instanceof Error ? error : new Error('Failed to upload file')
    };
  }
}

/**
 * Get public URL for a file in storage
 */
export function getFileUrl(bucket: StorageBucket, filePath: string): string {
  try {
    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);
    return data.publicUrl;
  } catch (error) {
    console.error('Error getting file URL:', error);
    return '';
  }
};

/**
 * Delete a file from storage
 */
export const deleteFile = async (bucket: StorageBucket, filePath: string) => {
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([filePath]);
    
    if (error) throw error;
    return { success: true, error: null };
  } catch (error) {
    console.error('Error deleting file:', error);
    return { success: false, error };
  }
};

/**
 * List files in a storage bucket
 */
export const listFiles = async (bucket: StorageBucket, path = '') => {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(path);
    
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error listing files:', error);
    return { data: null, error };
  }
};

// Authentication functions

interface AuthResponse {
  user: any | null;
  error: Error | null;
}

/**
 * Sign in with email and password
 */
export const signIn = async (email: string, password: string): Promise<AuthResponse> => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    
    if (error) throw error;
    return { user: data.user, error: null };
  } catch (error) {
    console.error('Sign in error:', error);
    return { user: null, error: error as Error };
  }
};

/**
 * Sign up with email and password
 */
export const signUp = async (email: string, password: string): Promise<AuthResponse> => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
    });
    
    if (error) throw error;
    return { user: data.user, error: null };
  } catch (error) {
    console.error('Sign up error:', error);
    return { user: null, error: error as Error };
  }
};

/**
 * Sign out the current user
 */
export const signOut = async (): Promise<{ error: Error | null }> => {
  try {
    // Verificar se estamos no navegador
    if (typeof window === 'undefined') {
      throw new Error('signOut deve ser usado apenas no navegador');
    }
    
    // Usar nossa API personalizada de logout
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Erro ao fazer logout');
    }
    
    return { error: null };
  } catch (error) {
    console.error('Sign out error:', error);
    return { error: error as Error };
  }
};

// Script management functions

/**
 * Save a new script
 */
export const saveScript = async (
  userId: string,
  title: string,
  content: string
): Promise<{ data: any | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .from('scripts')
      .insert([
        { 
          user_id: userId, 
          title: title.trim(), 
          content,
          updated_at: new Date().toISOString()
        }
      ])
      .select()
      .single();
    
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error saving script:', error);
    return { data: null, error: error as Error };
  }
};

/**
 * Get all scripts for a user
 */
export const getScripts = async (
  userId: string
): Promise<{ data: Script[] | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .from('scripts')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    
    if (error) throw error;
    return { data: data as Script[], error: null };
  } catch (error) {
    console.error('Error fetching scripts:', error);
    return { data: null, error: error as Error };
  }
};

/**
 * Delete a script by ID
 */
export const deleteScript = async (
  scriptId: string
): Promise<{ success: boolean; error: Error | null }> => {
  try {
    const { error } = await supabase
      .from('scripts')
      .delete()
      .eq('id', scriptId);
    
    if (error) throw error;
    return { success: true, error: null };
  } catch (error) {
    console.error('Error deleting script:', error);
    return { success: false, error: error as Error };
  }
};

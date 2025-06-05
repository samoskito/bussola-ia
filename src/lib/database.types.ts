export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Tipos para as tabelas
export type User = {
  id: string; // Mudado para string (UUID)
  nome: string;
  email: string;
  senha?: string; // Nova coluna adicionada
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
  created_at?: string;
  updated_at?: string;
};

export type Chat = {
  id: string;
  user_id: string; // Mudado para string (UUID)
  title: string;
  created_at?: string;
  updated_at?: string;
};

export type Script = {
  id: number;
  user_id: string; // Mudado para string (UUID)
  input: string;
  output?: string | null;
  chatid: string;
  created_at?: string;
  updated_at?: string;
};

// Definição das tabelas do banco de dados
export interface Database {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: Omit<User, 'id' | 'created_at' | 'updated_at'> & { id?: number };
        Update: Partial<Omit<User, 'id'>> & { id?: number };
      };
      chats: {
        Row: Chat;
        Insert: Omit<Chat, 'id' | 'created_at' | 'updated_at'> & { id?: string };
        Update: Partial<Omit<Chat, 'id'>> & { id?: string };
      };
      scripts: {
        Row: Script;
        Insert: Omit<Script, 'id' | 'created_at' | 'updated_at'> & { id?: number };
        Update: Partial<Omit<Script, 'id'>> & { id?: number };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';

// Tipos para os buckets de armazenamento
export type StorageBucket = 'avatars' | 'app-resources';

/**
 * Faz upload de um arquivo para o bucket especificado
 * @param bucket Nome do bucket ('avatars' ou 'app-resources')
 * @param file Arquivo a ser enviado
 * @param userId ID do usuário (necessário para avatars)
 * @param path Caminho opcional dentro do bucket (para app-resources)
 * @returns URL pública do arquivo ou null em caso de erro
 */
export const uploadFile = async (
  bucket: StorageBucket,
  file: File,
  userId?: string,
  path?: string
): Promise<string | null> => {
  try {
    // Validar parâmetros
    if (bucket === 'avatars' && !userId) {
      throw new Error('ID do usuário é obrigatório para upload de avatares');
    }

    // Gerar nome de arquivo único
    const fileExtension = file.name.split('.').pop();
    const fileName = `${uuidv4()}.${fileExtension}`;
    
    // Definir caminho completo do arquivo
    let filePath: string;
    if (bucket === 'avatars') {
      filePath = `${userId}/${fileName}`;
    } else {
      filePath = path ? `${path}/${fileName}` : fileName;
    }

    // Fazer upload do arquivo
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) throw error;

    // Obter URL pública do arquivo
    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error(`Erro ao fazer upload para ${bucket}:`, error);
    return null;
  }
};

/**
 * Atualiza o avatar do usuário
 * @param userId ID do usuário
 * @param file Arquivo de imagem do avatar
 * @returns URL pública do avatar ou null em caso de erro
 */
export const updateUserAvatar = async (
  userId: string,
  file: File
): Promise<string | null> => {
  try {
    // Remover avatares antigos do usuário
    await removeUserAvatars(userId);
    
    // Fazer upload do novo avatar
    const avatarUrl = await uploadFile('avatars', file, userId);
    
    if (!avatarUrl) throw new Error('Falha ao obter URL do avatar');
    
    // Atualizar o campo avatar na tabela users
    const { error } = await supabase
      .from('users')
      .update({ avatar: avatarUrl })
      .eq('id', userId);
    
    if (error) throw error;
    
    return avatarUrl;
  } catch (error) {
    console.error('Erro ao atualizar avatar do usuário:', error);
    return null;
  }
};

/**
 * Remove todos os avatares de um usuário
 * @param userId ID do usuário
 * @returns true se bem-sucedido, false em caso de erro
 */
export const removeUserAvatars = async (userId: string): Promise<boolean> => {
  try {
    // Listar todos os arquivos na pasta do usuário
    const { data, error } = await supabase.storage
      .from('avatars')
      .list(userId);
    
    if (error) throw error;
    
    // Se não houver arquivos, retornar sucesso
    if (!data || data.length === 0) return true;
    
    // Criar array com os caminhos completos dos arquivos
    const filesToRemove = data.map(file => `${userId}/${file.name}`);
    
    // Remover os arquivos
    const { error: removeError } = await supabase.storage
      .from('avatars')
      .remove(filesToRemove);
    
    if (removeError) throw removeError;
    
    return true;
  } catch (error) {
    console.error('Erro ao remover avatares do usuário:', error);
    return false;
  }
};

/**
 * Faz upload de um recurso do aplicativo (logo, imagem de fundo, etc.)
 * @param file Arquivo a ser enviado
 * @param path Caminho opcional dentro do bucket (ex: 'logos', 'backgrounds')
 * @returns URL pública do recurso ou null em caso de erro
 */
export const uploadAppResource = async (
  file: File,
  path?: string
): Promise<string | null> => {
  return uploadFile('app-resources', file, undefined, path);
};

/**
 * Lista todos os recursos em um caminho específico
 * @param bucket Nome do bucket ('avatars' ou 'app-resources')
 * @param path Caminho dentro do bucket
 * @returns Array de objetos de arquivo ou null em caso de erro
 */
export const listFiles = async (
  bucket: StorageBucket,
  path: string = ''
) => {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(path);
    
    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error(`Erro ao listar arquivos em ${bucket}/${path}:`, error);
    return null;
  }
};

/**
 * Remove um arquivo específico
 * @param bucket Nome do bucket ('avatars' ou 'app-resources')
 * @param path Caminho completo do arquivo
 * @returns true se bem-sucedido, false em caso de erro
 */
export const removeFile = async (
  bucket: StorageBucket,
  path: string
): Promise<boolean> => {
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([path]);
    
    if (error) throw error;
    
    return true;
  } catch (error) {
    console.error(`Erro ao remover arquivo ${bucket}/${path}:`, error);
    return false;
  }
};

/**
 * Obtém a URL pública de um arquivo
 * @param bucket Nome do bucket ('avatars' ou 'app-resources')
 * @param path Caminho completo do arquivo
 * @returns URL pública do arquivo
 */
export const getPublicUrl = (
  bucket: StorageBucket,
  path: string
): string => {
  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);
  
  return data.publicUrl;
};

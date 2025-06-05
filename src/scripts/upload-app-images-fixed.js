// Script para fazer upload das imagens do aplicativo para os buckets corretos do Supabase Storage
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuração do Supabase
// Usar os valores das credenciais do Supabase para o projeto Bússola Executiva
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://iszynegxctqdfrmizila.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzenluZWd4Y3RxZGZybWl6aWxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY5MjIwODAsImV4cCI6MjA2MjQ5ODA4MH0.zkxYGj0jiGcoK_04FwHYkP_gsMnjHY8GioGEJNapBEI';

console.log('Usando URL do Supabase:', supabaseUrl);
// Não exibir a chave completa por segurança
console.log('Usando chave do Supabase (primeiros 10 caracteres):', supabaseKey.substring(0, 10) + '...');

// Criar cliente do Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

// Função para fazer upload de um arquivo para o bucket do Supabase
async function uploadFile(bucket, filePath, targetPath, contentType) {
  try {
    // Ler o arquivo
    const fileBuffer = fs.readFileSync(filePath);
    
    console.log(`Fazendo upload para ${bucket}/${targetPath}...`);
    
    // Fazer upload do arquivo
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(targetPath, fileBuffer, {
        cacheControl: '3600',
        upsert: true,
        contentType
      });

    if (error) {
      console.error(`Erro ao fazer upload para ${bucket}/${targetPath}:`, error);
      return null;
    }

    // Obter URL pública do arquivo
    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(targetPath);

    console.log(`Upload concluído: ${bucket}/${targetPath}`);
    return publicUrlData.publicUrl;
  } catch (error) {
    console.error(`Erro ao processar ${filePath}:`, error);
    return null;
  }
}

// Função principal
async function main() {
  // Caminhos para as imagens
  const logoPath = path.resolve(__dirname, '../../public/temp/logo.png');
  const presenterPath = path.resolve(__dirname, '../../public/temp/presenter.jpg');
  
  // Verificar se os arquivos existem
  if (!fs.existsSync(logoPath)) {
    console.error(`Arquivo não encontrado: ${logoPath}`);
    process.exit(1);
  }
  
  if (!fs.existsSync(presenterPath)) {
    console.error(`Arquivo não encontrado: ${presenterPath}`);
    process.exit(1);
  }
  
  console.log('Iniciando upload das imagens...');
  
  // Fazer upload do logo para o bucket 'app-resources'
  const logoUrl = await uploadFile('app-resources', logoPath, 'logo.png', 'image/png');
  if (logoUrl) {
    console.log(`Logo URL: ${logoUrl}`);
  }
  
  // Fazer upload da imagem da apresentadora para o bucket 'app-resources'
  const presenterUrl = await uploadFile('app-resources', presenterPath, 'presenter.jpg', 'image/jpeg');
  if (presenterUrl) {
    console.log(`Presenter URL: ${presenterUrl}`);
  }
  
  console.log('Processo concluído!');
}

// Executar a função principal
main().catch(console.error);

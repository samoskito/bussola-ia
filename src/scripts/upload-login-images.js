const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuração do Supabase
const supabaseUrl = 'https://iszynegxctqdfrmizila.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzenluZWd4Y3RxZGZybWl6aWxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY5MjIwODAsImV4cCI6MjA2MjQ5ODA4MH0.zkxYGj0jiGcoK_04FwHYkP_gsMnjHY8GioGEJNapBEI';

console.log('Usando URL do Supabase:', supabaseUrl);
console.log('Usando chave do Supabase (primeiros 10 caracteres):', supabaseKey.substring(0, 10) + '...');

// Criar cliente do Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

// Caminhos das imagens locais (temporários)
const logoPath = path.join(__dirname, '..', '..', 'public', 'temp', 'logo.png');
const presenterPath = path.join(__dirname, '..', '..', 'public', 'temp', 'presenter.jpg');

// Função para fazer upload de um arquivo para o Supabase Storage
async function uploadFile(bucketName, filePath, fileName, contentType) {
  try {
    console.log(`Fazendo upload para ${bucketName}/${fileName}...`);
    
    // Verificar se o arquivo existe
    if (!fs.existsSync(filePath)) {
      console.error(`Erro: O arquivo ${filePath} não existe.`);
      return null;
    }
    
    // Ler o arquivo
    const fileBuffer = fs.readFileSync(filePath);
    
    // Fazer upload para o Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(fileName, fileBuffer, {
        contentType,
        upsert: true
      });
    
    if (error) {
      console.error(`Erro ao fazer upload para ${bucketName}/${fileName}:`, error);
      return null;
    }
    
    // Obter a URL pública do arquivo
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);
    
    console.log(`Upload concluído para ${bucketName}/${fileName}`);
    return urlData.publicUrl;
  } catch (err) {
    console.error(`Erro inesperado ao fazer upload de ${fileName}:`, err);
    return null;
  }
}

// Função principal
async function main() {
  console.log('Iniciando upload das imagens de login...');
  
  // Fazer upload do logo para o bucket 'app-resources'
  const logoUrl = await uploadFile('app-resources', logoPath, 'bussola-logo.png', 'image/png');
  if (logoUrl) {
    console.log(`Logo URL: ${logoUrl}`);
  }
  
  // Fazer upload da imagem da apresentadora para o bucket 'app-resources'
  const presenterUrl = await uploadFile('app-resources', presenterPath, 'apresentadora.jpg', 'image/jpeg');
  if (presenterUrl) {
    console.log(`Presenter URL: ${presenterUrl}`);
  }
  
  console.log('Processo concluído!');
}

// Executar a função principal
main().catch(err => {
  console.error('Erro na execução do script:', err);
  process.exit(1);
});

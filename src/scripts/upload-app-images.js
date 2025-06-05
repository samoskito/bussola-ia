// Script para fazer upload das imagens do aplicativo para o Supabase Storage
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Verificar se as variáveis de ambiente estão definidas
if (!supabaseUrl || !supabaseKey) {
  console.error('Erro: Variáveis de ambiente NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY devem estar definidas');
  process.exit(1);
}

// Criar cliente do Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

// Função para fazer upload de um arquivo para o bucket do Supabase
async function uploadFile(filePath, fileName, contentType) {
  try {
    // Ler o arquivo
    const fileBuffer = fs.readFileSync(filePath);
    
    console.log(`Fazendo upload de ${fileName}...`);
    
    // Fazer upload do arquivo
    const { data, error } = await supabase.storage
      .from('app-resources')
      .upload(fileName, fileBuffer, {
        cacheControl: '3600',
        upsert: true,
        contentType
      });

    if (error) {
      console.error(`Erro ao fazer upload de ${fileName}:`, error);
      return null;
    }

    // Obter URL pública do arquivo
    const { data: publicUrlData } = supabase.storage
      .from('app-resources')
      .getPublicUrl(fileName);

    console.log(`Upload concluído: ${fileName}`);
    return publicUrlData.publicUrl;
  } catch (error) {
    console.error(`Erro ao processar ${fileName}:`, error);
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
  
  // Fazer upload do logo
  const logoUrl = await uploadFile(logoPath, 'logo.png', 'image/png');
  if (logoUrl) {
    console.log(`Logo URL: ${logoUrl}`);
  }
  
  // Fazer upload da imagem da apresentadora
  const presenterUrl = await uploadFile(presenterPath, 'presenter.jpg', 'image/jpeg');
  if (presenterUrl) {
    console.log(`Presenter URL: ${presenterUrl}`);
  }
  
  console.log('Processo concluído!');
}

// Executar a função principal
main().catch(console.error);

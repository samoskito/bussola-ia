import fs from 'fs';
import path from 'path';
import { supabase } from '../lib/supabase';

// Função para fazer upload de um arquivo para o bucket do Supabase
async function uploadFile(bucket: string, filePath: string, fileName: string): Promise<string | null> {
  try {
    // Ler o arquivo
    const fileBuffer = fs.readFileSync(filePath);
    
    // Fazer upload do arquivo
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, fileBuffer, {
        cacheControl: '3600',
        upsert: true,
        contentType: filePath.endsWith('.png') ? 'image/png' : 'image/jpeg'
      });

    if (error) {
      console.error(`Erro ao fazer upload de ${filePath}:`, error);
      return null;
    }

    // Obter URL pública do arquivo
    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);

    console.log(`Upload concluído: ${fileName}`);
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
  
  // Nomes dos arquivos no bucket
  const logoFileName = 'logo.png';
  const presenterFileName = 'presenter.jpg';
  
  // Fazer upload das imagens
  console.log('Iniciando upload das imagens...');
  
  const logoUrl = await uploadFile('app-resources', logoPath, logoFileName);
  if (logoUrl) {
    console.log(`Logo URL: ${logoUrl}`);
  }
  
  const presenterUrl = await uploadFile('app-resources', presenterPath, presenterFileName);
  if (presenterUrl) {
    console.log(`Presenter URL: ${presenterUrl}`);
  }
  
  console.log('Processo concluído!');
}

// Executar a função principal
main().catch(console.error);

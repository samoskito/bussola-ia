/**
 * Guia para configuração manual do Supabase para o projeto Bússola Executiva
 * Este script fornece instruções detalhadas para criar as tabelas e buckets necessários
 */

const fs = require('fs');
const path = require('path');

// Buckets a serem criados
const buckets = [
  {
    name: 'profile_images',
    public: true,
    fileTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    maxFileSize: 2 * 1024 * 1024, // 2MB
    description: 'Armazena imagens de perfil dos usuários'
  },
  {
    name: 'chat_files',
    public: true,
    fileTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'audio/mpeg', 'audio/wav', 'audio/ogg'],
    maxFileSize: 10 * 1024 * 1024, // 10MB
    description: 'Armazena arquivos enviados pelos usuários no chat (imagens, PDFs, áudios)'
  },
  {
    name: 'images',
    public: true,
    fileTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
    maxFileSize: 5 * 1024 * 1024, // 5MB
    description: 'Armazena imagens do site, como a imagem da apresentadora na página de login'
  },
  {
    name: 'assets',
    public: true,
    fileTypes: ['image/svg+xml', 'image/png', 'image/jpeg', 'text/css', 'application/javascript'],
    maxFileSize: 5 * 1024 * 1024, // 5MB
    description: 'Armazena assets do site, como logos, ícones e outros recursos'
  },
  {
    name: 'documents',
    public: false, // Privado, acesso apenas para usuários autenticados
    fileTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    maxFileSize: 20 * 1024 * 1024, // 20MB
    description: 'Armazena documentos gerados pelo sistema, como scripts finalizados'
  }
];

// Estrutura de pastas para cada bucket
const folderStructure = {
  profile_images: [
    '/' // Pasta raiz para imagens de perfil
  ],
  chat_files: [
    '/images', // Para imagens enviadas no chat
    '/pdfs',   // Para PDFs enviados no chat
    '/audios'  // Para áudios enviados no chat
  ],
  images: [
    '/auth',     // Para imagens da página de autenticação
    '/homepage', // Para imagens da página inicial
    '/banners'   // Para banners do site
  ],
  assets: [
    '/logos',  // Para logos do site
    '/icons',  // Para ícones do site
    '/styles'  // Para arquivos de estilo
  ],
  documents: [
    '/scripts', // Para scripts gerados
    '/exports'  // Para exportações
  ]
};

// Função para ler o conteúdo de um arquivo
function readFileContent(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(`Erro ao ler o arquivo ${filePath}: ${error.message}`);
    return null;
  }
}

// Função principal
function main() {
  console.log('=== Guia de Configuração Manual do Supabase para o Projeto Bússola Executiva ===\n');
  
  // 1. Instruções para criar tabelas
  console.log('=== 1. Criação de Tabelas ===');
  console.log('1. Acesse o painel do Supabase: https://app.supabase.com/');
  console.log('2. Selecione seu projeto');
  console.log('3. Vá para a seção "SQL Editor"');
  console.log('4. Clique em "New Query"');
  console.log('5. Cole o conteúdo do arquivo setup-database.sql');
  console.log('6. Clique em "Run" para executar o script\n');
  
  // Mostrar o conteúdo do arquivo SQL
  const databaseScriptPath = path.join(__dirname, 'setup-database.sql');
  const databaseScript = readFileContent(databaseScriptPath);
  
  if (databaseScript) {
    console.log('=== Conteúdo do arquivo setup-database.sql ===');
    console.log(databaseScript);
    console.log('===================================================\n');
  }
  
  // 2. Instruções para criar buckets
  console.log('=== 2. Criação de Buckets ===');
  console.log('1. No painel do Supabase, vá para "Storage"');
  console.log('2. Para cada bucket, siga estas etapas:');
  console.log('   a. Clique em "New Bucket"');
  console.log('   b. Digite o nome do bucket');
  console.log('   c. Marque "Public bucket" se o bucket for público');
  console.log('   d. Clique em "Create bucket"\n');
  
  // Listar os buckets a serem criados
  console.log('=== Buckets a serem criados ===');
  buckets.forEach((bucket, index) => {
    console.log(`${index + 1}. ${bucket.name}`);
    console.log(`   Descrição: ${bucket.description}`);
    console.log(`   Público: ${bucket.public ? 'Sim' : 'Não'}`);
    console.log(`   Tipos de arquivo: ${bucket.fileTypes.join(', ')}`);
    console.log(`   Tamanho máximo: ${bucket.maxFileSize / (1024 * 1024)}MB\n`);
  });
  
  // 3. Instruções para criar estrutura de pastas
  console.log('=== 3. Criação de Estrutura de Pastas ===');
  console.log('Para cada bucket, crie as seguintes pastas:');
  
  Object.keys(folderStructure).forEach(bucket => {
    console.log(`\nBucket: ${bucket}`);
    folderStructure[bucket].forEach(folder => {
      if (folder === '/') {
        console.log('   (Sem subpastas específicas)');
      } else {
        console.log(`   ${folder}`);
      }
    });
  });
  console.log('\nPara criar uma pasta:');
  console.log('1. Acesse o bucket');
  console.log('2. Clique em "Create folder"');
  console.log('3. Digite o nome da pasta (sem a barra inicial)');
  console.log('4. Clique em "Create"\n');
  
  // 4. Instruções para configurar políticas de segurança
  console.log('=== 4. Configuração de Políticas de Segurança ===');
  console.log('1. No painel do Supabase, vá para "SQL Editor"');
  console.log('2. Clique em "New Query"');
  console.log('3. Cole o conteúdo do arquivo create-buckets.sql');
  console.log('4. Clique em "Run" para executar o script\n');
  
  // Mostrar o conteúdo do arquivo SQL de políticas
  const bucketsScriptPath = path.join(__dirname, 'create-buckets.sql');
  const bucketsScript = readFileContent(bucketsScriptPath);
  
  if (bucketsScript) {
    console.log('=== Conteúdo do arquivo create-buckets.sql ===');
    console.log(bucketsScript);
    console.log('===================================================\n');
  }
  
  console.log('=== Conclusão ===');
  console.log('Após seguir todas as etapas acima, a configuração do Supabase estará concluída.');
  console.log('Verifique se todas as tabelas e buckets foram criados corretamente.');
}

// Executar o script
main();

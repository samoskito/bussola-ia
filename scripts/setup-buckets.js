/**
 * Script para configurar buckets no Supabase para o projeto Bússola Executiva
 * 
 * Este script contém as instruções para criar os buckets necessários no Supabase
 * para armazenar imagens de perfil, arquivos enviados no chat (PDFs, áudios, imagens)
 * e outros assets do site.
 */

// Configuração dos buckets
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

/**
 * Instruções para criar buckets no Supabase
 * 
 * 1. Acesse o painel de controle do Supabase: https://app.supabase.com/
 * 2. Navegue até Storage > Buckets
 * 3. Para cada bucket na lista acima:
 *    a. Clique em "New Bucket"
 *    b. Insira o nome do bucket
 *    c. Marque "Public bucket" se o bucket for público
 *    d. Clique em "Create bucket"
 *    e. Após criar o bucket, clique nele para acessar suas configurações
 *    f. Em "Policies", crie políticas de acesso adequadas:
 *       - Para buckets públicos: Permitir SELECT para todos
 *       - Para buckets privados: Permitir SELECT apenas para usuários autenticados
 *       - Para todos os buckets: Permitir INSERT, UPDATE, DELETE apenas para o próprio usuário
 */

// Estrutura de pastas recomendada para cada bucket
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

/**
 * Instruções para criar a estrutura de pastas
 * 
 * 1. Após criar cada bucket, navegue até ele
 * 2. Para cada pasta na estrutura acima:
 *    a. Clique em "Create folder"
 *    b. Insira o nome da pasta (sem a barra inicial)
 *    c. Clique em "Create"
 */

// Arquivos iniciais a serem enviados
const initialFiles = [
  {
    bucket: 'images',
    path: 'auth/presenter.jpg',
    description: 'Imagem da apresentadora na página de login'
  },
  {
    bucket: 'assets',
    path: 'logos/logo.svg',
    description: 'Logo da Bússola Executiva'
  }
];

/**
 * Instruções para enviar arquivos iniciais
 * 
 * 1. Para cada arquivo na lista acima:
 *    a. Navegue até o bucket especificado
 *    b. Navegue até a pasta especificada
 *    c. Clique em "Upload"
 *    d. Selecione o arquivo do seu computador
 *    e. Clique em "Upload"
 */

// Políticas de segurança recomendadas para cada bucket
const securityPolicies = `
-- Políticas para o bucket profile_images
-- Permitir SELECT para todos (bucket público)
CREATE POLICY "Permitir acesso público para imagens de perfil" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'profile_images');

-- Permitir INSERT apenas para o próprio usuário
CREATE POLICY "Permitir upload de imagens de perfil apenas para o próprio usuário" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'profile_images' AND
    auth.uid() = (storage.foldername(name))[1]::uuid
  );

-- Permitir UPDATE e DELETE apenas para o próprio usuário
CREATE POLICY "Permitir atualização e exclusão de imagens de perfil apenas para o próprio usuário" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'profile_images' AND
    auth.uid() = (storage.foldername(name))[1]::uuid
  );

-- Políticas para o bucket chat_files
-- Permitir SELECT para todos (bucket público)
CREATE POLICY "Permitir acesso público para arquivos de chat" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'chat_files');

-- Permitir INSERT apenas para usuários autenticados
CREATE POLICY "Permitir upload de arquivos de chat apenas para usuários autenticados" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'chat_files' AND
    auth.role() = 'authenticated'
  );

-- Políticas para o bucket documents (privado)
-- Permitir SELECT apenas para o próprio usuário
CREATE POLICY "Permitir acesso a documentos apenas para o próprio usuário" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'documents' AND
    auth.uid() = (storage.foldername(name))[1]::uuid
  );

-- Permitir INSERT, UPDATE, DELETE apenas para o próprio usuário
CREATE POLICY "Permitir gerenciamento de documentos apenas para o próprio usuário" ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'documents' AND
    auth.uid() = (storage.foldername(name))[1]::uuid
  );
`;

// Exibir informações
console.log('=== Configuração de Buckets para o Projeto Bússola Executiva ===');
console.log('\n=== Buckets a serem criados ===');
buckets.forEach((bucket, index) => {
  console.log(`${index + 1}. ${bucket.name}`);
  console.log(`   Descrição: ${bucket.description}`);
  console.log(`   Público: ${bucket.public ? 'Sim' : 'Não'}`);
  console.log(`   Tipos de arquivo: ${bucket.fileTypes.join(', ')}`);
  console.log(`   Tamanho máximo: ${bucket.maxFileSize / (1024 * 1024)}MB`);
  console.log('');
});

console.log('\n=== Estrutura de pastas recomendada ===');
Object.keys(folderStructure).forEach(bucket => {
  console.log(`Bucket: ${bucket}`);
  folderStructure[bucket].forEach(folder => {
    console.log(`   ${folder}`);
  });
  console.log('');
});

console.log('\n=== Arquivos iniciais a serem enviados ===');
initialFiles.forEach((file, index) => {
  console.log(`${index + 1}. ${file.path}`);
  console.log(`   Bucket: ${file.bucket}`);
  console.log(`   Descrição: ${file.description}`);
  console.log('');
});

console.log('\n=== Políticas de segurança recomendadas ===');
console.log(securityPolicies);

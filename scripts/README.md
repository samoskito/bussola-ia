# Guia de Configuração do Supabase para Bússola Executiva

Este guia contém instruções passo a passo para configurar o banco de dados e os buckets de armazenamento no Supabase para o projeto Bússola Executiva.

## 1. Configuração do Banco de Dados

### 1.1. Executar o Script SQL

1. Acesse o [Painel de Controle do Supabase](https://app.supabase.com/)
2. Selecione seu projeto
3. Vá para a seção **SQL Editor**
4. Crie um novo script SQL
5. Cole o conteúdo do arquivo `setup-database.sql`
6. Execute o script

Este script irá:
- Criar todas as tabelas necessárias (users, chats, mensagens, outputs, arquivos, etc.)
- Configurar triggers para atualização automática de timestamps
- Configurar políticas de segurança (Row Level Security)

## 2. Configuração dos Buckets de Armazenamento

### 2.1. Criar os Buckets

1. No Painel de Controle do Supabase, vá para **Storage**
2. Crie os seguintes buckets:

| Nome | Público | Descrição |
|------|---------|-----------|
| `profile_images` | Sim | Armazena imagens de perfil dos usuários |
| `chat_files` | Sim | Armazena arquivos enviados pelos usuários no chat |
| `images` | Sim | Armazena imagens do site |
| `assets` | Sim | Armazena assets do site (logos, ícones) |
| `documents` | Não | Armazena documentos gerados pelo sistema |

### 2.2. Criar a Estrutura de Pastas

Para cada bucket, crie as seguintes pastas:

#### profile_images
- Não requer subpastas específicas

#### chat_files
- `/images` (Para imagens enviadas no chat)
- `/pdfs` (Para PDFs enviados no chat)
- `/audios` (Para áudios enviados no chat)

#### images
- `/auth` (Para imagens da página de autenticação)
- `/homepage` (Para imagens da página inicial)
- `/banners` (Para banners do site)

#### assets
- `/logos` (Para logos do site)
- `/icons` (Para ícones do site)
- `/styles` (Para arquivos de estilo)

#### documents
- `/scripts` (Para scripts gerados)
- `/exports` (Para exportações)

### 2.3. Configurar Políticas de Segurança

1. No Painel de Controle do Supabase, vá para **SQL Editor**
2. Crie um novo script SQL
3. Cole o conteúdo do arquivo `create-buckets.sql`
4. Execute o script

Este script irá configurar as políticas de segurança para cada bucket, garantindo que:
- Buckets públicos possam ser acessados por todos
- Apenas usuários autenticados possam fazer upload de arquivos
- Apenas o proprietário de um arquivo possa excluí-lo
- Apenas administradores possam gerenciar imagens e assets do site

## 3. Arquivos Iniciais

### 3.1. Fazer Upload de Arquivos Iniciais

Faça upload dos seguintes arquivos para iniciar o site:

1. **Logo da Bússola Executiva**
   - Bucket: `assets`
   - Pasta: `/logos`
   - Nome sugerido: `logo.svg` ou `logo.png`

2. **Imagem da Apresentadora (página de login)**
   - Bucket: `images`
   - Pasta: `/auth`
   - Nome sugerido: `presenter.jpg` ou `presenter.png`

## 4. Verificação

Após concluir todas as etapas, verifique se:

1. Todas as tabelas foram criadas corretamente
2. Todos os buckets estão disponíveis
3. As políticas de segurança estão funcionando
4. Os arquivos iniciais estão acessíveis

## Solução de Problemas

Se encontrar algum erro durante a execução dos scripts:

1. Verifique os logs de erro no Supabase
2. Certifique-se de que não há conflitos de nomes
3. Verifique se todas as extensões necessárias estão habilitadas
4. Se necessário, execute os scripts em partes menores para identificar o problema

## Próximos Passos

Após configurar o banco de dados e os buckets:

1. Configure as variáveis de ambiente no seu projeto
2. Teste o upload e download de arquivos
3. Verifique se a autenticação está funcionando corretamente
4. Configure o webhook do n8n para processar as entradas dos usuários

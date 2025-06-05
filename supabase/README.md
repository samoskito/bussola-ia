# Migrações do Banco de Dados - Bússola Executiva

Este diretório contém os scripts SQL para criar e configurar o banco de dados do sistema Bússola Executiva no Supabase.

## Estrutura do Banco de Dados

### Tabela `users`
- **id**: ID único do usuário (autoincrement)
- **nome**: Nome completo do usuário
- **email**: Email do usuário (único)
- **telefone**: Número de telefone do usuário
- **avatar**: URL da imagem de perfil do usuário
- **rua**: Rua do endereço do usuário
- **numero**: Número do endereço do usuário
- **bairro**: Bairro do endereço do usuário
- **cep**: CEP do endereço do usuário
- **cidade**: Cidade do endereço do usuário
- **estado**: Estado do endereço do usuário
- **pais**: País do endereço do usuário
- **nivel**: Nível de acesso (admin ou user)
- **created_at**: Data de criação do registro
- **updated_at**: Data da última atualização do registro

### Tabela `chats`
- **id**: ID único do chat (UUID)
- **user_id**: ID do usuário dono do chat (referência à tabela users)
- **title**: Título da conversa
- **created_at**: Data de criação do chat
- **updated_at**: Data da última atualização do chat

### Tabela `scripts`
- **id**: ID único do script (autoincrement)
- **user_id**: ID do usuário que criou o script (referência à tabela users)
- **input**: Pergunta ou prompt enviado pelo usuário
- **output**: Script gerado pela IA em resposta ao input
- **chatid**: ID único da conversa/chat onde o script foi gerado
- **created_at**: Data de criação do registro
- **updated_at**: Data da última atualização do registro

## Como aplicar as migrações

### Opção 1: Usando o Painel de Administração do Supabase

1. Acesse o [Painel de Administração do Supabase](https://app.supabase.io)
2. Selecione seu projeto
3. Vá para a seção "SQL Editor"
4. Copie e cole o conteúdo de cada arquivo SQL na ordem numérica (01, 02, 03, 04)
5. Execute cada script clicando em "Run"

### Opção 2: Usando a CLI do Supabase

1. Instale a CLI do Supabase: `npm install -g supabase`
2. Faça login: `supabase login`
3. Vincule seu projeto: `supabase link --project-ref <ref-do-seu-projeto>`
4. Execute as migrações: `supabase db push`

## Dados Iniciais

O script `04_insert_initial_data.sql` cria:

1. Um usuário administrador:
   - Email: admin@bussola-executiva.com
   - Nível: admin

2. Um usuário comum para testes:
   - Email: usuario@bussola-executiva.com
   - Nível: user

3. Chats iniciais para ambos os usuários

4. Exemplos de scripts gerados para cada usuário

## Políticas de Segurança (RLS)

As tabelas possuem políticas de segurança que garantem:

1. Usuários comuns só podem ver e editar seus próprios dados
2. Administradores podem ver todos os dados
3. Todas as operações são protegidas por autenticação

## Notas Importantes

- Certifique-se de configurar a autenticação do Supabase antes de usar o sistema
- Você precisará criar senhas para os usuários através do painel do Supabase ou API de autenticação
- As políticas de segurança dependem do sistema de autenticação do Supabase estar configurado corretamente

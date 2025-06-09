# Bússola Executiva - Gerador de Scripts para Reuniões

![Bússola Executiva](public/images/logo.svg)

Bússola Executiva é uma aplicação SaaS que utiliza inteligência artificial para gerar scripts profissionais para reuniões, ajudando profissionais a conduzirem reuniões mais eficientes e produtivas.

## Tecnologias Utilizadas

- **Frontend**: Next.js 15 (App Router)
- **Linguagem**: TypeScript
- **Estilização**: Tailwind CSS
- **Backend**: Supabase (Autenticação e Banco de Dados)
- **Tema**: Dark com acentos em laranja

## Funcionalidades Principais

- **Geração de Scripts**: Crie scripts de reunião personalizados em minutos
- **Autenticação de Usuários**: Sistema completo de login e registro
- **Salvamento de Scripts**: Armazene seus scripts para uso futuro
- **Organização em Pastas**: Mantenha seus scripts organizados por projetos
- **Interface de Chat**: Interaja com agentes de IA para melhorar seus scripts

## Configuração do Projeto

### Pré-requisitos

- Node.js 18.17 ou superior
- Conta no Supabase (para autenticação e banco de dados)

### Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz do projeto com as seguintes variáveis:

```
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=sua_url_do_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anonima_do_supabase
JWT_SECRET=sua_chave_secreta_jwt
```

### Instalação

1. Clone o repositório
   ```bash
   git clone https://github.com/samoskito/bussola-ia.git
   cd bussola-ia
   ```

2. Instale as dependências
   ```bash
   npm install
   # ou
   yarn install
   ```

3. Execute o servidor de desenvolvimento
   ```bash
   npm run dev
   # ou
   yarn dev
   ```

4. Acesse a aplicação em `http://localhost:3000`

## Estrutura do Projeto

```
bussola-ia/
├── public/                # Arquivos estáticos
├── src/                   # Código fonte
│   ├── app/               # Páginas da aplicação (App Router)
│   │   ├── api/           # Rotas de API
│   │   ├── auth/          # Páginas de autenticação
│   │   ├── dashboard/     # Páginas do dashboard
│   │       ├── chat/       # Páginas de chat
│   ├── components/        # Componentes React
│   │   ├── auth/          # Componentes de autenticação
│   │   ├── chat/          # Componentes de chat
│   │   ├── layout/        # Componentes de layout
│   │   ├── ui/            # Componentes de interface
│   ├── contexts/          # Contextos React
│   ├── lib/               # Bibliotecas e utilidades
│   ├── scripts/           # Scripts de utilidade
│   ├── types/             # Definições de tipos TypeScript
├── .env.example         # Exemplo de variáveis de ambiente
├── .env.local           # Variáveis de ambiente locais
├── next.config.js        # Configuração do Next.js
├── tailwind.config.js    # Configuração do Tailwind CSS
├── tsconfig.json         # Configuração do TypeScript
├── vercel.json           # Configuração da Vercel
```

## Banco de Dados

O projeto utiliza o Supabase como backend. As principais tabelas são:

- **users**: Informações dos usuários
- **scripts**: Scripts salvos pelos usuários
- **projects**: Projetos criados pelos usuários
- **chats**: Histórico de chats com os agentes

## Deploy na Vercel

Este projeto está otimizado para deploy na plataforma Vercel. Siga os passos abaixo para fazer o deploy:

### Preparação

1. Crie uma conta na [Vercel](https://vercel.com/) se ainda não tiver uma

2. Instale a CLI da Vercel (opcional)
   ```bash
   npm install -g vercel
   ```

### Deploy via Interface Web

1. Faça login na sua conta Vercel

2. Clique em "Add New..." > "Project"

3. Importe o repositório do GitHub, GitLab ou Bitbucket onde o código está hospedado

4. Configure as variáveis de ambiente:
   - `NEXT_PUBLIC_APP_URL`: URL da sua aplicação (será gerado pela Vercel)
   - `NEXT_PUBLIC_SUPABASE_URL`: URL do seu projeto Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Chave anônima do Supabase
   - `JWT_SECRET`: Chave secreta para geração de tokens JWT

5. Clique em "Deploy"

### Deploy via CLI

1. Faça login na Vercel via CLI
   ```bash
   vercel login
   ```

2. No diretório do projeto, execute:
   ```bash
   vercel
   ```

3. Siga as instruções para configurar o projeto

4. Para fazer deploy em produção:
   ```bash
   vercel --prod
   ```

### Configurações Adicionais

1. **Domínio Personalizado**: Na dashboard da Vercel, vá para seu projeto > Settings > Domains para configurar um domínio personalizado.

2. **Integração Contínua**: A Vercel automaticamente fará deploy de novas versões quando houver commits no branch principal do repositório.

3. **Previews**: Cada pull request criará automaticamente um ambiente de preview para testes.

## Observações Importantes para Deploy

1. **Variáveis de Ambiente**: Certifique-se de configurar todas as variáveis de ambiente necessárias na Vercel antes de fazer o deploy.

2. **Supabase**: Verifique se as configurações de CORS no seu projeto Supabase permitem requisições do domínio da sua aplicação na Vercel.

3. **Senhas de Usuários**: Lembre-se que as senhas dos usuários devem estar criptografadas com bcrypt no banco de dados para o login funcionar corretamente.

4. **Redefinição de Senha**: O fluxo de redefinição de senha requer que o URL de redirecionamento no Supabase esteja configurado corretamente para apontar para sua aplicação em produção.

## Licença

Este projeto está licenciado sob a licença MIT - veja o arquivo LICENSE para mais detalhes.

## Contato

Para mais informações, entre em contato através do email: contato@bussolaexecutiva.com

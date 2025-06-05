# Bússola Executiva - Gerador de Scripts para Reuniões

![Bússola Executiva](public/images/logo.svg)

Bússola Executiva é uma aplicação SaaS que utiliza inteligência artificial para gerar scripts profissionais para reuniões, ajudando profissionais a conduzirem reuniões mais eficientes e produtivas.

## Tecnologias Utilizadas

- **Frontend**: Next.js 13 (App Router)
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
- **Perfil de Usuário**: Gerencie suas informações pessoais

## Configuração do Projeto

### Pré-requisitos

- Node.js 16.8 ou superior
- Conta no Supabase (para autenticação e banco de dados)

### Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz do projeto com as seguintes variáveis:

```
NEXT_PUBLIC_SUPABASE_URL=sua_url_do_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anonima_do_supabase
```

### Instalação

1. Clone o repositório
   ```bash
   git clone [URL_DO_REPOSITORIO]
   cd meeting-script-saas
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
meeting-script-saas/
├── public/             # Arquivos estáticos
├── src/                # Código fonte
│   ├── app/            # Páginas da aplicação (App Router)
│   │   ├── auth/       # Páginas de autenticação
│   │   ├── dashboard/  # Páginas do dashboard
│   ├── components/     # Componentes React
│   │   ├── chat/       # Componentes de chat
│   │   ├── layout/     # Componentes de layout
│   │   ├── scripts/    # Componentes de scripts
│   ├── lib/            # Bibliotecas e utilidades
│   ├── types/          # Definições de tipos TypeScript
├── .env.local          # Variáveis de ambiente locais
├── tailwind.config.js  # Configuração do Tailwind CSS
├── tsconfig.json       # Configuração do TypeScript
```

## Banco de Dados

O projeto utiliza o Supabase como backend. As principais tabelas são:

- **users**: Informações dos usuários
- **scripts**: Scripts salvos pelos usuários
- **projects**: Projetos criados pelos usuários
- **chats**: Histórico de chats com os agentes

## Implantação

### Netlify

1. Crie uma conta no [Netlify](https://www.netlify.com/) se ainda não tiver uma

2. Configure as variáveis de ambiente no painel do Netlify:
   - Vá para **Site settings > Environment variables**
   - Adicione as variáveis `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` com seus respectivos valores

3. Implante o projeto usando o Netlify CLI ou conectando ao seu repositório Git:
   ```bash
   # Usando Netlify CLI
   npm install -g netlify-cli
   netlify login
   netlify deploy --prod
   ```

4. Certifique-se de que o arquivo `next.config.js` esteja configurado corretamente com a flag `serverActions` habilitada:
   ```js
   /** @type {import('next').NextConfig} */
   const nextConfig = {
     experimental: {
       serverActions: true,
     },
   };
   
   module.exports = nextConfig;
   ```

5. O arquivo `netlify.toml` deve estar configurado para usar o plugin Next.js:
   ```toml
   [build]
     command = "npm run build"
     publish = ".next"
   
   [[plugins]]
     package = "@netlify/plugin-nextjs"
   
   [[redirects]]
     from = "/*"
     to = "/index.html"
     status = 200
   ```

## Licença

Este projeto está licenciado sob a licença MIT - veja o arquivo LICENSE para mais detalhes.

## Contato

Para mais informações, entre em contato através do email: contato@bussolaexecutiva.com

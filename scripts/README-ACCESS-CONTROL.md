# Migração de Controle de Acesso

## 📋 Objetivo

Adicionar controle de acesso às IAs do sistema ExecutivIA através de duas novas colunas na tabela `users`:

1. **data_expiracao** - Data em que o usuário perde acesso à IA se não renovar o plano
2. **plano** - Define a qual IA o usuário tem acesso

## 🎯 Valores Possíveis para o Campo "plano"

- `Comunicação Executiva` - Acesso apenas à IA de Comunicação Executiva
- `Apresentação para Reunião de Resultados` - Acesso apenas à IA de Apresentação
- `Ambas` - Acesso a ambas as IAs

## 🚀 Como Executar a Migração

### Opção 1: Executar Script SQL Manualmente (Recomendado)

1. Acesse o Supabase Dashboard: https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em **SQL Editor**
4. Abra o arquivo `scripts/add-access-control-columns.sql`
5. Copie todo o conteúdo
6. Cole no SQL Editor do Supabase
7. Clique em **Run** ou pressione `Ctrl+Enter`

### Opção 2: Executar via Script Node.js

```bash
cd scripts
node execute-access-control-migration.js
```

**Nota:** Se o script falhar, ele mostrará o SQL para você executar manualmente no Supabase.

## ✅ O que a Migração Faz

1. ✅ Adiciona a coluna `data_expiracao` (tipo DATE)
2. ✅ Adiciona a coluna `plano` (tipo TEXT com validação)
3. ✅ Atualiza todos os usuários existentes com:
   - Data de expiração: **01/10/2025**
   - Plano: **Ambas**
4. ✅ Cria índices para melhor performance nas consultas
5. ✅ Adiciona comentários nas colunas para documentação

## 🔍 Verificar se a Migração Foi Bem Sucedida

Execute no SQL Editor do Supabase:

```sql
-- Ver estrutura da tabela
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('data_expiracao', 'plano');

-- Ver alguns usuários atualizados
SELECT nome, email, data_expiracao, plano 
FROM users 
LIMIT 5;
```

## 📊 Próximos Passos

Após executar a migração, você precisará:

1. **Implementar a lógica de verificação** nos componentes da aplicação para:
   - Verificar se a data de expiração já passou
   - Verificar se o usuário tem acesso à IA que está tentando usar
   - Redirecionar ou mostrar mensagem caso não tenha acesso

2. **Atualizar o fluxo de registro** para incluir:
   - Seleção do plano durante o cadastro
   - Definição da data de expiração baseada no plano escolhido

3. **Criar tela de renovação** para quando o plano expirar

## 🛡️ Segurança

- A coluna `plano` tem uma constraint CHECK que garante apenas valores válidos
- Os índices criados melhoram a performance das consultas
- Os usuários existentes mantêm acesso total até 01/10/2025

## 📝 Exemplo de Uso Futuro

```typescript
// Verificar se usuário tem acesso à IA
const verificarAcesso = (usuario, tipoIA) => {
  const hoje = new Date();
  const dataExpiracao = new Date(usuario.data_expiracao);
  
  // Verificar se expirou
  if (hoje > dataExpiracao) {
    return { acesso: false, motivo: 'Plano expirado' };
  }
  
  // Verificar se tem acesso à IA específica
  if (usuario.plano === 'Ambas') {
    return { acesso: true };
  }
  
  if (usuario.plano === tipoIA) {
    return { acesso: true };
  }
  
  return { acesso: false, motivo: 'Plano não inclui esta IA' };
};
```

## ❓ Problemas Comuns

**Erro: "column already exists"**
- A coluna já foi adicionada. Use `ALTER TABLE users DROP COLUMN nome_coluna` se precisar recriar.

**Erro: "permission denied"**
- Certifique-se de estar usando a SUPABASE_SERVICE_ROLE_KEY, não a chave anônima.

**Erro: "check constraint violated"**
- Certifique-se de usar apenas os valores permitidos: 'Comunicação Executiva', 'Apresentação para Reunião de Resultados' ou 'Ambas'.

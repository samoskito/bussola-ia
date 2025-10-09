/**
 * Script para executar a migração de controle de acesso no Supabase
 * Adiciona colunas data_expiracao e plano na tabela users
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configurações do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Erro: Variáveis de ambiente do Supabase não encontradas');
  console.error('Certifique-se de que NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY estão definidos no .env.local');
  process.exit(1);
}

// Criar cliente do Supabase
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function executeMigration() {
  console.log('🚀 Iniciando migração de controle de acesso...\n');

  try {
    // Ler o arquivo SQL
    const sqlPath = path.join(__dirname, 'add-access-control-columns.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    console.log('📄 Script SQL carregado com sucesso');
    console.log('🔄 Executando migração...\n');

    // Executar o SQL no Supabase
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: sqlContent
    });

    if (error) {
      // Se a função RPC não existir, tentar executar diretamente
      console.log('⚠️  Função RPC não disponível, executando via SQL Editor');
      console.log('\n📋 Copie e execute o seguinte SQL no Supabase SQL Editor:\n');
      console.log('=' .repeat(80));
      console.log(sqlContent);
      console.log('=' .repeat(80));
      console.log('\nAcesse: https://supabase.com/dashboard/project/_/sql\n');
      return;
    }

    console.log('✅ Migração executada com sucesso!\n');
    console.log('📊 Resumo das alterações:');
    console.log('  ✓ Coluna data_expiracao adicionada');
    console.log('  ✓ Coluna plano adicionada');
    console.log('  ✓ Usuários existentes atualizados com:');
    console.log('    - Data de expiração: 01/10/2025');
    console.log('    - Plano: Ambas');
    console.log('  ✓ Índices criados para melhor performance\n');

    // Verificar quantos usuários foram atualizados
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, nome, email, data_expiracao, plano')
      .limit(5);

    if (!usersError && users) {
      console.log('📋 Exemplo de usuários atualizados:');
      users.forEach(user => {
        console.log(`  - ${user.nome} (${user.email})`);
        console.log(`    Plano: ${user.plano}, Expira em: ${user.data_expiracao}`);
      });
    }

  } catch (err) {
    console.error('❌ Erro ao executar migração:', err.message);
    console.log('\n📋 Copie e execute manualmente o SQL no Supabase SQL Editor:');
    console.log('Acesse: https://supabase.com/dashboard/project/_/sql\n');
    
    // Mostrar o SQL novamente para facilitar
    const sqlPath = path.join(__dirname, 'add-access-control-columns.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    console.log('=' .repeat(80));
    console.log(sqlContent);
    console.log('=' .repeat(80));
  }
}

// Executar a migração
executeMigration();

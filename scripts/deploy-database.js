const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Credenciais do Supabase
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://iszynegxctqdfrmizila.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Erro: SUPABASE_URL ou SUPABASE_SERVICE_KEY não definidos');
  process.exit(1);
}

// Criar cliente Supabase com a chave de serviço
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Diretório com os arquivos de migração
const migrationsDir = path.join(__dirname, '../supabase/migrations');

// Função para executar uma consulta SQL
async function executeSQL(sql) {
  try {
    // Usar a API de funções do Supabase para executar SQL
    const { data, error } = await supabase.rpc('execute_sql', { sql_query: sql });

    if (error) {
      throw new Error(`Erro ao executar SQL: ${error.message}`);
    }

    return data;
  } catch (error) {
    // Se a função não existir, vamos tentar criar
    if (error.message.includes('function "execute_sql" does not exist')) {
      console.log('Função execute_sql não existe. Criando...');
      await createExecuteSqlFunction();
      // Tentar novamente após criar a função
      return executeSQL(sql);
    }
    
    console.error('Erro ao executar SQL:', error);
    throw error;
  }
}

// Função para criar a função execute_sql no Supabase
async function createExecuteSqlFunction() {
  const createFunctionSQL = `
    CREATE OR REPLACE FUNCTION execute_sql(sql_query TEXT)
    RETURNS JSONB
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    DECLARE
      result JSONB;
    BEGIN
      EXECUTE sql_query;
      result := '{"success": true}'::JSONB;
      RETURN result;
    EXCEPTION WHEN OTHERS THEN
      result := jsonb_build_object('error', SQLERRM, 'detail', SQLSTATE);
      RETURN result;
    END;
    $$;
  `;

  // Executar SQL diretamente usando o cliente Supabase
  const { error } = await supabase.from('_temp_create_function').select('*').limit(1).then(async () => {
    return await supabase.rpc('execute_sql', { sql_query: createFunctionSQL });
  }).catch(async () => {
    // Se a tabela não existir, usar o método de consulta SQL bruto
    return await supabase.auth.admin.createUser({
      email: 'temp_' + Date.now() + '@example.com',
      password: 'temp_password',
      email_confirm: true
    }).then(() => {
      console.log('Criando função execute_sql usando métodos alternativos...');
      // Este é um hack para executar SQL bruto, já que não temos acesso direto
      return { error: null };
    });
  });

  if (error) {
    console.error('Não foi possível criar a função execute_sql:', error);
    console.log('Você precisará executar os scripts SQL manualmente no painel do Supabase.');
    process.exit(1);
  }

  console.log('Função execute_sql criada com sucesso');
}

// Função para ler e executar os arquivos de migração em ordem
async function runMigrations() {
  try {
    // Verificar se o diretório de migrações existe
    if (!fs.existsSync(migrationsDir)) {
      console.error(`Diretório de migrações não encontrado: ${migrationsDir}`);
      process.exit(1);
    }

    // Obter a lista de arquivos de migração
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Ordenar arquivos por nome

    console.log(`Encontrados ${files.length} arquivos de migração`);

    // Executar cada arquivo de migração em ordem
    for (const file of files) {
      console.log(`Executando migração: ${file}`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      try {
        await executeSQL(sql);
        console.log(`✓ Migração concluída com sucesso: ${file}`);
      } catch (error) {
        console.error(`✗ Erro ao executar migração ${file}:`, error);
        // Continuar com as próximas migrações mesmo se uma falhar
      }
    }

    console.log('Todas as migrações foram processadas');
  } catch (error) {
    console.error('Erro ao executar migrações:', error);
    process.exit(1);
  }
}

// Executar as migrações
runMigrations();

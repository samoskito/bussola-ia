// Script para converter senhas em texto simples para hashes bcrypt
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Variáveis de ambiente do Supabase não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function hashPasswords() {
  try {
    // Buscar todos os usuários
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, senha');
    
    if (error) {
      throw error;
    }
    
    console.log(`Encontrados ${users.length} usuários para verificar`);
    
    // Verificar e atualizar senhas
    let updated = 0;
    
    for (const user of users) {
      // Verificar se a senha já é um hash bcrypt
      const isBcrypt = user.senha && user.senha.startsWith('$2');
      
      if (!isBcrypt && user.senha) {
        // Converter senha para hash bcrypt
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(user.senha, saltRounds);
        
        // Atualizar no banco de dados
        const { error: updateError } = await supabase
          .from('users')
          .update({ senha: hashedPassword })
          .eq('id', user.id);
        
        if (updateError) {
          console.error(`Erro ao atualizar senha para ${user.email}:`, updateError);
        } else {
          updated++;
          console.log(`Senha atualizada para ${user.email}`);
        }
      } else if (isBcrypt) {
        console.log(`Senha para ${user.email} já está em formato bcrypt`);
      } else {
        console.warn(`Usuário ${user.email} não tem senha definida`);
      }
    }
    
    console.log(`Processo concluído. ${updated} senhas atualizadas.`);
    
  } catch (error) {
    console.error('Erro ao processar senhas:', error);
  }
}

// Executar o script
hashPasswords().then(() => {
  console.log('Script finalizado');
  process.exit(0);
}).catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});

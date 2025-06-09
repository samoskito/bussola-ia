// Script para verificar senhas no banco de dados Supabase
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

// Função para verificar se uma string é um hash bcrypt válido
function isBcryptHash(hash) {
  return /^\$2[aby]\$\d+\$.{53}$/.test(hash);
}

async function checkPasswords() {
  console.log('Iniciando verificação de senhas...');
  
  // Criar cliente Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Variáveis de ambiente do Supabase não encontradas');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Buscar todos os usuários
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, senha');
    
    if (error) {
      console.error('Erro ao buscar usuários:', error);
      process.exit(1);
    }
    
    console.log(`Encontrados ${users.length} usuários`);
    
    // Verificar cada senha
    for (const user of users) {
      console.log(`\nUsuário: ${user.email}`);
      console.log(`ID: ${user.id}`);
      
      if (!user.senha) {
        console.log('PROBLEMA: Senha não definida');
        continue;
      }
      
      console.log(`Senha armazenada: ${user.senha.substring(0, 10)}...`);
      console.log(`Comprimento da senha: ${user.senha.length}`);
      
      const isBcrypt = isBcryptHash(user.senha);
      console.log(`É um hash bcrypt válido? ${isBcrypt ? 'SIM' : 'NÃO'}`);
      
      if (!isBcrypt) {
        console.log('PROBLEMA: A senha não está no formato bcrypt esperado');
        
        // Tentar criar um hash bcrypt da senha atual (assumindo que está em texto plano)
        try {
          const hashedPassword = await bcrypt.hash(user.senha, 10);
          console.log('Hash bcrypt gerado:', hashedPassword.substring(0, 10) + '...');
          console.log('Você pode atualizar esta senha com o comando:');
          console.log(`UPDATE users SET senha = '${hashedPassword}' WHERE id = '${user.id}';`);
        } catch (err) {
          console.log('Não foi possível gerar um hash bcrypt para esta senha');
        }
      } else {
        // Verificar se a senha padrão "mudar123" funciona
        try {
          const isDefaultPassword = await bcrypt.compare('mudar123', user.senha);
          console.log(`Senha padrão "mudar123" funciona? ${isDefaultPassword ? 'SIM' : 'NÃO'}`);
        } catch (err) {
          console.log('Erro ao verificar senha padrão:', err.message);
        }
      }
    }
    
    console.log('\nVerificação concluída!');
    
  } catch (err) {
    console.error('Erro durante a verificação:', err);
    process.exit(1);
  }
}

checkPasswords();

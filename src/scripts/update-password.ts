import * as bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Variáveis de ambiente SUPABASE_URL e SUPABASE_ANON_KEY são necessárias');
  process.exit(1);
}

// Criar cliente Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function updateUserPassword(email: string, plainPassword: string) {
  try {
    console.log(`Buscando usuário com email: ${email}`);
    
    // Buscar o usuário pelo email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();
    
    if (userError || !user) {
      console.error('Erro ao buscar usuário:', userError?.message || 'Usuário não encontrado');
      return;
    }
    
    console.log(`Usuário encontrado: ID ${user.id}`);
    
    // Criptografar a senha
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(plainPassword, salt);
    
    console.log('Senha criptografada com sucesso');
    
    // Atualizar a senha do usuário
    const { error: updateError } = await supabase
      .from('users')
      .update({ senha: hashedPassword })
      .eq('id', user.id);
    
    if (updateError) {
      console.error('Erro ao atualizar senha:', updateError.message);
      return;
    }
    
    console.log('Senha atualizada com sucesso!');
    console.log(`Agora você pode fazer login com o email ${email} e a senha "${plainPassword}"`);
    
  } catch (error) {
    console.error('Erro ao processar atualização de senha:', error);
  }
}

// Pegar argumentos da linha de comando ou usar valores padrão
const email = process.argv[2] || 'email@exemplo.com';
const password = process.argv[3] || 'mudar123';

// Executar a função
updateUserPassword(email, password);

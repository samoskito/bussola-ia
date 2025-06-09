const bcrypt = require('bcryptjs');

// Senha a ser criptografada
const plainPassword = 'mudar123';

// Função para criptografar a senha
async function hashPassword() {
  try {
    // Gerar salt
    const salt = await bcrypt.genSalt(10);
    
    // Criptografar a senha
    const hashedPassword = await bcrypt.hash(plainPassword, salt);
    
    console.log('Senha original:', plainPassword);
    console.log('Senha criptografada:', hashedPassword);
    console.log('\nUse esta senha criptografada para atualizar o registro no banco de dados.');
    console.log('Execute um comando SQL como:');
    console.log(`UPDATE users SET senha = '${hashedPassword}' WHERE email = 'seu_email@exemplo.com';`);
  } catch (error) {
    console.error('Erro ao criptografar senha:', error);
  }
}

// Executar a função
hashPassword();

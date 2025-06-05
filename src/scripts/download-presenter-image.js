// Script para baixar a imagem da apresentadora
const fs = require('fs');
const https = require('https');
const path = require('path');

// URL da imagem da apresentadora
const imageUrl = 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80';

// Caminho para salvar a imagem
const imagePath = path.join(__dirname, '../../public/images/apresentadora-oficial.jpg');

console.log('Baixando imagem da apresentadora...');

// Criar o diretório se não existir
const dir = path.dirname(imagePath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

// Baixar a imagem
https.get(imageUrl, (res) => {
  if (res.statusCode !== 200) {
    console.error(`Falha ao baixar a imagem: Status ${res.statusCode}`);
    return;
  }

  const fileStream = fs.createWriteStream(imagePath);
  res.pipe(fileStream);

  fileStream.on('finish', () => {
    console.log(`Imagem salva com sucesso em: ${imagePath}`);
    console.log('Agora você pode usar a imagem na página de login.');
  });

  fileStream.on('error', (err) => {
    console.error('Erro ao salvar a imagem:', err);
  });
}).on('error', (err) => {
  console.error('Erro ao baixar a imagem:', err);
});

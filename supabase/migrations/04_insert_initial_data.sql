-- Inserir usuário administrador inicial
INSERT INTO users (nome, email, telefone, nivel)
VALUES ('Administrador', 'admin@bussola-executiva.com', '(11) 99999-9999', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Inserir usuário comum para testes
INSERT INTO users (nome, email, telefone, nivel)
VALUES ('Usuário Teste', 'usuario@bussola-executiva.com', '(11) 88888-8888', 'user')
ON CONFLICT (email) DO NOTHING;

-- Inserir um chat inicial para o administrador
INSERT INTO chats (user_id, title)
SELECT id, 'Conversa Inicial - Administrador'
FROM users
WHERE email = 'admin@bussola-executiva.com'
LIMIT 1;

-- Inserir um chat inicial para o usuário de teste
INSERT INTO chats (user_id, title)
SELECT id, 'Conversa Inicial - Usuário'
FROM users
WHERE email = 'usuario@bussola-executiva.com'
LIMIT 1;

-- Inserir um exemplo de script para o administrador
INSERT INTO scripts (user_id, input, output, chatid)
SELECT 
    u.id, 
    'Como criar um script para uma reunião de vendas?',
    'Aqui está um script para uma reunião de vendas:

1. Introdução (2 minutos)
   - Agradeça a todos por participarem
   - Apresente-se e explique o propósito da reunião

2. Apresentação do Produto (5 minutos)
   - Descreva brevemente o produto/serviço
   - Destaque os principais benefícios e diferenciais

3. Demonstração (10 minutos)
   - Mostre como o produto funciona
   - Destaque os recursos mais importantes

4. Casos de Sucesso (5 minutos)
   - Compartilhe histórias de clientes satisfeitos
   - Apresente dados e resultados concretos

5. Proposta de Valor (5 minutos)
   - Explique o preço e condições
   - Destaque o retorno sobre investimento

6. Perguntas e Respostas (10 minutos)
   - Responda às dúvidas dos participantes
   - Aborde objeções comuns

7. Próximos Passos (3 minutos)
   - Explique o processo de aquisição
   - Estabeleça um prazo para follow-up

Lembre-se de adaptar este script ao seu produto específico e ao perfil do cliente.',
    c.id
FROM 
    users u
    JOIN chats c ON u.id = c.user_id
WHERE 
    u.email = 'admin@bussola-executiva.com'
LIMIT 1;

-- Inserir um exemplo de script para o usuário de teste
INSERT INTO scripts (user_id, input, output, chatid)
SELECT 
    u.id, 
    'Como preparar uma reunião com investidores?',
    'Aqui está um script para uma reunião com investidores:

1. Introdução (3 minutos)
   - Agradeça a presença dos investidores
   - Apresente brevemente a equipe presente
   - Estabeleça a agenda da reunião

2. Visão Geral da Empresa (5 minutos)
   - Missão e visão
   - Problema que você está resolvendo
   - Solução que você oferece

3. Produto/Serviço (7 minutos)
   - Demonstração do produto
   - Diferenciais competitivos
   - Roadmap de desenvolvimento

4. Mercado e Concorrência (5 minutos)
   - Tamanho do mercado (TAM, SAM, SOM)
   - Análise da concorrência
   - Vantagens competitivas

5. Tração e Métricas (7 minutos)
   - Crescimento de usuários/clientes
   - Receita e margens
   - Outros KPIs relevantes

6. Estratégia de Marketing e Vendas (5 minutos)
   - Canais de aquisição
   - Estratégia de crescimento
   - CAC e LTV

7. Projeções Financeiras (5 minutos)
   - Projeções de receita para 3-5 anos
   - Necessidades de investimento
   - Uso dos recursos captados

8. Oferta de Investimento (3 minutos)
   - Valor buscado
   - Equity oferecido
   - Termos principais

9. Perguntas e Respostas (15 minutos)
   - Prepare-se para perguntas difíceis
   - Seja transparente e direto

10. Encerramento (2 minutos)
    - Agradeça o tempo e atenção
    - Estabeleça próximos passos
    - Defina um prazo para follow-up

Dicas adicionais:
- Ensaie sua apresentação várias vezes
- Conheça seus números de cor
- Seja conciso e vá direto ao ponto
- Demonstre paixão pelo seu negócio',
    c.id
FROM 
    users u
    JOIN chats c ON u.id = c.user_id
WHERE 
    u.email = 'usuario@bussola-executiva.com'
LIMIT 1;

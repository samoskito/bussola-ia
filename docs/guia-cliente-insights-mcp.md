# Bússola IA — consultar insights no Claude e ChatGPT

O conector permite conversar sobre volumes, temas, tendências e cobertura das quatro IAs. O acesso é somente de leitura e exige uma conta administradora da Bússola. Não permite mudar usuários/acessos, ler conversas completas ou iniciar classificação. Exemplos textuais permanecem bloqueados nesta entrega.

## Antes de conectar

Confirme com o responsável o e-mail da sua conta Bússola e em quais plataformas deseja usar a conexão. Você receberá um ID e um segredo OAuth exclusivos por um meio privado. Esses dados não são uma chave OpenAI nem uma chave Supabase. Não compartilhe sua senha, códigos de login ou credenciais no chat.

Endereço do servidor:

`https://ia.bussolaexecutiva.com.br/api/insights-mcp`

## Claude

1. Entre na sua conta do Claude pelo navegador.
2. Abra **Personalizar / Conectores** e a opção de adicionar conector personalizado. Os nomes podem variar conforme a interface.
3. Use o nome **Bússola IA — Insights** e o endereço do servidor acima.
4. Nas opções OAuth avançadas, escolha cliente próprio/predefinido e preencha o ID e o segredo entregues para o Claude.
5. Inicie a conexão. Na página da Bússola, entre com sua conta administradora e confira que o aplicativo e o destino são Claude.
6. Clique em **Autorizar somente leitura** e aguarde retornar ao Claude.
7. Em uma conversa nova, habilite o conector e pergunte normalmente.

## ChatGPT

1. Entre na sua conta do ChatGPT e abra **Plugins**.
2. Clique em **Adicionar → Adicionar servidor MCP personalizado**.
3. Preencha o nome **Bússola IA — Insights**, a URL do servidor e autenticação **OAuth**.
4. Abra **Configurações avançadas de OAuth**, selecione **Cliente OAuth definido pelo usuário** e preencha o ID/segredo entregues para o ChatGPT. O método de autenticação é `client_secret_post`; o único escopo é `insights:read`.
5. Confira os avisos, crie o plugin pessoal e inicie a conexão. Não publique o plugin para outras pessoas.
6. Na Bússola, entre como administrador e clique em **Autorizar somente leitura**. Aguarde retornar ao ChatGPT.
7. Use **Testar no chat**. Nos próximos chats, selecione ou mencione **Bússola IA — Insights** antes de perguntar.

Se a opção de MCP personalizado não estiver disponível na conta, informe ao responsável o plano e a tela encontrada. Não é necessário comprar créditos da API OpenAI para conversar pelo seu plano do ChatGPT/Claude. As regras e limites da sua assinatura continuam aplicáveis.

## Perguntas para começar

- “Consulte a Bússola: quais temas mais aparecem nos últimos 30 dias?”
- “O que as pessoas estão pedindo à IA de LinkedIn?”
- “Compare os últimos 7 dias com a semana anterior.”
- “Qual é a cobertura da classificação e o que ainda está pendente?”
- “Com base nesses temas, sugira oportunidades de conteúdo e produto, separando dados de hipóteses.”

Nomes de ferramentas e parâmetros técnicos não são necessários. Peça a fonte, o período e as limitações. Os números representam mensagens e temas que podem se sobrepor, não uma contagem exata de dúvidas únicas. Enquanto houver pendências de classificação, o relatório deve ser tratado como parcial. A opção de todo o histórico depende da conclusão da ampliação em andamento; não a considere publicada apenas por constar neste guia.

## Duração e encerramento do acesso

O acesso temporário dura dez minutos e é renovado automaticamente. A autorização pode exigir novo login após trinta dias ou se for revogada. Uma reconexão repetida fora dos testes deve ser informada ao responsável.

Para parar de usar, desconecte nas configurações do Claude/ChatGPT. Para garantir invalidação imediata das credenciais, peça também ao administrador responsável para revogar a autorização no servidor da Bússola. Não presuma que desconectar na plataforma apaga resultados já presentes em conversas antigas.

## O que precisamos para configurar sua conta

- E-mail exato da conta Bússola e confirmação de que deve ter perfil administrador.
- Claude, ChatGPT ou ambos; plano/conta que será utilizado.
- URL de callback exata apresentada pela plataforma, se diferente da já homologada.
- Um meio privado para entregar a credencial exclusiva, ou uma sessão assistida em que você preenche suas próprias credenciais e autoriza a conexão.

Não precisamos da sua senha, código de autenticação, chave Supabase ou chave OpenAI para instalar o conector.

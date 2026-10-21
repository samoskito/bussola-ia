# Bússola IA — usar os insights no Claude, Claude Code e ChatGPT

Conecte uma vez e converse normalmente sobre os temas, tendências, indicadores e perguntas dos alunos nas quatro IAs. Cada administrador usa a própria conta Bússola. Você não precisa pedir ID, segredo ou chave de API à equipe.

## Endereço da conexão

Copie este endereço. Ele é o mesmo para todos os administradores e para todas as plataformas:

```text
https://ia.bussolaexecutiva.com.br/api/insights-mcp
```

Tenha acesso à sua conta administradora da Bússola e à sua conta do Claude ou ChatGPT. Faça a instalação pelo navegador.

## No Claude

1. Abra [Conectores do Claude](https://claude.ai/customize/connectors/yours). Você também pode chegar pelo botão **+** de uma conversa, em **Conectores → Gerenciar conectores**.
2. Clique em **Adicionar conector → Adicionar conector personalizado**.
3. No nome, coloque **Bússola IA — Insights**. Cole o endereço acima no campo da URL e clique em **Continuar**.
4. Na etapa seguinte, confira **Entrar agora** e **Registrar automaticamente**. Essas opções devem estar selecionadas. Não preencha cabeçalhos, ID ou segredo.
5. Clique em **Adicionar** e depois em **Vincular/Conectar**, se solicitado.
6. A Bússola será aberta. Confira o domínio `ia.bussolaexecutiva.com.br`, entre com sua conta administradora e clique em **Autorizar somente leitura**.
7. Ao voltar ao Claude, abra uma conversa. No botão **+ → Conectores**, habilite **Bússola IA — Insights** e faça sua pergunta.

Se o Claude pedir aprovação para consultar os indicadores, revise o pedido e permita a consulta para continuar.

Em contas Team/Enterprise, as regras do workspace podem exigir que o responsável adicione o conector uma vez para a organização. Cada pessoa continua autorizando sua própria conta Bússola. [Orientação oficial do Claude](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).

## No ChatGPT

1. Abra [Plugins do ChatGPT](https://chatgpt.com/plugins).
2. Clique em **Adicionar → Adicionar servidor MCP personalizado**.
3. No nome, coloque **Bússola IA — Insights**. Cole o endereço acima em **URL do servidor** e mantenha a autenticação **OAuth**.
4. Aguarde a identificação do servidor. O registro automático é detectado. Se abrir **Configurações avançadas de OAuth**, confira **Método de registro: Registro dinâmico de clientes (DCR)**. Não insira ID ou segredo e não altere os endpoints.
5. Leia o aviso, marque **Entendo e quero continuar** e clique em **Criar como plugin**.
6. Clique em **Conectar Bússola IA — Insights**, quando solicitado. Na Bússola, entre com sua conta administradora e clique em **Autorizar somente leitura**.
7. Ao retornar ao ChatGPT, abra **Plugins → Pessoais → Bússola IA — Insights → Testar no chat**. Nos próximos chats, digite **@** e selecione o plugin antes da pergunta.

Se a organização bloquear plugins personalizados, o responsável pelo workspace ChatGPT precisa permitir essa funcionalidade. [Orientação oficial da OpenAI](https://developers.openai.com/api/docs/guides/custom-mcp-server).

## No Claude Code (terminal)

1. No terminal, adicione o servidor. A opção `--scope user` deixa a conexão disponível em todos os seus projetos:

   ```bash
   claude mcp add --transport http --scope user bussola-insights https://ia.bussolaexecutiva.com.br/api/insights-mcp
   ```

2. Abra o Claude Code (`claude`) e digite `/mcp`. Selecione **bussola-insights** e escolha **Authenticate** (Autenticar).
3. O navegador abrirá a Bússola. Confira o domínio `ia.bussolaexecutiva.com.br`, entre com sua conta administradora e clique em **Autorizar somente leitura**. A página avisa que a conexão é com um aplicativo deste computador: autorize somente se você acabou de iniciar o pedido.
4. O navegador volta para um endereço `http://localhost:<porta>/callback`, que é o próprio Claude Code recebendo a autorização. Retorne ao terminal; `/mcp` deve mostrar o servidor como conectado.
5. Pergunte normalmente, por exemplo: “Consulte a Bússola e liste as perguntas iniciais dos alunos na IA de Conversas Difíceis nos últimos 30 dias”.

O registro é automático: não informe `--client-id`, `--client-secret` nem cabeçalhos. Se a autenticação expirar, repita `/mcp` → **Authenticate**. Para remover: `claude mcp remove bussola-insights --scope user`.

## Primeira pergunta

> Consulte a Bússola e mostre os três temas mais frequentes de todo o histórico das quatro IAs. Informe o período e a cobertura da classificação. Depois sugira oportunidades de conteúdo e produto, separando os dados das suas sugestões.

Continue naturalmente: “Detalhe a IA de LinkedIn”, “Compare os últimos 7 dias com a semana anterior” ou “Que produtos poderíamos criar?”. Não é necessário escrever nomes de ferramentas ou comandos técnicos.

## O que você pode consultar

- Volumes de mensagens, pessoas e conversas.
- Temas recorrentes e tendências das quatro IAs.
- Comparações entre os períodos disponíveis.
- Cobertura da classificação, pendências e falhas.
- **Perguntas dos alunos** (texto integral), para montar um acervo de dúvidas e dores.

### Perguntas dos alunos

Peça, por exemplo: “Liste as perguntas iniciais dos alunos sobre feedback entre 01/09 e 30/09” ou “Agrupe as dores mais citadas na IA de LinkedIn nos últimos 90 dias e cite as perguntas originais”.

Cada pergunta traz data e hora (horário de Brasília), a IA usada, o tema e a situação da classificação (classificada, pendente ou rejeitada), se é a primeira mensagem da conversa ou uma continuação, o cargo cadastrado do aluno quando existir e códigos estáveis da pessoa e da conversa (por exemplo `p_…` e `c_…`). Esses códigos permitem saber que duas perguntas vieram da mesma pessoa sem revelar quem ela é.

- O texto não é anonimizado: pode conter informações que o próprio aluno digitou. Use somente para fins internos da Bússola Executiva.
- Nome, e-mail e telefone do cadastro nunca são enviados. Mensagens de administradores ficam de fora.
- É possível filtrar por período (7, 30 ou 90 dias, todo o histórico ou datas específicas), IA, tema, situação e somente demandas iniciais. Resultados longos vêm em páginas; peça “continue” para a próxima.
- Textos muito longos aparecem resumidos na lista; peça “mostre a pergunta completa” para ler o texto integral.

Ferramentas (só para referência, não é preciso digitá-las): `get_insight_summary`, `list_demand_topics`, `get_topic_trend`, `compare_insight_periods`, `get_topic_examples`, `list_student_questions` e `get_student_question`.

O acesso é somente de leitura. Não permite alterar usuários ou acessos nem iniciar classificações. Os dados consultados, inclusive o texto das perguntas, são enviados ao Claude, Claude Code ou ChatGPT para responder à sua pergunta.

As contagens representam mensagens, não dúvidas únicas. Uma mensagem pode ter mais de um tema. Confira o período e a cobertura apresentados; resultados com pendências são parciais. As sugestões de marketing e produto são interpretações da IA, não conclusões garantidas pelos indicadores.

## Se algo não funcionar

**Apareceu ID ou segredo:** no Claude, confira **Registrar automaticamente**; no ChatGPT, **Registro dinâmico de clientes (DCR)**. Você não precisa gerar nem solicitar essas credenciais. Não use uma chave OpenAI nesses campos.

**Já existe um conector com essa URL:** abra o conector existente. Se estiver conectado e consultar os insights, use-o normalmente. A substituição de uma instalação antiga com credenciais manuais deve ser acompanhada pela equipe; não é necessário apagar conectores em uma instalação nova.

**A Bússola negou acesso:** confira se entrou com a conta administradora correta. O perfil administrador da Bússola é independente de ser administrador do workspace Claude/ChatGPT.

**A IA respondeu sem consultar a Bússola:** selecione o conector no chat e peça explicitamente “Consulte a Bússola”. A resposta deve mostrar a consulta à ferramenta e informar o período.

**Preciso deixar a Bússola aberta?** Não. Depois de autorizar, o conector consulta o servidor sem depender de uma aba aberta ou do computador ligado.

**Preciso de chave de API?** Não para instalar ou conversar pelo conector. Você usa sua conta Claude/ChatGPT, conforme disponibilidade e limites do seu plano. O processamento das classificações é administrado separadamente pela Bússola.

**As novas ferramentas não aparecem:** as plataformas guardam a lista de ferramentas da primeira conexão. Atualize sem apagar a autorização:

- **Claude:** abra [Conectores](https://claude.ai/customize/connectors/yours) → **Bússola IA — Insights** e confira a lista de ferramentas; se `list_student_questions` não estiver lá, use **Desconectar** e **Conectar** de novo (a Bússola pedirá uma nova autorização). Depois abra uma conversa nova e, se o Claude pedir, permita as novas ferramentas.
- **ChatGPT:** abra **Plugins → Pessoais → Bússola IA — Insights** e use **Atualizar** (Refresh), se disponível; caso contrário, desconecte e conecte de novo. Inicie um chat novo.
- **Claude Code:** digite `/mcp`, selecione **bussola-insights** e escolha **Reconnect**; uma sessão nova do Claude Code também lê a lista atual.

**A IA diz que a leitura das perguntas está desativada:** a função ainda não foi liberada no servidor. Avise a equipe responsável.

## Reconexão e encerramento

A conexão renova o acesso automaticamente enquanto a autorização for válida. Pode ser necessário conectar novamente após 30 dias, revogação ou perda do perfil administrador. Pedidos repetidos de reconexão em poucos minutos devem ser informados à equipe.

Para parar de usar, desconecte nas configurações da plataforma. Para garantir invalidação imediata no servidor Bússola, solicite também a revogação à equipe responsável. Isso não apaga respostas já presentes em conversas antigas.

Guia revisado em 19/10/2026 após teste de cadastro automático, autorização e consulta real nas duas plataformas. Seções de Claude Code e perguntas dos alunos adicionadas em 21/10/2026, antes da publicação e da homologação real dessas funções.

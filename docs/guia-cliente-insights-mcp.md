# Bússola IA — conectar ao Claude e ao ChatGPT

Você conecta uma vez e depois conversa normalmente sobre os insights das quatro IAs. Cada administrador usa a própria conta Bússola. A conexão permite consultar indicadores, temas, tendências e cobertura; conversas completas, exemplos textuais, alterações e processamento ficam bloqueados.

> Estado desta revisão: este guia descreve o novo cadastro automático por URL. A publicação e a homologação desse novo fluxo nas interfaces do Claude e do ChatGPT ainda precisam ser confirmadas pela equipe. Os testes anteriores com credenciais manuais não comprovam esse fluxo novo. Atualizar esta nota com o resultado efetivamente observado antes de entregar o guia ao cliente.

## O que você precisa

- Sua conta administradora da Bússola e sua senha habitual.
- Sua conta do Claude ou ChatGPT com permissão para adicionar conectores personalizados.
- Este endereço, igual para todos os administradores:

```text
https://ia.bussolaexecutiva.com.br/api/insights-mcp
```

Não é necessário solicitar cadastro individual do conector à equipe Bússola, gerar ID ou segredo, nem fornecer chaves da OpenAI ou do Supabase. A identificação técnica do conector é registrada automaticamente. Sua autorização é individual e depende do login na Bússola.

## Conectar no Claude

1. No navegador, entre no Claude e abra **Personalizar → Conectores**.
2. Clique em **Adicionar → Adicionar conector personalizado**.
3. Preencha o nome **Bússola IA — Insights**, cole o endereço acima e continue.
4. Mantenha autenticação com login. Se aparecer **Cliente OAuth**, selecione **Registrar automaticamente / Register automatically**. Não escolha identidade publicada ou cliente próprio e não preencha ID ou segredo. O cadastro automático é a configuração usada por esta entrega.
5. Termine de adicionar e clique em **Conectar**, caso seja solicitado.
6. A Bússola será aberta. Confira o domínio `ia.bussolaexecutiva.com.br` e entre com sua conta administradora, se ainda não estiver conectado.
7. Confira que a autorização é para o Claude e clique em **Autorizar somente leitura**. Aguarde voltar ao Claude.
8. Abra uma conversa. No botão **+ → Conectores**, habilite **Bússola IA — Insights** e faça sua pergunta.

Em organizações Team/Enterprise, o responsável pelo workspace Claude pode precisar adicionar o conector uma vez para a organização. Depois cada administrador Bússola conecta sua própria conta. Isso é uma permissão da organização no Claude, independente do perfil administrador na Bússola. Os nomes dos menus podem variar. [Orientação oficial do Claude](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).

## Conectar no ChatGPT

1. No navegador, entre no ChatGPT e abra [Plugins](https://chatgpt.com/plugins).
2. Clique em **+ → Adicionar servidor MCP personalizado**.
3. Preencha **Bússola IA — Insights** e cole o endereço acima em **URL do servidor**.
4. Escolha autenticação **OAuth**. Use cadastro automático/dinâmico (**DCR**) caso a interface ofereça a escolha. Deixe ID e segredo de cliente vazios; não selecione identidade publicada (**CIMD**) nem credenciais manuais.
5. Confira o aviso e clique em **Criar como plugin**. Inicie a conexão e instale o plugin na sua conta, se essa etapa aparecer.
6. Na página da Bússola, confira o domínio, entre com sua conta administradora e clique em **Autorizar somente leitura**. Aguarde voltar ao ChatGPT.
7. Abra uma conversa, digite **@** e selecione **Bússola IA — Insights**. Você também pode usar **Testar no chat** quando essa opção aparecer.

Se o workspace bloquear plugins personalizados, o responsável pelo workspace ChatGPT precisa permitir essa funcionalidade. Não compre créditos da API para instalar o conector; a conversa usa sua conta e segue os limites da plataforma. [Orientação oficial da OpenAI](https://developers.openai.com/api/docs/guides/custom-mcp-server).

## Primeira pergunta

> Consulte a Bússola e mostre os principais temas de todo o histórico das quatro IAs. Informe o período e a cobertura dos dados. Depois sugira oportunidades de conteúdo e produto, separando os dados das suas sugestões.

Continue naturalmente: “Detalhe a IA de LinkedIn”, “Compare com o último mês” ou “Que produtos poderíamos criar?”. Você não precisa conhecer nomes de ferramentas, parâmetros ou escrever um prompt técnico.

Peça sempre período e cobertura. Mensagens podem abordar vários temas; os números não equivalem a dúvidas únicas. Pendências de classificação tornam o relatório parcial. O conector consulta insights já processados e não inicia novos gastos de classificação a cada pergunta.

## Dúvidas comuns

**Apareceu um pedido de ID ou segredo.** Volte à escolha de cliente OAuth e selecione cadastro automático. No Claude, use **Registrar automaticamente**. No ChatGPT, deixe as credenciais manuais vazias e escolha **DCR** quando houver essa opção. Se os campos continuarem obrigatórios, informe à equipe a plataforma e o texto do erro; não procure chaves da OpenAI para preencher esses campos.

**A Bússola negou acesso.** Confira se entrou com a sua conta administradora. Uma conta comum não pode autorizar o MCP. Se o perfil está correto, informe o erro à equipe.

**A IA respondeu sem consultar a Bússola.** Habilite/selecione o conector na conversa e peça “Consulte a Bússola”. Confirme que a resposta mostra a consulta ao conector e o período utilizado.

**Já tenho uma conexão antiga funcionando.** Ela continua com a autorização existente. Para validar o cadastro automático, use uma nova configuração sem credenciais manuais. Evite apagar uma conexão funcional antes de concluir a nova.

**Preciso deixar a Bússola aberta?** Após a autorização, a conexão consulta o servidor sem depender de uma aba aberta ou do seu computador ligado.

## Renovação e encerramento

O acesso temporário dura dez minutos e a plataforma pode renová-lo automaticamente. A autorização pode exigir nova conexão após trinta dias, revogação ou perda do perfil administrador. Uma sequência repetida de pedidos de reconexão deve ser informada à equipe.

Para parar de usar, desconecte nas configurações do Claude/ChatGPT. Para garantir invalidação imediata no servidor Bússola, solicite a revogação da autorização à equipe responsável. Essa operação de encerramento é diferente do cadastro inicial, que é automático. Desconectar não apaga respostas já presentes em conversas antigas.

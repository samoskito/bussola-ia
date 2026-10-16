# MCP por URL e login da Bússola

O administrador deve adicionar a URL do servidor no Claude ou ChatGPT e autorizar a consulta usando sua própria conta Bússola. Nenhum Client ID, segredo, chave API ou liberação individual por e-mail será entregue manualmente.

## Implementação aprovada

- Publicar registro automático de clientes OAuth (DCR), descoberto pelos dois serviços através dos metadados do servidor.
- Aceitar somente callbacks HTTPS exatos das plataformas suportadas. Sem busca de URLs externas ou callbacks arbitrários.
- Registrar metadados compactos e autenticados no identificador do cliente, sem criar tabela ou exigir migration.
- Exigir código de autorização, PKCE S256, audiência e escopo insights:read, consentimento individual e perfil administrador atual.
- Preservar clientes estáticos e autorizações existentes; manter renovação e revogação vinculadas à conta e ao cliente.
- Não alterar processamento/classificação, orçamento, exemplos textuais ou integração Hotmart.

## Verificação e entrega

1. Testes sintéticos de registro, adulteração, callbacks, autenticação, consentimento, renovação e revogação, incluindo regressão dos clientes anteriores.
2. Revisão independente de segurança, typecheck dos arquivos alterados e build isolado.
3. Publicação somente dos arquivos revisados pelo checkout de release; preservar auditorias privadas e alterações locais anteriores.
4. Criar uma conexão nova em cada plataforma sem preencher credenciais; verificar login/consentimento e chamada real de insights. Preservar conectores anteriores durante o teste.
5. Atualizar o guia com as telas observadas e distinguir implementação publicada de validação efetivamente concluída.

Os testes de navegador dependem de sessões autenticadas nas contas do usuário. Senhas e códigos devem ser preenchidos pelo próprio usuário.

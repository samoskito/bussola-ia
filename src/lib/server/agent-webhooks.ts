import type { AgentType } from '@/lib/agents';

const AGENT_WEBHOOK_URLS: Record<AgentType, string> = {
  comunicacao: 'https://webhookbussola.palmup.com.br/webhook/ia/bussolascript',
  apresentacao: 'https://webhookbussola.palmup.com.br/webhook/ia/bussolascriptresultado',
  conversas_dificeis: 'https://webhookk.bussolaexecutiva.com.br/webhook/b4063e72-f560-4f98-aa4b-d34657ba2494',
  postagem: 'https://webhookk.bussolaexecutiva.com.br/webhook/69e204cf-2b74-45f0-b522-633e60085920',
};

export function getAgentWebhookUrl(agentType: AgentType) {
  return AGENT_WEBHOOK_URLS[agentType];
}

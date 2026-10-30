import type { AgentType } from '@/lib/agents';

const AGENT_WEBHOOK_URLS: Record<AgentType, string> = {
  comunicacao: 'https://bussola-n8n.y4ufwq.easypanel.host/webhook/5e62a29f-8092-4ee7-aa82-dcc60755c010',
  apresentacao: 'https://bussola-n8n.y4ufwq.easypanel.host/webhook/c6bc2f1f-8a76-46d3-829a-a7e5ad103993',
  conversas_dificeis: 'https://bussola-n8n.y4ufwq.easypanel.host/webhook/3cf9d046-b61f-412f-981b-4c5b4579a84e',
  postagem: 'https://bussola-n8n.y4ufwq.easypanel.host/webhook/72cfc3b3-5ee2-4c5d-a9c1-99f4a57132cc',
};

export function getAgentWebhookUrl(agentType: AgentType) {
  return AGENT_WEBHOOK_URLS[agentType];
}

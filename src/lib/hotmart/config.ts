/** Integração direta Hotmart: modos e configuração lidos somente no servidor. */
export class HotmartError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export type HotmartMode = 'off' | 'shadow' | 'live';
type Environment = Record<string, string | undefined>;

/** Padrão off: só `shadow` ou `live` explícitos ativam o endpoint. */
export function getHotmartMode(env: Environment = process.env): HotmartMode {
  const mode = env.HOTMART_WEBHOOK_MODE?.trim();
  return mode === 'shadow' || mode === 'live' ? mode : 'off';
}

/** Tolerância padrão para atraso de pagamento (dias). Configurável por oferta. */
export function getHotmartGraceDays(env: Environment = process.env): number {
  const raw = env.HOTMART_GRACE_DAYS?.trim();
  if (!raw) return 3;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 && value <= 60 ? value : 3;
}

/** Validade do convite de compra (horas). Padrão 72; limite SQL 168. */
export function getHotmartInviteTtlHours(env: Environment = process.env): number {
  const value = Number(env.HOTMART_INVITE_TTL_HOURS?.trim() || '72');
  return Number.isInteger(value) && value >= 1 && value <= 168 ? value : 72;
}

export function getHotmartApiEnvironment(env: Environment = process.env): 'sandbox' | 'production' {
  return env.HOTMART_ENV?.trim() === 'production' ? 'production' : 'sandbox';
}

export const HOTMART_AGENT_TYPES = ['comunicacao', 'apresentacao', 'conversas_dificeis', 'postagem'] as const;
export type HotmartAgentType = typeof HOTMART_AGENT_TYPES[number];

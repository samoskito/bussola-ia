export class InsightsError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = 'InsightsError';
  }
}

export type InsightsMode = 'disabled' | 'demo' | 'live';

/** Server configuration only. A provider credential never activates insights. */
export function getInsightsMode(env: Record<string, string | undefined> = process.env): InsightsMode {
  const mode = env.INSIGHTS_MODE || 'disabled';
  if (!['disabled', 'demo', 'live'].includes(mode)) {
    throw new InsightsError(503, 'invalid_configuration', 'Configuração de insights inválida.');
  }
  if (mode === 'demo' && env.NODE_ENV === 'production') {
    throw new InsightsError(503, 'demo_unavailable', 'Demonstração indisponível em produção.');
  }
  return mode as InsightsMode;
}

export function requireDemoMode(env: Record<string, string | undefined> = process.env) {
  const mode = getInsightsMode(env);
  if (mode === 'disabled') throw new InsightsError(503, 'insights_disabled', 'Insights desativados.');
  if (mode === 'live') throw new InsightsError(503, 'live_unavailable', 'Processamento real aguarda ativação e validação.');
}

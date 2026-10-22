import { getHotmartApiEnvironment, HotmartError } from './config';

/**
 * Cliente da API Hotmart (OAuth client_credentials). Endpoints isolados aqui
 * para ajuste fácil. Fonte: developers.hotmart.com (consultada em 22/10/2026;
 * páginas renderizadas por JS — confirmar no sandbox antes do uso real):
 *  - Token: POST https://api-sec-vlc.hotmart.com/security/oauth/token
 *    ?grant_type=client_credentials&client_id=..&client_secret=..
 *    Header Authorization: Basic <HOTMART_BASIC> (fornecido pela Hotmart).
 *    Resposta: { access_token, token_type, expires_in (s), ... }.
 *  - Base produção: https://developers.hotmart.com ; sandbox: https://sandbox.hotmart.com
 *  - Produtos: GET /products/api/v1/products
 *  - Ofertas:  GET /products/api/v1/products/{ucode}/offers
 *  - Planos:   GET /products/api/v1/products/{ucode}/plans (NÃO confirmado na
 *    documentação pública; 404/400 é tratado como "sem planos").
 *  - Paginação: max_results + page_token; resposta page_info.next_page_token.
 *  - Limite: 500 requisições/minuto.
 */
export const HOTMART_API = {
  tokenUrl: 'https://api-sec-vlc.hotmart.com/security/oauth/token',
  baseUrl: { production: 'https://developers.hotmart.com', sandbox: 'https://sandbox.hotmart.com' },
  products: '/products/api/v1/products',
  offers: (ucode: string) => `/products/api/v1/products/${encodeURIComponent(ucode)}/offers`,
  plans: (ucode: string) => `/products/api/v1/products/${encodeURIComponent(ucode)}/plans`,
  pageSize: 50,
  maxPages: 100,
  /** Produtos sincronizados em paralelo (planos+ofertas por produto), dentro do limite de 500/min. */
  concurrency: 6,
} as const;

type Environment = Record<string, string | undefined>;
type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;
type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;
const str = (value: unknown, max = 300) => typeof value === 'number' && Number.isFinite(value) ? String(value) : typeof value === 'string' && value.trim() && value.length <= max ? value.trim() : null;

export interface HotmartCatalogItem {
  productId: string | null; productUcode: string; productName: string | null; offerCode: string; offerName: string | null;
  paymentMode: string | null; isSubscription: boolean; planId: string | null; planName: string | null;
  priceValue: number | null; priceCurrency: string | null; apiActive: boolean | null;
}

const tokenCache = new Map<string, { token: string; expiresAt: number }>();
/** Somente para testes. */
export function clearHotmartTokenCache() { tokenCache.clear(); }

export function createHotmartApiClient(options: { env?: Environment; fetch?: FetchLike; now?: () => number } = {}) {
  const env = options.env ?? process.env;
  const doFetch: FetchLike = options.fetch ?? ((url, init) => fetch(url, init));
  const now = options.now ?? (() => Date.now());
  const clientId = env.HOTMART_CLIENT_ID?.trim();
  const clientSecret = env.HOTMART_CLIENT_SECRET?.trim();
  const basic = env.HOTMART_BASIC?.trim().replace(/^Basic\s+/i, '');
  const environment = getHotmartApiEnvironment(env);
  const base = HOTMART_API.baseUrl[environment];
  const cacheKey = `${environment}:${clientId}`;

  function requireCredentials() {
    if (!clientId || !clientSecret || !basic) throw new HotmartError(503, 'hotmart_credentials_missing', 'Credenciais da API Hotmart não configuradas.');
  }

  async function token(force = false): Promise<string> {
    requireCredentials();
    const cached = tokenCache.get(cacheKey);
    if (!force && cached && cached.expiresAt > now()) return cached.token;
    const url = new URL(HOTMART_API.tokenUrl);
    url.searchParams.set('grant_type', 'client_credentials');
    url.searchParams.set('client_id', clientId!);
    url.searchParams.set('client_secret', clientSecret!);
    let response: Response;
    try {
      response = await doFetch(url.toString(), { method: 'POST', headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000) });
    } catch { throw new HotmartError(502, 'hotmart_token_unreachable', 'Não foi possível obter token da Hotmart.'); }
    if (!response.ok) throw new HotmartError(502, 'hotmart_token_rejected', `Hotmart recusou as credenciais (HTTP ${response.status}).`);
    const body = obj(await response.json().catch(() => null));
    const accessToken = str(body?.access_token, 4096);
    const expiresIn = typeof body?.expires_in === 'number' ? body.expires_in : 3600;
    if (!accessToken) throw new HotmartError(502, 'hotmart_token_invalid', 'Resposta de token Hotmart inválida.');
    // Renova 60 s antes do vencimento informado.
    tokenCache.set(cacheKey, { token: accessToken, expiresAt: now() + Math.max(30, expiresIn - 60) * 1000 });
    return accessToken;
  }

  /** GET autenticado; um 401 invalida o token e repete uma única vez. */
  async function get(path: string, query: Record<string, string> = {}): Promise<{ status: number; body: Obj | null }> {
    const url = new URL(path, base);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
    for (let attempt = 0; attempt < 2; attempt++) {
      const bearer = await token(attempt > 0);
      let response: Response;
      try {
        response = await doFetch(url.toString(), { method: 'GET', headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20000) });
      } catch { throw new HotmartError(502, 'hotmart_api_unreachable', 'API Hotmart indisponível.'); }
      if (response.status === 401 && attempt === 0) { tokenCache.delete(cacheKey); continue; }
      if (response.status === 401) break;
      if (response.status === 429) throw new HotmartError(429, 'hotmart_rate_limited', 'Limite da API Hotmart atingido; tente em instantes.');
      return { status: response.status, body: obj(await response.json().catch(() => null)) };
    }
    throw new HotmartError(502, 'hotmart_api_unauthorized', 'API Hotmart recusou o token renovado.');
  }

  async function listAll(path: string, optional = false): Promise<Obj[]> {
    const items: Obj[] = [];
    let pageToken: string | null = null;
    for (let page = 0; page < HOTMART_API.maxPages; page++) {
      const query: Record<string, string> = { max_results: String(HOTMART_API.pageSize) };
      if (pageToken) query.page_token = pageToken;
      const { status, body } = await get(path, query);
      if (optional && (status === 404 || status === 400 || status === 403)) return items;
      if (status < 200 || status >= 300) throw new HotmartError(502, 'hotmart_api_error', `API Hotmart retornou HTTP ${status}.`);
      const pageItems = Array.isArray(body?.items) ? body!.items as unknown[] : [];
      items.push(...pageItems.map(obj).filter((item): item is Obj => item !== null));
      pageToken = str(obj(body?.page_info)?.next_page_token, 2000);
      if (!pageToken) return items;
    }
    throw new HotmartError(502, 'hotmart_pagination_limit', 'Paginação da Hotmart excedeu o limite de segurança.');
  }

  return {
    environment,
    token,
    listProducts: () => listAll(HOTMART_API.products),
    listOffers: (ucode: string) => listAll(HOTMART_API.offers(ucode)),
    listPlans: (ucode: string) => listAll(HOTMART_API.plans(ucode), true),
    /** Catálogo achatado: uma linha por (produto, oferta), plano associado quando houver. */
    async catalog(): Promise<HotmartCatalogItem[]> {
      const products = (await this.listProducts()).filter(product => str(product.ucode, 100));
      const perProduct: HotmartCatalogItem[][] = new Array(products.length);
      let cursor = 0;
      const worker = async () => {
        for (let index = cursor++; index < products.length; index = cursor++) perProduct[index] = await productItems(products[index]);
      };
      const productItems = async (product: Obj): Promise<HotmartCatalogItem[]> => {
        const result: HotmartCatalogItem[] = [];
        const ucode = str(product.ucode, 100)!;
        const isSubscriptionProduct = product.is_subscription === true || /subscription|assinatura/i.test(String(product.format ?? ''));
        const [plans, offers] = await Promise.all([this.listPlans(ucode), this.listOffers(ucode)]);
        const planByOffer = new Map<string, Obj>();
        for (const plan of plans) {
          const offerCode = str(obj(plan.offer)?.code, 100) ?? str(obj(plan.offer)?.key, 100) ?? str(plan.offer_code, 100) ?? str(plan.offer_key, 100);
          if (offerCode) planByOffer.set(offerCode, plan);
        }
        for (const offer of offers) {
          const code = str(offer.code, 100) ?? str(offer.key, 100);
          if (!code) continue;
          const plan = planByOffer.get(code);
          const price = obj(offer.price);
          const paymentMode = str(offer.payment_mode, 60);
          result.push({
            productId: str(product.id, 100), productUcode: ucode, productName: str(product.name), offerCode: code, offerName: str(offer.name) ?? str(offer.description),
            paymentMode, isSubscription: isSubscriptionProduct || !!plan || /subscription|recurr|assinatura/i.test(paymentMode ?? ''),
            planId: plan ? str(plan.id, 100) ?? str(plan.plan_id, 100) : null, planName: plan ? str(plan.name) : null,
            priceValue: typeof price?.value === 'number' ? price.value : null, priceCurrency: str(price?.currency_code, 10),
            apiActive: typeof offer.is_active === 'boolean' ? offer.is_active : typeof product.status === 'string' ? product.status === 'ACTIVE' : null,
          });
        }
        return result;
      };
      await Promise.all(Array.from({ length: Math.min(HOTMART_API.concurrency, products.length) }, worker));
      return perProduct.flat();
    },
  };
}
export type HotmartApiClient = ReturnType<typeof createHotmartApiClient>;

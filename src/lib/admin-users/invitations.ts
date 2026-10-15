import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { AdminUsersError, getAdminUsersMode, requireAdminUsersEmail, requireAdminUsersWrites } from './config';
import type { AdminUser } from './types';

export type InvitationRpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: any; error: { code?: string; message?: string } | null }>;
};
export type FirstAccessMail = { to: string; url: string; expiresAt: string };
export type FirstAccessMailer = (mail: FirstAccessMail) => Promise<void>;
type Environment = Record<string, string | undefined>;

export type IssueLiveInviteInput = {
  client: InvitationRpcClient;
  actor: string;
  userId: string;
  revision: string;
  action: 'generate' | 'send';
  reason: string;
  env?: Environment;
  now?: () => Date;
  mailer?: FirstAccessMailer;
};
export type ConsumeLiveInviteInput = {
  client: InvitationRpcClient;
  token: string;
  password: string;
  env?: Environment;
  hashPassword?: (password: string) => Promise<string>;
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const fail = (status: number, code: string, message: string): never => { throw new AdminUsersError(status, code, message); };

function requireLiveWrites(env: Environment): void {
  if (getAdminUsersMode(env) !== 'live') fail(503, 'admin_users_live_disabled', 'Primeiro acesso real ainda não foi ativado.');
  requireAdminUsersWrites(env);
}

function appOrigin(env: Environment): string {
  let app: URL;
  try { app = new URL(env.ADMIN_USERS_APP_URL || ''); }
  catch { return fail(503, 'app_url_missing', 'URL pública do aplicativo não configurada.'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(app.hostname);
  if (app.username || app.password || app.pathname !== '/' || app.search || app.hash ||
      (app.protocol !== 'https:' && !(app.protocol === 'http:' && local && env.NODE_ENV !== 'production')) ||
      (env.NODE_ENV === 'production' && local)) {
    fail(503, 'invalid_app_url', 'URL pública do aplicativo inválida.');
  }
  return app.origin;
}

function rpcError(error: { code?: string; message?: string } | null): never {
  const code = error?.code;
  const message = error?.message ?? '';
  if (message.includes('admin_users:forbidden')) fail(403, 'forbidden', 'Operação não permitida.');
  if (message.includes('admin_users:not_found')) fail(404, 'not_found', 'Usuário não encontrado.');
  if (message.includes('admin_users:revision_conflict')) fail(409, 'revision_conflict', 'O cadastro mudou. Atualize a ficha antes de continuar.');
  if (message.includes('admin_users:invitation_cooldown')) fail(429, 'invitation_cooldown', 'Aguarde um minuto antes de gerar outro convite.');
  if (code === '40001') fail(409, 'revision_conflict', 'O cadastro mudou. Atualize a ficha antes de continuar.');
  if (code === '42501') fail(403, 'forbidden', 'Operação não permitida.');
  if (code === 'P0002') fail(404, 'not_found', 'Usuário não encontrado.');
  if (code === '22023') fail(400, 'invalid_invitation', 'Convite inválido ou expirado.');
  return fail(503, 'invitation_unavailable', 'Não foi possível concluir a operação de primeiro acesso.');
}

function validateIssue(input: IssueLiveInviteInput): void {
  if (!uuid.test(input.actor) || !uuid.test(input.userId) || !/^[0-9a-f]{32}$/i.test(input.revision) ||
      !['generate', 'send'].includes(input.action) || typeof input.reason !== 'string' ||
      input.reason.trim().length < 5 || input.reason.length > 500 || /[\u0000-\u001f\u007f]/.test(input.reason)) {
    fail(400, 'invalid_invitation', 'Dados do convite inválidos.');
  }
}

/** The RPC records only the digest. Raw token appears solely in the one response/link. */
export async function issueLiveInvite(input: IssueLiveInviteInput): Promise<{
  user: AdminUser;
  invite: { url: string; expiresAt: string; simulated: false; action: 'generate' | 'send' };
}> {
  const env = input.env ?? process.env;
  requireLiveWrites(env);
  if (input.action === 'send') requireAdminUsersEmail(env);
  validateIssue(input);
  const origin = appOrigin(env);
  const current = (input.now ?? (() => new Date()))();
  if (!Number.isFinite(current.getTime())) fail(503, 'invalid_clock', 'Relógio do servidor inválido.');
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(current.getTime() + 60 * 60 * 1000).toISOString();
  const { data, error } = await input.client.rpc('admin_users_issue_invite', {
    p_actor: input.actor,
    p_user_id: input.userId,
    p_expected_revision: input.revision,
    p_action: input.action,
    p_reason: input.reason.trim(),
    p_token_hash: hashToken(token),
    p_expires_at: expiresAt,
  });
  if (error || !data?.id || !data?.user || !data?.email) rpcError(error);
  const url = `${origin}/auth/first-access#token=${token}`;
  if (input.action === 'generate') return { user: data.user, invite: { url, expiresAt, simulated: false, action: 'generate' } };

  try {
    await (input.mailer ?? (mail => sendFirstAccessEmail(mail, env)))({ to: data.email, url, expiresAt });
  } catch {
    const delivery = await input.client.rpc('admin_users_invite_delivery', {
      p_actor: input.actor, p_invite_id: data.id, p_status: 'failed',
    });
    if (delivery.error) fail(503, 'invite_delivery_uncertain', 'O envio falhou e o estado do convite precisa ser verificado.');
    fail(502, 'invite_send_failed', 'O convite foi gerado, mas o e-mail não pôde ser enviado.');
  }
  const delivery = await input.client.rpc('admin_users_invite_delivery', {
    p_actor: input.actor, p_invite_id: data.id, p_status: 'sent',
  });
  if (delivery.error || !delivery.data?.user) fail(503, 'invite_delivery_uncertain', 'O e-mail foi aceito, mas o estado do convite precisa ser verificado.');
  return { user: delivery.data.user, invite: { url, expiresAt, simulated: false, action: 'send' } };
}

/** The recipient needs only the one-use token; no existing session or email input. */
export async function consumeLiveInvite(input: ConsumeLiveInviteInput): Promise<{ success: true }> {
  const env = input.env ?? process.env;
  requireLiveWrites(env);
  if (typeof input.token !== 'string' || !tokenPattern.test(input.token) ||
      typeof input.password !== 'string' || input.password.length < 8 ||
      Buffer.byteLength(input.password, 'utf8') > 72 || input.password.includes('\0')) {
    fail(400, 'invalid_first_access', 'Link ou senha inválidos.');
  }
  const tokenHash = hashToken(input.token);
  const validated = await input.client.rpc('admin_users_validate_invite', { p_token_hash: tokenHash });
  if (validated.error) rpcError(validated.error);
  if (validated.data?.valid !== true) fail(400, 'invalid_invitation', 'Convite inválido ou expirado.');
  const passwordHash = await (input.hashPassword ?? (password => bcrypt.hash(password, 12)))(input.password);
  const { data, error } = await input.client.rpc('admin_users_consume_invite', {
    p_token_hash: tokenHash,
    p_password_hash: passwordHash,
  });
  if (error || !data?.success) rpcError(error);
  return { success: true };
}

/** Prepared transport. Called only after the separate real-email flag passes. */
export async function sendFirstAccessEmail(mail: FirstAccessMail, env: Environment = process.env): Promise<void> {
  requireAdminUsersEmail(env);
  const from = env.SMTP_FROM || env.SMTP_USER || '';
  const address = from.match(/^\s*(?:([^<>\r\n]{1,100})\s*)?<([^<>\s\r\n]+@[^<>\s\r\n]+)>\s*$/)?.[2] || from.trim();
  const name = from.includes('<') ? from.slice(0, from.indexOf('<')).trim().replace(/^"|"$/g, '') : 'Bússola IA';
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address) || /[\r\n]/.test(from) ||
      !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(mail.to)) {
    fail(503, 'invite_mail_config', 'Configuração de e-mail indisponível.');
  }
  const subject = 'Seu primeiro acesso à Bússola IA';
  const text = `Use este link para definir sua senha de primeiro acesso. Ele expira em uma hora e pode ser usado uma vez:\n\n${mail.url}\n\nSe você não esperava este convite, ignore esta mensagem.`;
  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
    const port = Number(env.SMTP_PORT || '587');
    if (Number.isInteger(port) && port > 0 && port <= 65535) {
      try {
        const transport = nodemailer.createTransport({
          host: env.SMTP_HOST, port, secure: env.SMTP_SECURE === 'true' || port === 465,
          auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
          connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
        });
        const result = await transport.sendMail({ from, to: mail.to, subject, text });
        if (result.accepted?.some((recipient: string) => recipient.toLowerCase() === mail.to.toLowerCase())) return;
      } catch { /* Try the configured Brevo fallback without logging the link. */ }
    }
  }
  if (env.BREVO_API_KEY) {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY },
      body: JSON.stringify({ sender: { email: address, name: name || 'Bússola IA' }, to: [{ email: mail.to }], subject, textContent: text, tags: ['first-access'] }),
      signal: AbortSignal.timeout(15000),
    });
    if (response.ok) return;
  }
  fail(502, 'invite_send_failed', 'O e-mail de primeiro acesso não pôde ser enviado.');
}

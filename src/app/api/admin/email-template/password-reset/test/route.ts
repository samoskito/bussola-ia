import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import * as jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  PASSWORD_RESET_DEFAULT_HTML,
  PASSWORD_RESET_DEFAULT_SUBJECT,
  PASSWORD_RESET_TEMPLATE_KEY,
  applyTemplateVariables,
  htmlToText,
  normalizeTemplateHtml,
  templateHasResetUrl,
} from '@/lib/email/password-reset-template';

export const runtime = 'nodejs';

type SessionToken = { userId: string };

function maskEmail(email: string) {
  const [local = '', domain = ''] = email.split('@');
  if (!domain) return '***';
  const start = local.slice(0, 2);
  return `${start}${'*'.repeat(Math.max(local.length - 2, 0))}@${domain}`;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getAppUrl(request: Request) {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return envUrl.replace(/\/$/, '');
  return new URL(request.url).origin;
}

function parseFromAddress(from: string) {
  const trimmed = String(from || '').trim();
  const match = trimmed.match(/^(.*)<(.+@.+)>$/);
  if (match) {
    return {
      name: match[1].trim().replace(/^"|"$/g, ''),
      email: match[2].trim(),
    };
  }
  return { name: process.env.BREVO_SENDER_NAME || 'Bussola IA', email: trimmed };
}

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (!host || !user || !pass || !from) {
    throw new Error('SMTP nao configurado. Defina SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS e SMTP_FROM.');
  }

  return { host, port, user, pass, from, secure };
}

function getBrevoApiConfig() {
  const apiKey = process.env.BREVO_API_KEY;
  const apiUrl = process.env.BREVO_API_URL || 'https://api.brevo.com/v3/smtp/email';
  if (!apiKey) return null;
  return { apiKey, apiUrl };
}

async function getBrevoLatestEvent(messageId: string) {
  const brevo = getBrevoApiConfig();
  if (!brevo || !messageId) return null;

  const eventsUrl = 'https://api.brevo.com/v3/smtp/statistics/events';
  const qs = new URLSearchParams({
    messageId,
    limit: '1',
    sort: 'desc',
  });

  try {
    const response = await fetch(`${eventsUrl}?${qs.toString()}`, {
      method: 'GET',
      headers: {
        'api-key': brevo.apiKey,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json().catch(() => null);
    const event = data?.events?.[0];
    if (!event) return null;

    return {
      event: event.event || null,
      date: event.date || null,
      reason: event.reason || null,
      from: event.from || null,
      messageId: event.messageId || messageId,
    };
  } catch {
    return null;
  }
}

async function sendWithBrevoApi(params: {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const brevo = getBrevoApiConfig();
  if (!brevo) {
    throw new Error('BREVO_API_KEY nao configurada para envio via API.');
  }

  const sender = parseFromAddress(params.from);
  const payload = {
    sender: {
      email: sender.email,
      name: sender.name,
    },
    to: [{ email: params.to }],
    subject: params.subject,
    htmlContent: params.html,
    textContent: params.text,
    tags: ['password-reset-test'],
  };

  const response = await fetch(brevo.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': brevo.apiKey,
    },
    body: JSON.stringify(payload),
  });

  const raw = await response.text();
  let parsed: any = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    throw new Error(
      `Brevo API falhou (${response.status}): ${
        parsed?.message || parsed?.code || raw || 'sem detalhes'
      }`
    );
  }

  return {
    messageId: parsed?.messageId || null,
    responseBody: parsed || raw || null,
  };
}

async function getAuthenticatedAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  if (!token) {
    return { error: NextResponse.json({ error: 'Nao autenticado' }, { status: 401 }) };
  }

  let decoded: SessionToken;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as SessionToken;
  } catch {
    return { error: NextResponse.json({ error: 'Token invalido' }, { status: 401 }) };
  }

  if (!decoded?.userId) {
    return { error: NextResponse.json({ error: 'Token invalido' }, { status: 401 }) };
  }

  const supabase = createServerSupabaseClient();
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, email, nivel')
    .eq('id', decoded.userId)
    .maybeSingle();

  if (userError || !user) {
    return { error: NextResponse.json({ error: 'Usuario nao encontrado' }, { status: 401 }) };
  }

  if (user.nivel !== 'admin') {
    return { error: NextResponse.json({ error: 'Acesso negado' }, { status: 403 }) };
  }

  return { supabase, user };
}

async function getStoredTemplate(supabase: ReturnType<typeof createServerSupabaseClient>) {
  const { data, error } = await supabase
    .from('email_templates')
    .select('subject, html_content')
    .eq('template_key', PASSWORD_RESET_TEMPLATE_KEY)
    .maybeSingle();

  if (error && (error as any).code !== '42P01') {
    throw new Error(`Erro ao carregar template: ${error.message}`);
  }

  return {
    subject: data?.subject || PASSWORD_RESET_DEFAULT_SUBJECT,
    html: normalizeTemplateHtml(data?.html_content || PASSWORD_RESET_DEFAULT_HTML),
  };
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedAdmin();
    if (auth.error) return auth.error;

    const { supabase } = auth;
    const body = await request.json();
    const toEmail = String(body?.toEmail || '').trim().toLowerCase();
    const overrideSubject = String(body?.subject || '').trim();
    const overrideHtml = String(body?.html || '').trim();

    if (!toEmail || !isValidEmail(toEmail)) {
      return NextResponse.json({ error: 'Informe um e-mail valido para teste.' }, { status: 400 });
    }

    const storedTemplate = await getStoredTemplate(supabase);
    const subject = overrideSubject || storedTemplate.subject;
    const html = normalizeTemplateHtml(overrideHtml || storedTemplate.html);

    if (!templateHasResetUrl(html)) {
      return NextResponse.json(
        { error: 'O template precisa conter o placeholder {{reset_url}}.' },
        { status: 400 }
      );
    }

    const appUrl = getAppUrl(request);
    const fakeToken = `TESTE-${Date.now()}`;
    const resetUrl = `${appUrl}/auth/update-password?token=${encodeURIComponent(fakeToken)}&email=${encodeURIComponent(toEmail)}`;
    const supportEmail = process.env.SMTP_FROM || process.env.SMTP_USER || 'suporte@bussolaexecutiva.com.br';
    const templateVars = {
      reset_url: resetUrl,
      email: toEmail,
      support_email: supportEmail,
      app_name: 'Bussola IA',
    };

    const finalSubject = applyTemplateVariables(subject, templateVars);
    const finalHtml = applyTemplateVariables(html, templateVars);
    const finalText = htmlToText(finalHtml);

    const hasBrevoApi = Boolean(getBrevoApiConfig());

    if (hasBrevoApi) {
      try {
        const apiFrom = process.env.SMTP_FROM || process.env.SMTP_USER || '';
        const info = await sendWithBrevoApi({
          from: apiFrom,
          to: toEmail,
          subject: finalSubject,
          text: finalText,
          html: finalHtml,
        });

        console.log('[ADMIN][EMAIL_TEMPLATE][TEST] E-mail de teste enviado via Brevo API.', {
          to: maskEmail(toEmail),
          messageId: info.messageId,
          responseBody: info.responseBody,
        });

        const latestEvent = info.messageId ? await getBrevoLatestEvent(info.messageId) : null;

        return NextResponse.json({
          success: true,
          channel: 'brevo_api',
          messageId: info.messageId,
          latestEvent,
        });
      } catch (apiError) {
        console.error('[ADMIN][EMAIL_TEMPLATE][TEST] Falha na Brevo API, tentando SMTP.', {
          to: maskEmail(toEmail),
          error: apiError instanceof Error ? apiError.message : apiError,
        });
      }
    }

    try {
      const smtp = getSmtpConfig();
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: {
          user: smtp.user,
          pass: smtp.pass,
        },
      });

      const info = await transporter.sendMail({
        from: smtp.from,
        to: toEmail,
        subject: finalSubject,
        text: finalText,
        html: finalHtml,
      });

      console.log('[ADMIN][EMAIL_TEMPLATE][TEST] E-mail de teste enviado via SMTP.', {
        to: maskEmail(toEmail),
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected,
        response: info.response,
      });

      const latestEvent = info.messageId ? await getBrevoLatestEvent(info.messageId) : null;

      return NextResponse.json({
        success: true,
        channel: 'smtp',
        messageId: info.messageId,
        latestEvent,
      });
    } catch (smtpError) {
      console.error('[ADMIN][EMAIL_TEMPLATE][TEST] Falha no SMTP.', {
        to: maskEmail(toEmail),
        error: smtpError instanceof Error ? smtpError.message : smtpError,
      });
      return NextResponse.json(
        { error: 'Falha ao enviar e-mail de teste via Brevo API e SMTP.' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[ADMIN][EMAIL_TEMPLATE][TEST] Erro inesperado:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

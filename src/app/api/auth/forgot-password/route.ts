import { NextResponse } from 'next/server';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { resolveAppUrl } from '@/lib/app-url';
import {
  PASSWORD_RESET_DEFAULT_HTML,
  PASSWORD_RESET_DEFAULT_SUBJECT,
  PASSWORD_RESET_TEMPLATE_KEY,
  applyTemplateVariables,
  htmlToText,
  normalizeTemplateHtml,
} from '@/lib/email/password-reset-template';

export const runtime = 'nodejs';

function maskEmail(email: string) {
  const [local = '', domain = ''] = email.split('@');
  if (!domain) return '***';
  const start = local.slice(0, 2);
  return `${start}${'*'.repeat(Math.max(local.length - 2, 0))}@${domain}`;
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

async function sendWithBrevoApi(params: {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const brevo = getBrevoApiConfig();
  if (!brevo) {
    throw new Error('BREVO_API_KEY nao configurada para fallback HTTP.');
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
    tags: ['password-reset'],
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

async function getPasswordResetTemplate(supabase: ReturnType<typeof createServerSupabaseClient>) {
  const { data, error } = await supabase
    .from('email_templates')
    .select('subject, html_content')
    .eq('template_key', PASSWORD_RESET_TEMPLATE_KEY)
    .maybeSingle();

  if (error) {
    if ((error as any).code !== '42P01') {
      console.error('[FORGOT_PASSWORD] Erro ao carregar template customizado:', error);
    }
    return {
      subject: PASSWORD_RESET_DEFAULT_SUBJECT,
      html: PASSWORD_RESET_DEFAULT_HTML,
    };
  }

  return {
    subject: data?.subject || PASSWORD_RESET_DEFAULT_SUBJECT,
    html: normalizeTemplateHtml(data?.html_content || PASSWORD_RESET_DEFAULT_HTML),
  };
}

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!normalizedEmail) {
      return NextResponse.json({ error: 'Email e obrigatorio' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();

    // Nao vazar existencia de usuario: resposta final sempre sera generica.
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .ilike('email', normalizedEmail)
      .maybeSingle();

    if (userError) {
      console.error('[FORGOT_PASSWORD] Erro ao buscar usuario:', userError);
      return NextResponse.json({ error: 'Erro ao processar solicitacao' }, { status: 500 });
    }

    if (!user) {
      console.log('[FORGOT_PASSWORD] Usuario nao encontrado para e-mail informado. Retornando resposta generica.', {
        email: maskEmail(normalizedEmail),
      });
      return NextResponse.json({
        success: true,
        message: 'Se o e-mail estiver cadastrado, voce recebera um link para redefinir sua senha.',
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hora

    // Invalida tokens anteriores ainda nao usados para este email.
    await supabase
      .from('password_reset_tokens')
      .update({ used_at: now.toISOString() })
      .eq('email', normalizedEmail)
      .is('used_at', null);

    const { error: tokenInsertError } = await supabase
      .from('password_reset_tokens')
      .insert({
        email: normalizedEmail,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
      });

    if (tokenInsertError) {
      console.error('[FORGOT_PASSWORD] Erro ao salvar token:', tokenInsertError);
      return NextResponse.json(
        { error: 'Erro ao salvar token de redefinicao. Verifique a tabela password_reset_tokens.' },
        { status: 500 }
      );
    }

    const appUrl = resolveAppUrl(request);
    const resetUrl = `${appUrl}/auth/update-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(normalizedEmail)}`;
    const supportEmail = process.env.SMTP_FROM || process.env.SMTP_USER || 'suporte@bussolaexecutiva.com.br';

    const customTemplate = await getPasswordResetTemplate(supabase);
    const templateVars = {
      reset_url: resetUrl,
      email: normalizedEmail,
      support_email: supportEmail,
      app_name: 'Bussola IA',
    };

    const finalHtml = applyTemplateVariables(customTemplate.html, templateVars);
    const finalText = htmlToText(finalHtml);
    const finalSubject = applyTemplateVariables(customTemplate.subject, templateVars);
    const normalizedSubject = finalSubject || PASSWORD_RESET_DEFAULT_SUBJECT;
    const normalizedText = finalText || `Use este link para redefinir sua senha:\n${resetUrl}`;

    let sent = false;
    const hasBrevoApi = Boolean(getBrevoApiConfig());

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
        to: normalizedEmail,
        subject: normalizedSubject,
        text: normalizedText,
        html: finalHtml,
      });
      sent = true;
      console.log('[FORGOT_PASSWORD] E-mail enviado via SMTP.', {
        email: maskEmail(normalizedEmail),
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected,
        response: info.response,
      });
    } catch (smtpError) {
      console.error('[FORGOT_PASSWORD] Falha no SMTP, tentando fallback Brevo API.', {
        email: maskEmail(normalizedEmail),
        error: smtpError instanceof Error ? smtpError.message : smtpError,
      });
    }

    if (!sent && hasBrevoApi) {
      try {
        const apiFrom = process.env.SMTP_FROM || process.env.SMTP_USER || '';
        const info = await sendWithBrevoApi({
          from: apiFrom,
          to: normalizedEmail,
          subject: normalizedSubject,
          text: normalizedText,
          html: finalHtml,
        });
        sent = true;
        console.log('[FORGOT_PASSWORD] E-mail enviado via Brevo API (fallback).', {
          email: maskEmail(normalizedEmail),
          messageId: info.messageId,
          responseBody: info.responseBody,
        });
      } catch (apiError) {
        console.error('[FORGOT_PASSWORD] Falha no fallback Brevo API.', {
          email: maskEmail(normalizedEmail),
          error: apiError instanceof Error ? apiError.message : apiError,
        });
      }
    }

    if (!sent) {
      return NextResponse.json(
        { error: 'Falha no envio de e-mail. Verifique SMTP/Brevo e tente novamente.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Se o e-mail estiver cadastrado, voce recebera um link para redefinir sua senha.',
    });
  } catch (error) {
    console.error('[FORGOT_PASSWORD] Erro inesperado:', error);
    return NextResponse.json({ error: 'Erro ao processar solicitacao' }, { status: 500 });
  }
}

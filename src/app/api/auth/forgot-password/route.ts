import { NextResponse } from 'next/server';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  PASSWORD_RESET_DEFAULT_HTML,
  PASSWORD_RESET_DEFAULT_SUBJECT,
  PASSWORD_RESET_TEMPLATE_KEY,
  applyTemplateVariables,
  htmlToText,
  normalizeTemplateHtml,
} from '@/lib/email/password-reset-template';

export const runtime = 'nodejs';

function getAppUrl(request: Request) {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return envUrl.replace(/\/$/, '');
  return new URL(request.url).origin;
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
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (userError) {
      console.error('[FORGOT_PASSWORD] Erro ao buscar usuario:', userError);
      return NextResponse.json({ error: 'Erro ao processar solicitacao' }, { status: 500 });
    }

    if (!user) {
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

    const appUrl = getAppUrl(request);
    const resetUrl = `${appUrl}/auth/update-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(normalizedEmail)}`;

    const customTemplate = await getPasswordResetTemplate(supabase);
    const templateVars = {
      reset_url: resetUrl,
      email: normalizedEmail,
      support_email: smtp.from,
      app_name: 'Bussola IA',
    };

    const finalHtml = applyTemplateVariables(customTemplate.html, templateVars);
    const finalText = htmlToText(finalHtml);
    const finalSubject = applyTemplateVariables(customTemplate.subject, templateVars);

    await transporter.sendMail({
      from: smtp.from,
      to: normalizedEmail,
      subject: finalSubject || PASSWORD_RESET_DEFAULT_SUBJECT,
      text: finalText || `Use este link para redefinir sua senha:\n${resetUrl}`,
      html: finalHtml,
    });

    return NextResponse.json({
      success: true,
      message: 'Se o e-mail estiver cadastrado, voce recebera um link para redefinir sua senha.',
    });
  } catch (error) {
    console.error('[FORGOT_PASSWORD] Erro inesperado:', error);
    return NextResponse.json({ error: 'Erro ao processar solicitacao' }, { status: 500 });
  }
}

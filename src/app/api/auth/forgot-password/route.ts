import { NextResponse } from 'next/server';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { createServerSupabaseClient } from '@/lib/supabase/server';

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
    throw new Error('SMTP não configurado. Defina SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS e SMTP_FROM.');
  }

  return { host, port, user, pass, from, secure };
}

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!normalizedEmail) {
      return NextResponse.json({ error: 'Email é obrigatório' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();

    // Não vazar existência de usuário: resposta final sempre será genérica.
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (userError) {
      console.error('[FORGOT_PASSWORD] Erro ao buscar usuário:', userError);
      return NextResponse.json({ error: 'Erro ao processar solicitação' }, { status: 500 });
    }

    if (!user) {
      return NextResponse.json({
        success: true,
        message: 'Se o e-mail estiver cadastrado, você receberá um link para redefinir sua senha.'
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hora

    // Invalida tokens anteriores ainda não usados para este email.
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
        expires_at: expiresAt.toISOString()
      });

    if (tokenInsertError) {
      console.error('[FORGOT_PASSWORD] Erro ao salvar token:', tokenInsertError);
      return NextResponse.json(
        { error: 'Erro ao salvar token de redefinição. Verifique a tabela password_reset_tokens.' },
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
        pass: smtp.pass
      }
    });

    const appUrl = getAppUrl(request);
    const resetUrl = `${appUrl}/auth/update-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(normalizedEmail)}`;

    await transporter.sendMail({
      from: smtp.from,
      to: normalizedEmail,
      subject: 'Redefinição de senha - Bússola IA',
      text: `Recebemos uma solicitação para redefinir sua senha.\n\nUse este link (válido por 1 hora):\n${resetUrl}\n\nSe você não solicitou, ignore este e-mail.`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2>Redefinição de senha</h2>
          <p>Recebemos uma solicitação para redefinir sua senha.</p>
          <p>
            <a href="${resetUrl}" style="background:#FF6B00;color:#fff;padding:10px 14px;border-radius:6px;text-decoration:none;">
              Redefinir senha
            </a>
          </p>
          <p>Ou copie e cole este link no navegador:</p>
          <p>${resetUrl}</p>
          <p>Este link expira em 1 hora.</p>
          <p>Se você não solicitou, ignore este e-mail.</p>
        </div>
      `
    });

    return NextResponse.json({
      success: true,
      message: 'Se o e-mail estiver cadastrado, você receberá um link para redefinir sua senha.'
    });
  } catch (error) {
    console.error('[FORGOT_PASSWORD] Erro inesperado:', error);
    return NextResponse.json({ error: 'Erro ao processar solicitação' }, { status: 500 });
  }
}


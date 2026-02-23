import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import * as jwt from 'jsonwebtoken';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  PASSWORD_RESET_DEFAULT_HTML,
  PASSWORD_RESET_DEFAULT_SUBJECT,
  PASSWORD_RESET_TEMPLATE_KEY,
  normalizeTemplateHtml,
  templateHasResetUrl,
} from '@/lib/email/password-reset-template';

export const runtime = 'nodejs';

type SessionToken = { userId: string };

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

export async function GET() {
  try {
    const auth = await getAuthenticatedAdmin();
    if (auth.error) return auth.error;

    const { supabase } = auth;
    const { data, error } = await supabase
      .from('email_templates')
      .select('subject, html_content, updated_at, updated_by')
      .eq('template_key', PASSWORD_RESET_TEMPLATE_KEY)
      .maybeSingle();

    if (error) {
      if ((error as any).code === '42P01') {
        return NextResponse.json(
          { error: 'Tabela email_templates nao encontrada. Execute o SQL de criacao.' },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: 'Erro ao buscar template' }, { status: 500 });
    }

    let updatedByEmail: string | null = null;
    if (data?.updated_by) {
      const { data: updatedByUser } = await supabase
        .from('users')
        .select('email')
        .eq('id', data.updated_by)
        .maybeSingle();
      updatedByEmail = updatedByUser?.email || null;
    }

    return NextResponse.json({
      subject: data?.subject || PASSWORD_RESET_DEFAULT_SUBJECT,
      html: normalizeTemplateHtml(data?.html_content || PASSWORD_RESET_DEFAULT_HTML),
      isDefault: !data,
      updatedAt: data?.updated_at || null,
      updatedByEmail,
      smtpFrom: process.env.SMTP_FROM || process.env.SMTP_USER || null,
    });
  } catch (error) {
    console.error('[ADMIN][EMAIL_TEMPLATE][GET] Erro:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await getAuthenticatedAdmin();
    if (auth.error) return auth.error;

    const { supabase, user } = auth;
    const body = await request.json();

    const subject = String(body?.subject || '').trim();
    const html = normalizeTemplateHtml(String(body?.html || ''));

    if (!subject) {
      return NextResponse.json({ error: 'Assunto e obrigatorio' }, { status: 400 });
    }
    if (subject.length > 180) {
      return NextResponse.json({ error: 'Assunto muito longo (max. 180)' }, { status: 400 });
    }
    if (!templateHasResetUrl(html)) {
      return NextResponse.json(
        { error: 'O template precisa conter o placeholder {{reset_url}}.' },
        { status: 400 }
      );
    }

    const payload = {
      template_key: PASSWORD_RESET_TEMPLATE_KEY,
      subject,
      html_content: html,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('email_templates')
      .upsert(payload, { onConflict: 'template_key' });

    if (error) {
      if ((error as any).code === '42P01') {
        return NextResponse.json(
          { error: 'Tabela email_templates nao encontrada. Execute o SQL de criacao.' },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: `Erro ao salvar template: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[ADMIN][EMAIL_TEMPLATE][PUT] Erro:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

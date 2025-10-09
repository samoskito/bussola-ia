import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import * as jwt from 'jsonwebtoken';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as { userId: string };
    if (!decoded?.userId) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });

    const form = await request.formData();
    const file = form.get('avatar') as File | null;
    if (!file) return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 });

    const supabase = createServerSupabaseClient();

    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const baseName = `${decoded.userId}-${Date.now()}.${ext}`;

    const primaryBucket = process.env.NEXT_PUBLIC_AVATAR_BUCKET || 'avatars';
    const fallbackBucket = 'app-resources';

    // Tentar no bucket 'avatars' primeiro
    let uploadBucket = primaryBucket;
    let uploadPath = `users/${baseName}`;

    let uploadError: any = null;
    let publicUrl: string | null = null;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const attemptUpload = async (bucket: string, path: string) => {
      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, buffer, {
          contentType: file.type || 'image/jpeg',
          upsert: true,
        });
      return error;
    };

    uploadError = await attemptUpload(uploadBucket, uploadPath);

    if (uploadError) {
      console.error(`[AVATAR][UPLOAD] erro no bucket ${uploadBucket}:`, uploadError?.message || uploadError);
      // Fallback: usar bucket 'app-resources' em uma pasta avatars/
      uploadBucket = fallbackBucket;
      uploadPath = `avatars/${baseName}`;
      uploadError = await attemptUpload(uploadBucket, uploadPath);
    }

    if (uploadError) {
      console.error('[AVATAR][UPLOAD] falha final:', uploadError?.message || uploadError);
      return NextResponse.json({ error: `Falha no upload: ${uploadError?.message || 'erro desconhecido'}` }, { status: 500 });
    }

    const { data: publicData, error: pubErr } = supabase.storage
      .from(uploadBucket)
      .getPublicUrl(uploadPath);

    publicUrl = publicData?.publicUrl || null;
    if (pubErr || !publicUrl) {
      console.error('[AVATAR][PUBLIC_URL] erro:', pubErr);
      return NextResponse.json({ error: 'Falha ao obter URL pública do arquivo' }, { status: 500 });
    }

    // Atualizar coluna avatar do usuário
    const { error: updateError } = await supabase
      .from('users')
      .update({ avatar: publicUrl })
      .eq('id', decoded.userId);

    if (updateError) {
      return NextResponse.json({ error: 'Erro ao salvar avatar' }, { status: 500 });
    }

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (err) {
    console.error('[AVATAR][POST] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

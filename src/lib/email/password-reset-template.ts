export const PASSWORD_RESET_TEMPLATE_KEY = 'password_reset';

export const PASSWORD_RESET_DEFAULT_SUBJECT = 'Redefinicao de senha - Bussola IA';

export const PASSWORD_RESET_DEFAULT_HTML = `
  <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
    <h2 style="margin-bottom: 8px;">Redefinicao de senha</h2>
    <p>Recebemos uma solicitacao para redefinir sua senha.</p>
    <p>
      <a href="{{reset_url}}" style="background:#FF6B00;color:#fff;padding:10px 14px;border-radius:6px;text-decoration:none;display:inline-block;">
        Redefinir senha
      </a>
    </p>
    <p>Ou copie e cole este link no navegador:</p>
    <p>{{reset_url}}</p>
    <p>Este link expira em 1 hora.</p>
    <p>Se voce nao solicitou, ignore este e-mail.</p>
    <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;" />
    <small style="color:#6b7280;">
      Enviado por {{app_name}} - suporte: {{support_email}}
    </small>
  </div>
`.trim();

export function applyTemplateVariables(
  template: string,
  variables: Record<string, string>
): string {
  let output = template;
  for (const [key, value] of Object.entries(variables)) {
    const safeValue = String(value ?? '');
    output = output.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), safeValue);
  }
  return output;
}

export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function normalizeTemplateHtml(html: string): string {
  const normalized = String(html || '').trim();
  return normalized || PASSWORD_RESET_DEFAULT_HTML;
}

export function templateHasResetUrl(html: string): boolean {
  return /{{\s*reset_url\s*}}/i.test(html);
}

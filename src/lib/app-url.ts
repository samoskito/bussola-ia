function trimTrailingSlash(value: string) {
  return value.replace(/\/$/, '');
}

function toAbsoluteUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimTrailingSlash(trimmed);
  return trimTrailingSlash(`https://${trimmed}`);
}

export function resolveAppUrl(request: Request) {
  // Prioridade para links de e-mail: variável dedicada > app geral > origem da request.
  const explicit =
    process.env.EMAIL_APP_URL ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL;

  const explicitUrl = explicit ? toAbsoluteUrl(explicit) : null;
  if (explicitUrl) return explicitUrl;

  const vercelUrl = toAbsoluteUrl(
    process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || ''
  );
  if (vercelUrl) return vercelUrl;

  return trimTrailingSlash(new URL(request.url).origin);
}

/** Database access dates are inclusive calendar dates in the business timezone. */
export function hasAccessDateExpired(value: string | null | undefined, now = new Date()): boolean {
  if (!value) return false;
  const date = value.slice(0, 10);
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return true;
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const today = ['year', 'month', 'day'].map(name => parts.find(part => part.type === name)!.value).join('-');
  return date < today;
}

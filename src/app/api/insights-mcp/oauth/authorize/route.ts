import { authorizeGet, authorizePost } from '@/lib/insights-mcp/oauth-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const GET=authorizeGet;
export const POST=authorizePost;

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Método não permitido. Use POST.' }), { status: 405, headers });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers });
    }

    const publicKey = Deno.env.get('VAPID_PUBLIC_KEY') || '';
    if (!publicKey) {
      return new Response(JSON.stringify({ success: false, error: 'VAPID_PUBLIC_KEY não configurado' }), { status: 500, headers });
    }

    return new Response(JSON.stringify({ success: true, publicKey }), { status: 200, headers });
  } catch (error) {
    const err = error as { message?: string };
    return new Response(JSON.stringify({ success: false, error: err.message || String(error) }), { status: 500, headers });
  }
});

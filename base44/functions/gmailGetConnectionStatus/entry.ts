import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

const GMAIL_CONNECTOR_ID = '6a14df6da76515d039e6833c';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Try to fetch Gmail profile — if it succeeds, user is connected
    try {
      const { accessToken } = await base44.asServiceRole.connectors.getCurrentAppUserConnection(GMAIL_CONNECTOR_ID);
      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!res.ok) {
        return Response.json({ connected: false });
      }
      const profile = await res.json();
      return Response.json({
        connected: true,
        email: profile.emailAddress,
        messagesTotal: profile.messagesTotal
      });
    } catch {
      return Response.json({ connected: false });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
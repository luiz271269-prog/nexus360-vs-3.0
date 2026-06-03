// Função leve: retorna apenas a chave pública VAPID (sem dependência de web-push)
Deno.serve(async () => {
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  if (!publicKey) {
    return Response.json({ success: false, error: 'VAPID_PUBLIC_KEY ausente' }, { status: 500 });
  }
  return Response.json({ success: true, publicKey });
});
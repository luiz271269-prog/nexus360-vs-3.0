// ============================================================================
// FUNÇÃO TEMPORÁRIA / DESCARTÁVEL — Sprint 2A do Wake-Up Interno Nexus360
// ----------------------------------------------------------------------------
// Objetivo: gerar 1 par VAPID (ECDSA P-256) DENTRO do backend, sem qualquer
// ferramenta externa, e retornar os valores APENAS na resposta HTTP para o
// admin copiar manualmente no painel de Secrets.
//
// REGRAS DE SEGURANÇA (obrigatórias por contrato):
//   1. Admin-only (user.role === 'admin')
//   2. NUNCA persistir a private_key em entidade
//   3. NUNCA registrar a private_key em AutomationLog
//   4. NUNCA console.log da private_key (apenas hashes/comprimentos)
//   5. Valores retornados SÓ na resposta direta da invocação manual
//   6. Após o admin salvar os secrets, esta função DEVE ser DELETADA
//
// Esta função NÃO chama nenhuma API externa. Usa apenas crypto.subtle do Deno.
// ============================================================================

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ---------- helpers de codificação base64url (sem dependências) ----------
function bytesToBase64Url(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    const b64 = btoa(binary);
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(b64url) {
    const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    const binary = atob(b64 + pad);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

Deno.serve(async (req) => {
    try {
        // ----------- Autenticação e autorização -----------
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (user.role !== 'admin') {
            return Response.json(
                { error: 'Forbidden: Admin access required' },
                { status: 403 }
            );
        }

        // ----------- Geração do par ECDSA P-256 (padrão VAPID) -----------
        const keyPair = await crypto.subtle.generateKey(
            { name: 'ECDSA', namedCurve: 'P-256' },
            true,
            ['sign', 'verify']
        );

        // Public key: formato "raw" (65 bytes: 0x04 + X32 + Y32) → base64url
        // Esse é EXATAMENTE o formato esperado pelo applicationServerKey do
        // PushManager.subscribe() e pela lib web-push no servidor.
        const rawPublic = new Uint8Array(
            await crypto.subtle.exportKey('raw', keyPair.publicKey)
        );
        const publicKeyB64Url = bytesToBase64Url(rawPublic);

        // Private key: exporta como JWK e pega APENAS o campo "d"
        // (escalar de 32 bytes em base64url) — formato esperado pela web-push.
        const jwkPrivate = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
        const privateKeyB64Url = jwkPrivate.d;

        if (!privateKeyB64Url || typeof privateKeyB64Url !== 'string') {
            return Response.json(
                { error: 'Falha ao exportar private key (campo d ausente no JWK)' },
                { status: 500 }
            );
        }

        // ----------- Validações básicas dos formatos -----------
        const publicValidaLen = rawPublic.byteLength === 65 && rawPublic[0] === 0x04;
        const privBytes = base64UrlToBytes(privateKeyB64Url);
        const privateValidaLen = privBytes.byteLength === 32;

        if (!publicValidaLen || !privateValidaLen) {
            return Response.json(
                {
                    error: 'Chaves geradas em formato inválido',
                    public_len: rawPublic.byteLength,
                    private_len: privBytes.byteLength
                },
                { status: 500 }
            );
        }

        // ----------- Logging seguro (SEM expor private key) -----------
        // Permitido: comprimento, prefixo da pública (não-sensível).
        // Proibido: qualquer fragmento da private_key.
        console.log('[gerarChavesVAPID] OK — par ECDSA P-256 gerado', {
            admin_id: user.id,
            admin_email: user.email,
            public_key_len: publicKeyB64Url.length,
            public_key_prefix: publicKeyB64Url.slice(0, 6) + '…',
            private_key_len: privateKeyB64Url.length
            // private_key_value: NUNCA logado
        });

        // ----------- Resposta APENAS para a invocação manual -----------
        // Os valores existem somente neste retorno. Nenhuma entidade é tocada.
        // O admin DEVE copiar e colar no painel de Secrets, e depois DELETAR
        // esta função.
        return Response.json({
            ok: true,
            instrucoes: [
                '1. Copie os 3 valores abaixo.',
                '2. Cole-os nos Secrets do app com os nomes EXATOS:',
                '   - VAPID_PUBLIC_KEY  ← valor de "public_key"',
                '   - VAPID_PRIVATE_KEY ← valor de "private_key"',
                '   - VAPID_SUBJECT     ← valor de "subject_sugerido"',
                '3. Confirme com o assistente que os secrets foram salvos.',
                '4. APAGUE esta função (functions/gerarChavesVAPID) — ela é descartável.'
            ],
            public_key: publicKeyB64Url,
            private_key: privateKeyB64Url,
            subject_sugerido: 'mailto:luiz271269@gmail.com',
            metadata: {
                algoritmo: 'ECDSA',
                curva: 'P-256',
                formato_publica: 'raw (65 bytes, 0x04 || X || Y) em base64url',
                formato_privada: 'JWK.d (32 bytes) em base64url',
                gerado_em: new Date().toISOString(),
                gerado_por_admin_id: user.id
            }
        });
    } catch (error) {
        console.error('[gerarChavesVAPID] ERRO:', error?.message || error);
        return Response.json(
            { error: error?.message || 'Erro interno' },
            { status: 500 }
        );
    }
});
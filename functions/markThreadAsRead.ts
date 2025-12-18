import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ============================================================================
// MARK THREAD AS READ - v1.0.0
// ============================================================================
// Marca thread como lida para o usuário autenticado
// Zera apenas o contador do usuário no unread_by (cirúrgico)
// ============================================================================

const VERSION = 'v1.0.0';

Deno.serve(async (req) => {
    const corsHeaders = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
        const base44 = createClientFromRequest(req);
        
        // 1. Autenticação
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
        }

        const { thread_id } = await req.json();

        if (!thread_id) {
            return Response.json({ 
                error: 'thread_id é obrigatório' 
            }, { status: 400, headers: corsHeaders });
        }

        // 2. Buscar thread
        const thread = await base44.asServiceRole.entities.MessageThread.get(thread_id);
        
        if (!thread) {
            return Response.json({ 
                error: 'Thread não encontrada' 
            }, { status: 404, headers: corsHeaders });
        }

        // 3. Validar participação (se for interna)
        if (thread.thread_type === 'team_internal') {
            if (!thread.participants || !thread.participants.includes(user.id)) {
                return Response.json({ 
                    error: 'Você não é participante desta conversa' 
                }, { status: 403, headers: corsHeaders });
            }
        }

        console.log(`[MARK-AS-READ] 👁️ Marcando thread ${thread_id} como lida para ${user.full_name}`);

        // 4. Lógica Cirúrgica: Mexe APENAS na chave do usuário
        const currentUnreads = thread.unread_by || {};
        
        if (currentUnreads[user.id] && currentUnreads[user.id] > 0) {
            const updatedUnreads = { ...currentUnreads };
            updatedUnreads[user.id] = 0; // Zera só o meu contador

            await base44.asServiceRole.entities.MessageThread.update(thread_id, {
                unread_by: updatedUnreads
            });

            console.log(`[MARK-AS-READ] ✅ Contador zerado para ${user.id}`);
        } else {
            console.log(`[MARK-AS-READ] ℹ️ Já estava zerado ou não existe contador`);
        }

        // Opcional: Marcar mensagens como lidas (para recibos de leitura em grupo)
        // Buscar mensagens não lidas recentes e adicionar user.id ao metadata.read_by
        // (Implementar se necessário para UX de "visto por")

        return Response.json({
            success: true,
            version: VERSION
        }, { headers: corsHeaders });

    } catch (error) {
        console.error('[MARK-AS-READ] ❌ Erro:', error.message);
        console.error('[MARK-AS-READ] Stack:', error.stack);
        
        return Response.json({
            error: error.message,
            version: VERSION
        }, { status: 500, headers: corsHeaders });
    }
});
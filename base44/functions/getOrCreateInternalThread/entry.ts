import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ============================================================================
// GET OR CREATE INTERNAL THREAD - v1.0.0
// ============================================================================
// Função cirúrgica que garante unicidade de threads 1:1 internas via pair_key
// Previne race conditions e otimiza busca para O(1)
// ============================================================================

const VERSION = 'v1.0.0';

// Helper para garantir a ordem determinística da chave (sempre minId:maxId)
function generatePairKey(id1, id2) {
    return [id1, id2].sort().join(':');
}

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

        const { target_user_id } = await req.json();
        
        // Validações
        if (!target_user_id) {
            return Response.json({ 
                error: 'target_user_id é obrigatório' 
            }, { status: 400, headers: corsHeaders });
        }

        if (target_user_id === user.id) {
            return Response.json({ 
                error: 'Não é possível criar conversa consigo mesmo' 
            }, { status: 400, headers: corsHeaders });
        }

        // 🛡️ GUARDRAIL: Bloquear IDs de service accounts que não existem no User
        if (target_user_id.startsWith('service_')) {
            console.error(`[GET-OR-CREATE-THREAD] 🚫 Tentativa de criar thread com service account inválido: ${target_user_id}`);
            return Response.json({ 
                error: 'Não é possível criar threads com service accounts. Use sector_group ou user_id válido.',
                invalid_target: target_user_id
            }, { status: 400, headers: corsHeaders });
        }

        // 2. Geração da Chave Única (O(1) lookup)
        const pairKey = generatePairKey(user.id, target_user_id);
        
        console.log(`[GET-OR-CREATE-THREAD] 🔑 Buscando/criando thread com pair_key: ${pairKey}`);

        try {
            // 3. Busca Otimizada (Index Scan em vez de JSON Scan)
            // Isso é milissegundos, mesmo com milhões de threads
            const existingThreads = await base44.asServiceRole.entities.MessageThread.filter({
                pair_key: pairKey,
                thread_type: 'team_internal'
            }, '-created_date', 1);

            if (existingThreads.length > 0) {
                console.log(`[GET-OR-CREATE-THREAD] ✅ Thread existente encontrada: ${existingThreads[0].id}`);
                return Response.json({ 
                    thread: existingThreads[0],
                    created: false,
                    version: VERSION
                }, { headers: corsHeaders });
            }

            // 4. Criação (Handshake)
            console.log(`[GET-OR-CREATE-THREAD] 🆕 Criando nova thread para ${pairKey}`);
            
            const targetUser = await base44.asServiceRole.entities.User.get(target_user_id);
            
            if (!targetUser) {
                return Response.json({ 
                    error: 'Usuário de destino não encontrado' 
                }, { status: 404, headers: corsHeaders });
            }

            // Inicializa unread_by zerado para ambos
            const initialUnreads = {};
            initialUnreads[user.id] = 0;
            initialUnreads[target_user_id] = 0;

            const newThread = await base44.asServiceRole.entities.MessageThread.create({
                thread_type: 'team_internal',
                pair_key: pairKey, // CRÍTICO: A chave mágica para O(1)
                participants: [user.id, target_user_id],
                is_group_chat: false,
                group_chat: false,
                unread_by: initialUnreads,
                total_mensagens: 0,
                last_message_at: new Date().toISOString(),
                status: 'aberta',
                channel: 'interno'
            });

            console.log(`[GET-OR-CREATE-THREAD] ✅ Thread criada: ${newThread.id}`);

            return Response.json({ 
                thread: newThread,
                created: true,
                version: VERSION
            }, { headers: corsHeaders });

        } catch (createError) {
            // Tratamento de Race Condition
            // Se falhar na criação por duplicidade (outro request criou primeiro)
            console.warn(`[GET-OR-CREATE-THREAD] ⚠️ Possível race condition: ${createError.message}`);
            
            // Tenta buscar novamente
            const retryThreads = await base44.asServiceRole.entities.MessageThread.filter({
                pair_key: pairKey,
                thread_type: 'team_internal'
            }, '-created_date', 1);
            
            if (retryThreads.length > 0) {
                console.log(`[GET-OR-CREATE-THREAD] ✅ Thread encontrada no retry: ${retryThreads[0].id}`);
                return Response.json({ 
                    thread: retryThreads[0],
                    created: false,
                    version: VERSION
                }, { headers: corsHeaders });
            }

            // Se ainda assim não encontrar, é erro real
            throw createError;
        }

    } catch (error) {
        console.error('[GET-OR-CREATE-THREAD] ❌ Erro:', error.message);
        console.error('[GET-OR-CREATE-THREAD] Stack:', error.stack);
        
        return Response.json({
            error: error.message,
            version: VERSION
        }, { status: 500, headers: corsHeaders });
    }
});
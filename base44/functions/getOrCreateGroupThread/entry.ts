import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ============================================================================
// GET OR CREATE GROUP THREAD - v1.0.0
// ============================================================================
// Cria ou retorna thread de grupo customizado
// Sincroniza automaticamente os participantes (membros do grupo)
// ============================================================================

const VERSION = 'v1.0.0';

function generateGroupKey(groupId) {
    return 'group:' + String(groupId).toLowerCase().trim();
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

        const { group_id, group_name, members } = await req.json();
        
        // Validações
        if (!group_id) {
            return Response.json({ 
                error: 'group_id é obrigatório' 
            }, { status: 400, headers: corsHeaders });
        }

        if (!members || !Array.isArray(members) || members.length === 0) {
            return Response.json({ 
                error: 'members deve ser um array não-vazio' 
            }, { status: 400, headers: corsHeaders });
        }

        console.log(`[GET-OR-CREATE-GROUP] 👥 Processando grupo: ${group_id} com ${members.length} membros`);

        // 2. Gerar chave única do grupo
        const groupKey = generateGroupKey(group_id);
        const participantIds = members.sort();

        try {
            // 3. Buscar thread existente
            const existingThreads = await base44.asServiceRole.entities.MessageThread.filter({
                group_key: groupKey,
                thread_type: 'team_internal'
            }, '-created_date', 1);

            if (existingThreads.length > 0) {
                const thread = existingThreads[0];
                console.log(`[GET-OR-CREATE-GROUP] ✅ Thread existente encontrada: ${thread.id}`);

                // 4. Sincronizar participantes (adiciona novos, mantém existentes)
                const currentParticipants = thread.participants || [];
                const needsUpdate = participantIds.some(id => !currentParticipants.includes(id)) ||
                                   currentParticipants.some(id => !participantIds.includes(id));

                if (needsUpdate) {
                    console.log(`[GET-OR-CREATE-GROUP] 🔄 Sincronizando participantes...`);
                    
                    // Atualiza unread_by para incluir novos membros
                    const currentUnreads = thread.unread_by || {};
                    participantIds.forEach(uid => {
                        if (!(uid in currentUnreads)) {
                            currentUnreads[uid] = 0;
                        }
                    });

                    await base44.asServiceRole.entities.MessageThread.update(thread.id, {
                        participants: participantIds,
                        unread_by: currentUnreads,
                        group_name: group_name || thread.group_name
                    });
                    
                    console.log(`[GET-OR-CREATE-GROUP] ✅ Participantes atualizados`);
                }

                return Response.json({ 
                    thread,
                    created: false,
                    synchronized: needsUpdate,
                    version: VERSION
                }, { headers: corsHeaders });
            }

            // 5. Criar nova thread de grupo
            console.log(`[GET-OR-CREATE-GROUP] 🆕 Criando nova thread para grupo ${group_id}`);
            
            // Inicializa unread_by zerado para todos
            const initialUnreads = {};
            participantIds.forEach(uid => {
                initialUnreads[uid] = 0;
            });

            const newThread = await base44.asServiceRole.entities.MessageThread.create({
                thread_type: 'team_internal',
                group_key: groupKey,
                participants: participantIds,
                is_group_chat: true,
                group_chat: true,
                group_name: group_name || `Grupo ${group_id}`,
                unread_by: initialUnreads,
                total_mensagens: 0,
                last_message_at: new Date().toISOString(),
                status: 'aberta',
                channel: 'interno'
            });

            console.log(`[GET-OR-CREATE-GROUP] ✅ Thread criada: ${newThread.id}`);

            return Response.json({ 
                thread: newThread,
                created: true,
                synchronized: false,
                version: VERSION
            }, { headers: corsHeaders });

        } catch (createError) {
            // Tratamento de Race Condition
            console.warn(`[GET-OR-CREATE-GROUP] ⚠️ Possível race condition: ${createError.message}`);
            
            // Tenta buscar novamente
            const retryThreads = await base44.asServiceRole.entities.MessageThread.filter({
                group_key: groupKey,
                thread_type: 'team_internal'
            }, '-created_date', 1);
            
            if (retryThreads.length > 0) {
                console.log(`[GET-OR-CREATE-GROUP] ✅ Thread encontrada no retry: ${retryThreads[0].id}`);
                return Response.json({ 
                    thread: retryThreads[0],
                    created: false,
                    synchronized: false,
                    version: VERSION
                }, { headers: corsHeaders });
            }

            // Se ainda assim não encontrar, é erro real
            throw createError;
        }

    } catch (error) {
        console.error('[GET-OR-CREATE-GROUP] ❌ Erro:', error.message);
        console.error('[GET-OR-CREATE-GROUP] Stack:', error.stack);
        
        return Response.json({
            error: error.message,
            version: VERSION
        }, { status: 500, headers: corsHeaders });
    }
});
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ============================================================================
// GET OR CREATE SECTOR THREAD - v1.0.0
// ============================================================================
// Cria ou retorna thread de grupo para um setor específico
// Sincroniza automaticamente os participantes baseado em User.sector
// ============================================================================

const VERSION = 'v1.0.0';

function generateSectorKey(sectorName) {
    // Normaliza o nome do setor para criar chave única
    return 'sector:' + String(sectorName).toLowerCase().trim().replace(/\s+/g, '_');
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

        const { sector_name } = await req.json();
        
        // Validações
        if (!sector_name) {
            return Response.json({ 
                error: 'sector_name é obrigatório' 
            }, { status: 400, headers: corsHeaders });
        }

        console.log(`[GET-OR-CREATE-SECTOR] 🏢 Processando setor: ${sector_name} para ${user.full_name}`);

        // 2. Buscar todos os usuários do setor
        const usersInSector = await base44.asServiceRole.entities.User.filter({
            attendant_sector: sector_name
        });

        if (usersInSector.length === 0) {
            return Response.json({ 
                error: 'Nenhum usuário encontrado neste setor',
                sector_name 
            }, { status: 404, headers: corsHeaders });
        }

        console.log(`[GET-OR-CREATE-SECTOR] 👥 ${usersInSector.length} usuários no setor ${sector_name}`);

        // 3. Gerar chave única do setor
        const sectorKey = generateSectorKey(sector_name);
        const participantIds = usersInSector.map(u => u.id).sort();

        try {
            // 4. Buscar thread existente
            const existingThreads = await base44.asServiceRole.entities.MessageThread.filter({
                sector_key: sectorKey,
                thread_type: 'sector_group'
            }, '-created_date', 1);

            if (existingThreads.length > 0) {
                const thread = existingThreads[0];
                console.log(`[GET-OR-CREATE-SECTOR] ✅ Thread existente encontrada: ${thread.id}`);

                // 5. Sincronizar participantes (adiciona novos, mantém existentes)
                const currentParticipants = thread.participants || [];
                const needsUpdate = participantIds.some(id => !currentParticipants.includes(id)) ||
                                   currentParticipants.some(id => !participantIds.includes(id));

                if (needsUpdate) {
                    console.log(`[GET-OR-CREATE-SECTOR] 🔄 Sincronizando participantes...`);
                    
                    // Atualiza unread_by para incluir novos membros
                    const currentUnreads = thread.unread_by || {};
                    participantIds.forEach(uid => {
                        if (!(uid in currentUnreads)) {
                            currentUnreads[uid] = 0;
                        }
                    });

                    await base44.asServiceRole.entities.MessageThread.update(thread.id, {
                        participants: participantIds,
                        unread_by: currentUnreads
                    });
                    
                    console.log(`[GET-OR-CREATE-SECTOR] ✅ Participantes atualizados`);
                }

                return Response.json({ 
                    thread,
                    created: false,
                    synchronized: needsUpdate,
                    version: VERSION
                }, { headers: corsHeaders });
            }

            // 6. Criar nova thread de setor
            console.log(`[GET-OR-CREATE-SECTOR] 🆕 Criando nova thread para setor ${sector_name}`);
            
            // Inicializa unread_by zerado para todos
            const initialUnreads = {};
            participantIds.forEach(uid => {
                initialUnreads[uid] = 0;
            });

            const newThread = await base44.asServiceRole.entities.MessageThread.create({
                thread_type: 'sector_group',
                sector_key: sectorKey,
                participants: participantIds,
                is_group_chat: true,
                group_name: `Setor ${sector_name}`,
                unread_by: initialUnreads,
                last_message_at: new Date().toISOString(),
                status: 'aberta'
            });

            console.log(`[GET-OR-CREATE-SECTOR] ✅ Thread criada: ${newThread.id}`);

            return Response.json({ 
                thread: newThread,
                created: true,
                synchronized: false,
                version: VERSION
            }, { headers: corsHeaders });

        } catch (createError) {
            // Tratamento de Race Condition
            console.warn(`[GET-OR-CREATE-SECTOR] ⚠️ Possível race condition: ${createError.message}`);
            
            // Tenta buscar novamente
            const retryThreads = await base44.asServiceRole.entities.MessageThread.filter({
                sector_key: sectorKey,
                thread_type: 'sector_group'
            }, '-created_date', 1);
            
            if (retryThreads.length > 0) {
                console.log(`[GET-OR-CREATE-SECTOR] ✅ Thread encontrada no retry: ${retryThreads[0].id}`);
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
        console.error('[GET-OR-CREATE-SECTOR] ❌ Erro:', error.message);
        console.error('[GET-OR-CREATE-SECTOR] Stack:', error.stack);
        
        return Response.json({
            error: error.message,
            version: VERSION
        }, { status: 500, headers: corsHeaders });
    }
});
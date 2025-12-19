import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ============================================================================
// SEND INTERNAL MESSAGE - v1.0.0
// ============================================================================
// Envia mensagens no chat interno entre usuários
// Atualiza unread_by de forma isolada e eficiente
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

        const payload = await req.json();
        console.log('[SEND-INTERNAL-MSG] 📥 Payload completo:', JSON.stringify(payload, null, 2));

        const { 
            thread_id, 
            content,
            media_type = 'none',
            media_url,
            media_caption,
            reply_to_message_id
        } = payload;

        // Validações - content OU media_url devem existir
        if (!thread_id) {
            console.error('[SEND-INTERNAL-MSG] ❌ thread_id ausente');
            return Response.json({ 
                error: 'thread_id é obrigatório' 
            }, { status: 400, headers: corsHeaders });
        }
        
        if (!content && !media_url) {
            console.error('[SEND-INTERNAL-MSG] ❌ Nem content nem media_url fornecidos');
            return Response.json({ 
                error: 'content ou media_url são obrigatórios' 
            }, { status: 400, headers: corsHeaders });
        }

        console.log(`[SEND-INTERNAL-MSG] ✅ Validações OK | Content: ${!!content} | Media: ${!!media_url} | Type: ${media_type}`);

        // 2. Buscar e validar thread
        const thread = await base44.asServiceRole.entities.MessageThread.get(thread_id);
        
        if (!thread) {
            return Response.json({ 
                error: 'Thread não encontrada' 
            }, { status: 404, headers: corsHeaders });
        }

        // ✅ Aceitar tanto team_internal quanto sector_group
        if (thread.thread_type !== 'team_internal' && thread.thread_type !== 'sector_group') {
            console.error(`[SEND-INTERNAL-MSG] ❌ Thread type inválido: ${thread.thread_type}`);
            return Response.json({ 
                error: `Esta thread não é interna. Tipo: ${thread.thread_type}` 
            }, { status: 400, headers: corsHeaders });
        }

        console.log(`[SEND-INTERNAL-MSG] 🧵 Thread tipo: ${thread.thread_type} | Participantes: ${thread.participants?.length || 0}`);

        // 3. Validar participação
        if (!thread.participants || !thread.participants.includes(user.id)) {
            console.error(`[SEND-INTERNAL-MSG] ❌ Usuário ${user.id} não é participante. Participantes:`, thread.participants);
            return Response.json({ 
                error: 'Você não é participante desta conversa' 
            }, { status: 403, headers: corsHeaders });
        }

        console.log(`[SEND-INTERNAL-MSG] 💬 Enviando mensagem na thread ${thread_id} por ${user.full_name}`);

        // 4. Criar mensagem
        // ✅ LÓGICA CIRÚRGICA: Conteúdo padrão baseado em mídia (igual Z-API)
        let contentFinal = content || '';
        
        if (!contentFinal && media_type !== 'none') {
            const tipoMap = {
                'image': '[Imagem]',
                'video': '[Vídeo]',
                'audio': '[Áudio]',
                'document': '[Documento]',
                'sticker': '[Sticker]',
                'location': '[Localização]',
                'contact': '[Contato]'
            };
            contentFinal = tipoMap[media_type] || '[Mídia]';
        }
        
        // ✅ GARANTIR sent_at preenchido (CRÍTICO para ordenação)
        const agora = new Date().toISOString();

        const messageData = {
            thread_id: thread.id,
            sender_id: user.id,
            sender_type: 'user',
            recipient_id: null, // Interno não tem destinatário único
            recipient_type: null,
            content: contentFinal,
            media_type: media_type,
            media_url: media_url || null,
            media_caption: media_caption || null,
            channel: 'interno',
            provider: 'internal_system',
            visibility: 'internal_only',
            status: 'enviada', // Mensagens internas são "enviadas" instantaneamente
            sent_at: agora, // ✅ CRÍTICO: timestamp para ordenação
            metadata: {
                user_name: user.full_name,
                whatsapp_integration_id: null,
                read_by: [user.id] // Remetente já leu
            }
        };

        if (reply_to_message_id) {
            messageData.reply_to_message_id = reply_to_message_id;
        }

        console.log('[SEND-INTERNAL-MSG] 📝 Criando mensagem com dados:', JSON.stringify(messageData, null, 2));

        const savedMessage = await base44.asServiceRole.entities.Message.create(messageData);

        console.log(`[SEND-INTERNAL-MSG] ✅ Mensagem criada: ${savedMessage.id} | Tipo: ${media_type} | Content: ${contentFinal.substring(0, 50)} | Media URL: ${media_url?.substring(0, 60)}`);

        // ✅ LOG: Validar participants completo
        if (!thread.participants || thread.participants.length === 0) {
            console.warn('[SEND-INTERNAL-MSG] ⚠️ Thread sem participants! Thread:', thread.id);
        } else {
            console.log(`[SEND-INTERNAL-MSG] 👥 Participants (${thread.participants.length}):`, thread.participants);
        }

        // 5. Atualizar unread_by (Lógica Isolada por Usuário)
        // Recuperar o objeto unread_by atual da thread
        let currentUnreads = thread.unread_by || {};

        // Zerar para quem enviou (eu acabei de ler o que escrevi)
        currentUnreads[user.id] = 0;

        // Incrementar para TODOS os outros participantes
        thread.participants.forEach(participantId => {
            if (participantId !== user.id) {
                currentUnreads[participantId] = (currentUnreads[participantId] || 0) + 1;
            }
        });

        // 6. Atualização Atômica da Thread
        // ✅ LÓGICA CIRÚRGICA: Preview de conteúdo baseado em mídia (igual Z-API)
        let previewContent = content ? content.substring(0, 200) : '';
        
        if (!previewContent && media_type !== 'none') {
            const previewMap = {
                'image': '📷 Imagem',
                'video': '🎥 Vídeo',
                'audio': '🎤 Áudio',
                'document': '📄 Documento',
                'sticker': '🎨 Sticker',
                'location': '📍 Localização',
                'contact': '👤 Contato'
            };
            previewContent = previewMap[media_type] || '📎 Mídia';
        }
        
        const threadUpdate = {
            last_message_at: savedMessage.sent_at,
            last_message_content: previewContent,
            last_message_sender: 'user',
            last_message_sender_name: user.full_name,
            last_media_type: media_type,
            unread_by: currentUnreads,
            total_mensagens: (thread.total_mensagens || 0) + 1
        };

        console.log(`[SEND-INTERNAL-MSG] 🔄 Atualizando thread com:`, JSON.stringify(threadUpdate, null, 2));

        await base44.asServiceRole.entities.MessageThread.update(thread.id, threadUpdate);

        console.log(`[SEND-INTERNAL-MSG] ✅ Thread atualizada | Preview: ${previewContent} | Unreads:`, JSON.stringify(currentUnreads));

        // Base44 dispara evento realtime automaticamente para os participantes

        return Response.json({
            success: true,
            message: savedMessage,
            version: VERSION
        }, { headers: corsHeaders });

    } catch (error) {
        console.error('[SEND-INTERNAL-MSG] ❌ Erro:', error.message);
        console.error('[SEND-INTERNAL-MSG] Stack:', error.stack);
        
        return Response.json({
            error: error.message,
            version: VERSION
        }, { status: 500, headers: corsHeaders });
    }
});
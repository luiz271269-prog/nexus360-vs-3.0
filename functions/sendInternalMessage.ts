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

        const { 
            thread_id, 
            content,
            media_type = 'none',
            media_url,
            media_caption,
            reply_to_message_id
        } = await req.json();

        // Validações - content OU media_url devem existir
        if (!thread_id) {
            return Response.json({ 
                error: 'thread_id é obrigatório' 
            }, { status: 400, headers: corsHeaders });
        }
        
        if (!content && !media_url) {
            return Response.json({ 
                error: 'content ou media_url são obrigatórios' 
            }, { status: 400, headers: corsHeaders });
        }

        // 2. Buscar e validar thread
        const thread = await base44.asServiceRole.entities.MessageThread.get(thread_id);
        
        if (!thread) {
            return Response.json({ 
                error: 'Thread não encontrada' 
            }, { status: 404, headers: corsHeaders });
        }

        if (thread.thread_type !== 'team_internal') {
            return Response.json({ 
                error: 'Esta thread não é interna. Use o fluxo apropriado.' 
            }, { status: 400, headers: corsHeaders });
        }

        // 3. Validar participação
        if (!thread.participants || !thread.participants.includes(user.id)) {
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
        
        const messageData = {
            thread_id: thread.id,
            sender_id: user.id,
            sender_type: 'user',
            content: contentFinal,
            media_type: media_type,
            media_url: media_url || null,
            media_caption: media_caption || null,
            channel: 'interno',
            provider: 'internal_system',
            visibility: 'internal_only',
            status: 'enviada', // Mensagens internas são "enviadas" instantaneamente
            sent_at: new Date().toISOString(),
            metadata: {
                user_name: user.full_name
            }
        };

        if (reply_to_message_id) {
            messageData.reply_to_message_id = reply_to_message_id;
        }

        const savedMessage = await base44.asServiceRole.entities.Message.create(messageData);

        console.log(`[SEND-INTERNAL-MSG] ✅ Mensagem criada: ${savedMessage.id} | Tipo: ${media_type}`);

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
        
        await base44.asServiceRole.entities.MessageThread.update(thread.id, {
            last_message_at: savedMessage.sent_at,
            last_message_content: previewContent,
            last_message_sender: 'user',
            last_message_sender_name: user.full_name,
            last_media_type: media_type,
            unread_by: currentUnreads,
            total_mensagens: (thread.total_mensagens || 0) + 1
        });

        console.log(`[SEND-INTERNAL-MSG] ✅ Thread atualizada | Preview: ${previewContent} | Unreads:`, currentUnreads);

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
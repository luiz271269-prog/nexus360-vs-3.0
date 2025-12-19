import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

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
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
        }

        const payload = await req.json();
        const { 
            thread_id, 
            content,
            media_type = 'none',
            media_url,
            media_caption,
            reply_to_message_id
        } = payload;

        if (!thread_id) {
            return Response.json({ error: 'thread_id obrigatorio' }, { status: 400, headers: corsHeaders });
        }
        
        if (!content && !media_url) {
            return Response.json({ error: 'content ou media_url obrigatorio' }, { status: 400, headers: corsHeaders });
        }

        const thread = await base44.asServiceRole.entities.MessageThread.get(thread_id);
        
        if (!thread) {
            return Response.json({ error: 'Thread nao encontrada' }, { status: 404, headers: corsHeaders });
        }

        if (thread.thread_type !== 'team_internal' && thread.thread_type !== 'sector_group') {
            return Response.json({ error: 'Thread nao eh interna' }, { status: 400, headers: corsHeaders });
        }

        if (!thread.participants || !thread.participants.includes(user.id)) {
            return Response.json({ error: 'Usuario nao eh participante' }, { status: 403, headers: corsHeaders });
        }

        let contentFinal = content || '';
        
        if (!contentFinal && media_type !== 'none') {
            const tipoMap = {
                'image': '[Imagem]',
                'video': '[Video]',
                'audio': '[Audio]',
                'document': '[Documento]',
                'sticker': '[Sticker]',
                'location': '[Localizacao]',
                'contact': '[Contato]'
            };
            contentFinal = tipoMap[media_type] || '[Midia]';
        }
        
        const agora = new Date().toISOString();

        const messageData = {
            thread_id: thread.id,
            sender_id: user.id,
            sender_type: 'user',
            recipient_id: null,
            recipient_type: null,
            content: contentFinal,
            media_type: media_type,
            media_url: media_url || null,
            media_caption: media_caption || null,
            channel: 'interno',
            provider: 'internal_system',
            visibility: 'internal_only',
            status: 'enviada',
            sent_at: agora,
            metadata: {
                user_name: user.full_name,
                whatsapp_integration_id: null,
                read_by: [user.id]
            }
        };

        if (reply_to_message_id) {
            messageData.reply_to_message_id = reply_to_message_id;
        }

        const savedMessage = await base44.asServiceRole.entities.Message.create(messageData);

        let currentUnreads = thread.unread_by || {};
        currentUnreads[user.id] = 0;

        thread.participants.forEach(participantId => {
            if (participantId !== user.id) {
                currentUnreads[participantId] = (currentUnreads[participantId] || 0) + 1;
            }
        });

        let previewContent = content ? content.substring(0, 200) : '';
        
        if (!previewContent && media_type !== 'none') {
            const previewMap = {
                'image': 'Imagem',
                'video': 'Video',
                'audio': 'Audio',
                'document': 'Documento',
                'sticker': 'Sticker',
                'location': 'Localizacao',
                'contact': 'Contato'
            };
            previewContent = previewMap[media_type] || 'Midia';
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

        await base44.asServiceRole.entities.MessageThread.update(thread.id, threadUpdate);

        return Response.json({
            success: true,
            message: savedMessage,
            version: VERSION
        }, { headers: corsHeaders });

    } catch (error) {
        console.error('[SEND-INTERNAL-MSG] Erro:', error.message, error.stack);
        
        return Response.json({
            error: error.message || 'Erro interno',
            version: VERSION
        }, { status: 500, headers: corsHeaders });
    }
});
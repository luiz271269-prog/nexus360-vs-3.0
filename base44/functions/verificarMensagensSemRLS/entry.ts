import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * 🔍 Função de Diagnóstico Definitivo de RLS
 * 
 * Objetivo: Ler a tabela 'Message' usando a Service Role para ignorar
 * completamente as políticas de RLS e verificar se as mensagens de 
 * sender_type = 'contact' existem no banco para uma dada thread.
 */
Deno.serve(async (req) => {
    // 1. Criar cliente e extrair payload
    const base44 = createClientFromRequest(req);
    const { thread_id } = await req.json();

    if (!thread_id) {
        return new Response(JSON.stringify({ success: false, error: 'thread_id é obrigatório' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    
    try {
        // 2. Usar asServiceRole para bypassar RLS
        console.log(`[DIAGNÓSTICO_RLS] Buscando mensagens para thread ${thread_id} com Service Role...`);
        const mensagens = await base44.asServiceRole.entities.Message.filter(
            { thread_id: thread_id },
            '-created_date',
            200
        );

        const totalMensagens = mensagens.length;
        const mensagensContato = mensagens.filter(m => m.sender_type === 'contact').length;
        const mensagensUsuario = mensagens.filter(m => m.sender_type === 'user').length;
        
        console.log(`[DIAGNÓSTICO_RLS] Thread ${thread_id}: Total: ${totalMensagens} | Contato: ${mensagensContato} | Usuário: ${mensagensUsuario}`);

        // 3. Retornar os resultados
        return new Response(JSON.stringify({
            success: true,
            thread_id: thread_id,
            total_mensagens: totalMensagens,
            mensagens_contato: mensagensContato,
            mensagens_usuario: mensagensUsuario,
            amostra_mensagens_contato: mensagens.filter(m => m.sender_type === 'contact').slice(0, 5).map(m => ({ id: m.id, content: m.content, created_date: m.created_date }))
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
        console.error(`[DIAGNÓSTICO_RLS] Erro ao buscar mensagens para thread ${thread_id}:`, error.message);
        return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
});
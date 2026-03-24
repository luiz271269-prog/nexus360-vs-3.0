// Auto-Enriquecimento: Preenche telefone faltante buscando em mensagens
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function extrairTelefone(texto) {
  if (!texto) return null;
  // Busca padrão: +55 seguido de 10-11 dígitos ou variações
  const matches = texto.match(/(\+?55\s?)?(\d{2})\s?(\d{4,5})-?(\d{4})/g);
  if (matches && matches.length > 0) {
    const num = matches[0].replace(/\s|-/g, '');
    return num.startsWith('+') ? num : '+' + num;
  }
  return null;
}

Deno.serve(async (req) => {
  const headers = { 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403, headers });
    }

    // Buscar contatos sem telefone
    const contatosSemTel = await base44.asServiceRole.entities.Contact.filter(
      { $or: [{ telefone: null }, { telefone: '' }] },
      '-updated_date',
      100
    );

    if (!contatosSemTel || contatosSemTel.length === 0) {
      return Response.json({ success: true, message: 'Nenhum contato sem telefone', count: 0 }, { headers });
    }

    const enriquecidos = [];
    const erros = [];

    for (const contato of contatosSemTel) {
      try {
        // Buscar threads do contato
        const threads = await base44.asServiceRole.entities.MessageThread.filter(
          { contact_id: contato.id },
          '-created_date',
          5
        );

        if (!threads || threads.length === 0) continue;

        // Buscar mensagens — priorizar as mais recentes
        const mensagens = await base44.asServiceRole.entities.Message.filter(
          { thread_id: threads[0].id },
          '-created_date',
          50
        );

        let telefonePerdido = null;
        
        // Procurar telefone nas mensagens (começar pelas mais recentes)
        for (const msg of (mensagens || [])) {
          const tel = extrairTelefone(msg.content);
          if (tel) {
            telefonePerdido = tel;
            break;
          }
        }

        // Se achou, atualizar contato
        if (telefonePerdido) {
          await base44.asServiceRole.entities.Contact.update(contato.id, {
            telefone: telefonePerdido,
            tipo_contato: contato.tipo_contato || 'novo',
            ultima_interacao: new Date().toISOString()
          });

          enriquecidos.push({
            id: contato.id,
            nome: contato.nome || 'Sem Nome',
            telefone_recuperado: telefonePerdido,
            mensagens_analisadas: mensagens?.length || 0
          });
        } else {
          erros.push({
            id: contato.id,
            nome: contato.nome || 'Sem Nome',
            motivo: 'Nenhum telefone encontrado nas mensagens'
          });
        }
      } catch (err) {
        erros.push({
          id: contato.id,
          nome: contato.nome || 'Sem Nome',
          motivo: err.message
        });
      }
    }

    return Response.json({
      success: true,
      enriquecidos_count: enriquecidos.length,
      erros_count: erros.length,
      enriquecidos,
      erros,
      timestamp: new Date().toISOString()
    }, { headers });

  } catch (error) {
    console.error('[enriquecerContatosSemTelefone] Erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
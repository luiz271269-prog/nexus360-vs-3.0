import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return Response.json({ error: 'Apenas admin pode acessar' }, { status: 403 });
    }

    const { contact_id } = await req.json();
    
    if (!contact_id) {
      return Response.json({ error: 'contact_id obrigatório' }, { status: 400 });
    }

    // STEP 1: Buscar contato atual
    const contatoAtual = await base44.asServiceRole.entities.Contact.filter({ id: contact_id });
    if (!contatoAtual || contatoAtual.length === 0) {
      return Response.json({ error: `Contato ${contact_id} não encontrado` }, { status: 404 });
    }

    const contato = contatoAtual[0];
    
    // STEP 2: Analisar o problema
    const diagnostico = {
      timestamp: new Date().toISOString(),
      contact_id: contato.id,
      contact_nome: contato.nome,
      telefone: contato.telefone,
      telefone_canonico_atual: contato.telefone_canonico,
      telefone_canonico_corrompido: (contato.telefone_canonico || '').includes('MERGED_'),
      tags_atuais: contato.tags || [],
      tags_merged_ou_duplicata: (contato.tags || []).filter(t => t === 'merged' || t === 'duplicata').length,
    };

    // STEP 3: Extrair telefone esperado
    const telefoneEsperado = (contato.telefone || '').replace(/\D/g, '');
    diagnostico.telefone_esperado = telefoneEsperado;
    diagnostico.telefone_canonico_errado = telefoneEsperado && diagnostico.telefone_canonico_atual !== telefoneEsperado;

    // STEP 4: Buscar threads do contato
    const threads = await base44.asServiceRole.entities.MessageThread.filter({ contact_id: contato.id });
    diagnostico.threads_total = threads.length;
    diagnostico.threads_status = threads.map(t => ({
      id: t.id,
      status: t.status,
      ultima_msg: t.last_message_at,
      total_msg: t.total_mensagens
    }));

    // STEP 5: Buscar possíveis contatos duplicados
    const contatosComMesmoTelefone = await base44.asServiceRole.entities.Contact.filter({
      telefone_canonico: telefoneEsperado
    });
    
    diagnostico.duplicados_por_canonico = contatosComMesmoTelefone.length;
    diagnostico.duplicados_ids = contatosComMesmoTelefone.map(c => ({ id: c.id, nome: c.nome, criado: c.created_date }));

    // STEP 6: Tentar CORRIGIR
    const correcoes = {
      aplicadas: [],
      erros: []
    };

    // Corrigir telefone_canonico
    if (diagnostico.telefone_canonico_corrompido || diagnostico.telefone_canonico_errado) {
      try {
        await base44.asServiceRole.entities.Contact.update(contato.id, {
          telefone_canonico: telefoneEsperado
        });
        correcoes.aplicadas.push(`telefone_canonico corrigido de "${diagnostico.telefone_canonico_atual}" para "${telefoneEsperado}"`);
      } catch (e) {
        correcoes.erros.push(`Erro ao corrigir telefone_canonico: ${e.message}`);
      }
    }

    // Limpar tags merged/duplicata
    if (diagnostico.tags_merged_ou_duplicata > 0) {
      try {
        const tagsLimpas = (contato.tags || []).filter(t => t !== 'merged' && t !== 'duplicata');
        await base44.asServiceRole.entities.Contact.update(contato.id, {
          tags: tagsLimpas
        });
        correcoes.aplicadas.push(`${diagnostico.tags_merged_ou_duplicata} tags merged/duplicata removidas`);
      } catch (e) {
        correcoes.erros.push(`Erro ao limpar tags: ${e.message}`);
      }
    }

    // STEP 7: Revalidar depois das correções
    const contatoDepois = await base44.asServiceRole.entities.Contact.filter({ id: contato.id });
    const conturoValida = contatoDepois[0];

    return Response.json({
      success: correcoes.erros.length === 0,
      diagnostico,
      correcoes,
      estado_depois: {
        telefone_canonico: conturoValida.telefone_canonico,
        tags: conturoValida.tags,
        updated_date: conturoValida.updated_date
      }
    });

  } catch (error) {
    console.error('[diagnosticoForenseContato]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
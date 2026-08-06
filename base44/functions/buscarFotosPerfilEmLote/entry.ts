import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Processador controlado por IDs explícitos. Nunca seleciona contatos por data.
// dryRun aceita até 5 IDs; execução real é obrigatoriamente unitária.
// Delega a resolução ao resolverFotoPerfil (v3.3).
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Acesso restrito a administradores' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    let ids = [...new Set(Array.isArray(body?.ids) ? body.ids.map(String).filter(Boolean) : [])];
    const idsExplicitos = ids.length > 0;
    const dryRun = body?.dryRun !== false;
    const limiteSolicitado = Number(body?.limite) || (dryRun ? 3 : 1);
    // Sem ids => modo automático (job noturno): seleciona candidatos, no máx. 2 por execução.
    const limite = idsExplicitos ? (dryRun ? Math.max(1, Math.min(limiteSolicitado, 5)) : 1) : 2;

    if (!idsExplicitos) {
      const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
      const agora = Date.now();
      const candidatos = await base44.asServiceRole.entities.Contact.list('foto_perfil_atualizada_em', 100);
      ids = candidatos
        .filter((c) => {
          const tel = String(c.telefone_canonico || c.telefone || '').replace(/\D/g, '');
          if (tel.length < 10) return false;
          const foto = String(c.foto_perfil_url || '').trim();
          const permanente = /^https?:\/\//i.test(foto) && !foto.includes('pps.whatsapp.net') && !/w-api|z-api|whatsapp/i.test(foto);
          if (permanente) return false;
          const tentadoEm = c.foto_perfil_atualizada_em ? new Date(c.foto_perfil_atualizada_em).getTime() : 0;
          return agora - tentadoEm > COOLDOWN_MS;
        })
        .slice(0, limite)
        .map((c) => c.id);

      if (!ids.length) {
        return Response.json({ success: true, dryRun, modo: 'automatico', processados: 0, resultados: [], motivo: 'sem_candidatos' });
      }
    }

    if (!ids.length) {
      return Response.json({ success: false, error: 'ids_obrigatorios', dryRun }, { status: 400 });
    }
    if (idsExplicitos && !dryRun && ids.length > 1) {
      return Response.json({
        success: false,
        error: 'execucao_real_unitaria_obrigatoria',
        detalhe: 'Envie exatamente 1 ID quando dryRun=false',
        dryRun
      }, { status: 400 });
    }
    if (dryRun && (ids.length > limite || ids.length > 5)) {
      return Response.json({
        success: false,
        error: 'micro_lote_excedido',
        detalhe: `Envie no máximo ${limite} IDs nesta chamada`,
        dryRun
      }, { status: 400 });
    }

    const ehFotoPermanente = (valor) => {
      const foto = String(valor || '').trim();
      return /^https?:\/\//i.test(foto) &&
        !foto.includes('pps.whatsapp.net') &&
        !/w-api|z-api|whatsapp/i.test(foto);
    };
    const classificarErro = (mensagem) => {
      const texto = String(mensagem || '').toLowerCase();
      if (texto.includes('upload')) return 'erro_upload';
      if (texto.includes('429')) return 'erro_provider_429';
      if (texto.includes('502')) return 'erro_provider_502';
      if (texto.includes('timeout') || texto.includes('timed out')) return 'erro_timeout';
      return 'erro_provider';
    };
    const ehTransitorio = (status) => ['erro_provider_429', 'erro_provider_502', 'erro_timeout'].includes(status);

    const resultados = [];
    let falhasTransitoriasConsecutivas = 0;
    let interrompido = false;

    for (const contactId of ids.slice(0, limite)) {
      const inicio = Date.now();
      const contato = await base44.asServiceRole.entities.Contact.get(contactId).catch(() => null);

      if (!contato) {
        resultados.push({ contact_id: contactId, status: 'contato_nao_encontrado', tempo_ms: Date.now() - inicio });
        falhasTransitoriasConsecutivas = 0;
        continue;
      }

      const telefone = String(contato.telefone_canonico || contato.telefone || '').replace(/\D/g, '');
      if (ehFotoPermanente(contato.foto_perfil_url)) {
        resultados.push({
          contact_id: contactId,
          nome: contato.nome || '',
          telefone,
          status: 'ja_possui_foto_permanente',
          foto_atual: contato.foto_perfil_url,
          tempo_ms: Date.now() - inicio
        });
        falhasTransitoriasConsecutivas = 0;
        continue;
      }
      if (telefone.length < 10) {
        resultados.push({ contact_id: contactId, nome: contato.nome || '', telefone, status: 'telefone_invalido', tempo_ms: Date.now() - inicio });
        falhasTransitoriasConsecutivas = 0;
        continue;
      }
      if (dryRun) {
        resultados.push({
          contact_id: contactId,
          nome: contato.nome || '',
          telefone,
          status: 'pronto_para_processar',
          foto_atual: contato.foto_perfil_url || null,
          tempo_ms: Date.now() - inicio
        });
        continue;
      }

      try {
        const resposta = await base44.functions.invoke('resolverFotoPerfil', {
          phone: telefone,
          contact_id: contactId,
          persistir: true
        });
        const dados = resposta?.data || resposta;
        let status = 'sem_foto_publica';
        if (dados?.file_url) status = 'sucesso';
        else if (dados?.success === false) status = classificarErro(dados?.error);

        resultados.push({
          contact_id: contactId,
          nome: contato.nome || '',
          telefone,
          status,
          foto_salva: dados?.file_url || null,
          provider: dados?.provider || null,
          instancia: dados?.instance_id || null,
          erro: dados?.error || null,
          tempo_ms: Date.now() - inicio
        });
        falhasTransitoriasConsecutivas = ehTransitorio(status) ? falhasTransitoriasConsecutivas + 1 : 0;
      } catch (error) {
        const status = classificarErro(error.message);
        resultados.push({
          contact_id: contactId,
          nome: contato.nome || '',
          telefone,
          status,
          erro: error.message,
          tempo_ms: Date.now() - inicio
        });
        falhasTransitoriasConsecutivas = ehTransitorio(status) ? falhasTransitoriasConsecutivas + 1 : 0;
      }

      if (falhasTransitoriasConsecutivas >= 2) {
        interrompido = true;
        break;
      }
    }

    return Response.json({
      success: true,
      dryRun,
      limite,
      solicitados: ids.length,
      processados: resultados.length,
      interrompido,
      motivo_interrupcao: interrompido ? 'duas_falhas_transitorias_consecutivas' : null,
      resultados
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});
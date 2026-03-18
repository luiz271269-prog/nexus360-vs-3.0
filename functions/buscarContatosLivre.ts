import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }

  if (req.method === 'GET') {
    return Response.json({ 
      status: 'ok',
      description: 'Busca GLOBAL livre de contatos (ignora RLS, sem filtros de permissão)'
    });
  }

  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const body = await req.json();
    const searchTerm = body.searchTerm;
    const limit = body.limit || 200;
    
    console.log('[buscarContatosLivre] Chamada:', { user_email: user.email, searchTerm: searchTerm || '(vazio)', limit });

    let contatos = [];
    
    if (!searchTerm || !searchTerm.trim()) {
      contatos = await base44.asServiceRole.entities.Contact.list('-ultima_interacao', limit);
    } else {
      const termo = searchTerm.trim().toLowerCase();
      const termoNumeros = termo.replace(/\D/g, '');
      
      // Busca por telefone se parecer número
      if (termoNumeros.length >= 8) {
        const gerarVariacoes = (tel) => {
          const telLimpo = tel.replace(/\D/g, '');
          const variacoes = new Set();
          let telBase = telLimpo;
          if (!telBase.startsWith('55') && (telBase.length === 10 || telBase.length === 11)) {
            telBase = '55' + telBase;
          }
          if (telBase.startsWith('55') && telBase.length === 12) {
            const ddd = telBase.substring(2, 4);
            const numero = telBase.substring(4);
            if (['6', '7', '8', '9'].includes(numero[0])) {
              telBase = '55' + ddd + '9' + numero;
            }
          }
          variacoes.add('+' + telBase);
          variacoes.add(telBase);
          if (telBase.length === 13 && telBase.startsWith('55')) {
            const semNono = telBase.substring(0, 4) + telBase.substring(5);
            variacoes.add('+' + semNono);
            variacoes.add(semNono);
          }
          if (telBase.length === 12 && telBase.startsWith('55')) {
            const comNono = telBase.substring(0, 4) + '9' + telBase.substring(4);
            variacoes.add('+' + comNono);
            variacoes.add(comNono);
          }
          return Array.from(variacoes);
        };
        
        const variacoes = gerarVariacoes(termoNumeros);
        for (const variacao of variacoes) {
          const resultado = await base44.asServiceRole.entities.Contact.filter(
            { telefone: variacao }, '-ultima_interacao', 10
          );
          if (resultado.length > 0) {
            contatos = resultado;
            break;
          }
        }
      }
      
      // Busca por texto se não achou por telefone
      if (contatos.length === 0) {
        const todosBD = await base44.asServiceRole.entities.Contact.list('-ultima_interacao', 1000);
        contatos = todosBD.filter(c => {
          const nome = (c.nome || '').toLowerCase();
          const empresa = (c.empresa || '').toLowerCase();
          const cargo = (c.cargo || '').toLowerCase();
          const observacoes = (c.observacoes || '').toLowerCase();
          const telefone = (c.telefone || '').replace(/\D/g, '');
          const matchTexto = nome.includes(termo) || empresa.includes(termo) || cargo.includes(termo) || observacoes.includes(termo);
          const matchTelefone = termoNumeros.length >= 4 && telefone.includes(termoNumeros);
          return matchTexto || matchTelefone;
        }).slice(0, 200);
      }
    }

    // Adicionar _meta de completude
    const contatosComMetadata = contatos.map(c => {
      const nome = (c.nome || '').trim();
      const telefone = (c.telefone || '').replace(/\D/g, '');
      const temDados = (nome && nome !== c.telefone && nome !== '+' + telefone) || c.empresa || c.cargo || c.email;
      return {
        ...c,
        _meta: {
          tem_dados_basicos: !!temDados,
          score_completude: (
            (nome && nome !== c.telefone ? 10 : 0) +
            (c.empresa ? 5 : 0) +
            (c.cargo ? 3 : 0) +
            (c.email ? 2 : 0)
          )
        }
      };
    });

    // Deduplicar por telefone canônico
    const contatosPorTelefone = new Map();
    const contatosSemTelefone = [];
    
    contatosComMetadata.forEach(c => {
      const telCanon = c.telefone_canonico || (c.telefone || '').replace(/\D/g, '');
      if (!telCanon) {
        contatosSemTelefone.push(c);
        return;
      }
      const existente = contatosPorTelefone.get(telCanon);
      if (!existente) {
        contatosPorTelefone.set(telCanon, c);
      } else {
        const scoreExistente = existente._meta?.score_completude || 0;
        const scoreAtual = c._meta?.score_completude || 0;
        if (scoreAtual > scoreExistente) {
          contatosPorTelefone.set(telCanon, c);
        } else if (scoreAtual === scoreExistente) {
          const tsExistente = new Date(existente.ultima_interacao || existente.updated_date || 0).getTime();
          const tsAtual = new Date(c.ultima_interacao || c.updated_date || 0).getTime();
          if (tsAtual > tsExistente) contatosPorTelefone.set(telCanon, c);
        }
      }
    });
    
    const contatosDeduplicated = [...contatosPorTelefone.values(), ...contatosSemTelefone];

    const contatosOrdenados = contatosDeduplicated.sort((a, b) => {
      const scoreA = a._meta?.score_completude || 0;
      const scoreB = b._meta?.score_completude || 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      const tsA = new Date(a.ultima_interacao || a.updated_date || 0).getTime();
      const tsB = new Date(b.ultima_interacao || b.updated_date || 0).getTime();
      return tsB - tsA;
    });

    console.log('[buscarContatosLivre] Retornando:', contatosOrdenados.length, 'contatos');

    return Response.json({ 
      success: true,
      contatos: contatosOrdenados,
      total: contatosOrdenados.length,
    });

  } catch (error) {
    console.error('[buscarContatosLivre] ERRO:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});
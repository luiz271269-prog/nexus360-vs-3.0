import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║  TAG MANAGER - Gestão Inteligente de Tags                    ║
 * ║  Aplicação automática, remoção e análise de tags             ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

Deno.serve(async (req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
    }

    const payload = await req.json();
    const { action, ...params } = payload;

    console.log('[TAG MANAGER] 🏷️ Action:', action);

    switch (action) {
      case 'apply_tag':
        return Response.json(await aplicarTag(base44, user, params), { headers });
      
      case 'remove_tag':
        return Response.json(await removerTag(base44, user, params), { headers });
      
      case 'process_automatic_rules':
        return Response.json(await processarRegrasAutomaticas(base44), { headers });
      
      case 'analyze_tag_performance':
        return Response.json(await analisarPerformanceTag(base44, params), { headers });
      
      case 'suggest_tags':
        return Response.json(await sugerirTags(base44, params), { headers });
      
      default:
        throw new Error(`Ação desconhecida: ${action}`);
    }

  } catch (error) {
    console.error('[TAG MANAGER] ❌ Erro:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500, headers });
  }
});

async function aplicarTag(base44, user, params) {
  const { contact_id, tag_id, motivo } = params;

  console.log(`[TAG MANAGER] Aplicando tag ${tag_id} ao contato ${contact_id}`);

  try {
    // Verificar se tag já existe
    const existente = await base44.asServiceRole.entities.ContactTag.filter({
      contact_id,
      tag_id,
      ativa: true
    });

    if (existente.length > 0) {
      return {
        success: false,
        message: 'Tag já aplicada a este contato'
      };
    }

    // Buscar informações da tag
    const tag = await base44.asServiceRole.entities.Tag.get(tag_id);

    // Criar ContactTag
    await base44.asServiceRole.entities.ContactTag.create({
      contact_id,
      tag_id,
      tag_nome: tag.nome,
      aplicada_automaticamente: false,
      aplicada_por: user.id,
      data_aplicacao: new Date().toISOString(),
      ativa: true,
      motivo: motivo || 'Aplicação manual'
    });

    // Atualizar contador da tag
    await base44.asServiceRole.entities.Tag.update(tag_id, {
      'metricas.total_contatos': (tag.metricas?.total_contatos || 0) + 1
    });

    // Atualizar array de tags no Contact (para facilitar queries)
    const contact = await base44.asServiceRole.entities.Contact.get(contact_id);
    const tagsAtuais = contact.tags || [];
    
    if (!tagsAtuais.includes(tag.nome)) {
      await base44.asServiceRole.entities.Contact.update(contact_id, {
        tags: [...tagsAtuais, tag.nome]
      });
    }

    console.log(`[TAG MANAGER] ✅ Tag ${tag.nome} aplicada com sucesso`);

    return {
      success: true,
      message: `Tag "${tag.nome}" aplicada ao contato`,
      tag_nome: tag.nome
    };

  } catch (error) {
    console.error('[TAG MANAGER] Erro ao aplicar tag:', error);
    throw error;
  }
}

async function removerTag(base44, user, params) {
  const { contact_id, tag_id, motivo } = params;

  console.log(`[TAG MANAGER] Removendo tag ${tag_id} do contato ${contact_id}`);

  try {
    // Buscar ContactTag ativa
    const contactTags = await base44.asServiceRole.entities.ContactTag.filter({
      contact_id,
      tag_id,
      ativa: true
    });

    if (contactTags.length === 0) {
      return {
        success: false,
        message: 'Tag não encontrada neste contato'
      };
    }

    const contactTag = contactTags[0];
    const tag = await base44.asServiceRole.entities.Tag.get(tag_id);

    // Marcar como inativa
    await base44.asServiceRole.entities.ContactTag.update(contactTag.id, {
      ativa: false,
      data_remocao: new Date().toISOString(),
      motivo: motivo || 'Remoção manual'
    });

    // Atualizar contador da tag
    await base44.asServiceRole.entities.Tag.update(tag_id, {
      'metricas.total_contatos': Math.max(0, (tag.metricas?.total_contatos || 1) - 1)
    });

    // Atualizar array de tags no Contact
    const contact = await base44.asServiceRole.entities.Contact.get(contact_id);
    const tagsAtuais = contact.tags || [];
    
    await base44.asServiceRole.entities.Contact.update(contact_id, {
      tags: tagsAtuais.filter(t => t !== tag.nome)
    });

    console.log(`[TAG MANAGER] ✅ Tag ${tag.nome} removida com sucesso`);

    return {
      success: true,
      message: `Tag "${tag.nome}" removida do contato`,
      tag_nome: tag.nome
    };

  } catch (error) {
    console.error('[TAG MANAGER] Erro ao remover tag:', error);
    throw error;
  }
}

async function processarRegrasAutomaticas(base44) {
  console.log('[TAG MANAGER] 🤖 Processando regras automáticas de tags...');

  try {
    // Buscar tags com regras automáticas ativas
    const tagsComRegras = await base44.asServiceRole.entities.Tag.filter({
      'regras_automaticas.aplicar_automaticamente': true,
      ativa: true
    });

    console.log(`[TAG MANAGER] Encontradas ${tagsComRegras.length} tags com regras automáticas`);

    let totalAplicadas = 0;
    let totalRemovidas = 0;

    for (const tag of tagsComRegras) {
      const { condicoes } = tag.regras_automaticas;

      if (!condicoes || condicoes.length === 0) continue;

      // Construir query dinâmica baseada nas condições
      const query = {};
      
      for (const condicao of condicoes) {
        switch (condicao.operador) {
          case 'equals':
            query[condicao.campo] = condicao.valor;
            break;
          case 'contains':
            // Base44 SDK pode não suportar, usar filter manual depois
            break;
          case 'greater_than':
            query[condicao.campo] = { $gt: parseFloat(condicao.valor) };
            break;
          case 'less_than':
            query[condicao.campo] = { $lt: parseFloat(condicao.valor) };
            break;
          case 'in_list':
            query[condicao.campo] = { $in: condicao.valor.split(',') };
            break;
        }
      }

      // Buscar contatos que atendem às condições
      let contatosElegiveis = await base44.asServiceRole.entities.Contact.filter(query, null, 100);

      // Filtro manual para 'contains' (se necessário)
      contatosElegiveis = contatosElegiveis.filter(contact => {
        return condicoes.every(condicao => {
          if (condicao.operador === 'contains') {
            const valor = contact[condicao.campo];
            return valor && valor.toLowerCase().includes(condicao.valor.toLowerCase());
          }
          return true;
        });
      });

      // Aplicar tag aos contatos elegíveis que ainda não a possuem
      for (const contact of contatosElegiveis) {
        const jaTemTag = contact.tags && contact.tags.includes(tag.nome);

        if (!jaTemTag) {
          await base44.asServiceRole.entities.ContactTag.create({
            contact_id: contact.id,
            tag_id: tag.id,
            tag_nome: tag.nome,
            aplicada_automaticamente: true,
            data_aplicacao: new Date().toISOString(),
            ativa: true,
            motivo: 'Aplicação automática por regra'
          });

          await base44.asServiceRole.entities.Contact.update(contact.id, {
            tags: [...(contact.tags || []), tag.nome]
          });

          totalAplicadas++;
        }
      }
    }

    console.log(`[TAG MANAGER] ✅ Processamento concluído: ${totalAplicadas} tags aplicadas`);

    return {
      success: true,
      total_aplicadas: totalAplicadas,
      total_removidas: totalRemovidas
    };

  } catch (error) {
    console.error('[TAG MANAGER] Erro ao processar regras:', error);
    throw error;
  }
}

async function analisarPerformanceTag(base44, params) {
  const { tag_id } = params;

  console.log(`[TAG MANAGER] 📊 Analisando performance da tag ${tag_id}`);

  try {
    const tag = await base44.asServiceRole.entities.Tag.get(tag_id);

    // Buscar todos os contatos com esta tag
    const contactTags = await base44.asServiceRole.entities.ContactTag.filter({
      tag_id,
      ativa: true
    });

    const contactIds = contactTags.map(ct => ct.contact_id);

    if (contactIds.length === 0) {
      return {
        success: true,
        tag_nome: tag.nome,
        total_contatos: 0,
        taxa_conversao: 0,
        valor_medio_venda: 0
      };
    }

    // Buscar vendas relacionadas a esses contatos
    const vendas = await base44.asServiceRole.entities.Venda.filter({
      cliente_id: { $in: contactIds }
    });

    const taxaConversao = (vendas.length / contactIds.length) * 100;
    const valorMedioVenda = vendas.length > 0
      ? vendas.reduce((sum, v) => sum + (v.valor_total || 0), 0) / vendas.length
      : 0;

    // Atualizar métricas da tag
    await base44.asServiceRole.entities.Tag.update(tag_id, {
      'metricas.total_contatos': contactIds.length,
      'metricas.taxa_conversao': taxaConversao,
      'metricas.valor_medio_venda': valorMedioVenda
    });

    console.log(`[TAG MANAGER] ✅ Performance analisada: ${taxaConversao.toFixed(1)}% conversão`);

    return {
      success: true,
      tag_nome: tag.nome,
      total_contatos: contactIds.length,
      taxa_conversao: taxaConversao,
      valor_medio_venda: valorMedioVenda,
      total_vendas: vendas.length
    };

  } catch (error) {
    console.error('[TAG MANAGER] Erro ao analisar performance:', error);
    throw error;
  }
}

async function sugerirTags(base44, params) {
  const { contact_id } = params;

  console.log(`[TAG MANAGER] 💡 Sugerindo tags para contato ${contact_id}`);

  try {
    const contact = await base44.asServiceRole.entities.Contact.get(contact_id);

    // Buscar histórico do contato
    const [threads, vendas, orcamentos] = await Promise.all([
      base44.asServiceRole.entities.MessageThread.filter({ contact_id }, null, 10),
      base44.asServiceRole.entities.Venda.filter({ cliente_id: contact_id }),
      base44.asServiceRole.entities.Orcamento.filter({ cliente_id: contact_id })
    ]);

    const sugestoes = [];

    // Regra 1: Cliente VIP (múltiplas compras)
    if (vendas.length >= 3) {
      sugestoes.push({
        tag_nome: 'cliente_vip',
        motivo: `${vendas.length} compras realizadas`,
        confianca: 0.95
      });
    }

    // Regra 2: Lead Quente (múltiplas interações recentes)
    const interacoesRecentes = threads.filter(t => {
      const diasAtras = (new Date() - new Date(t.last_message_at)) / (1000 * 60 * 60 * 24);
      return diasAtras <= 7;
    });

    if (interacoesRecentes.length >= 3 && vendas.length === 0) {
      sugestoes.push({
        tag_nome: 'lead_quente',
        motivo: `${interacoesRecentes.length} interações nos últimos 7 dias`,
        confianca: 0.85
      });
    }

    // Regra 3: Pós-venda (comprou recentemente)
    const compraRecente = vendas.find(v => {
      const diasAtras = (new Date() - new Date(v.data_venda)) / (1000 * 60 * 60 * 24);
      return diasAtras <= 30;
    });

    if (compraRecente) {
      sugestoes.push({
        tag_nome: 'pos_venda',
        motivo: 'Compra realizada nos últimos 30 dias',
        confianca: 1.0
      });
    }

    // Regra 4: Orçamento Pendente
    const orcamentoPendente = orcamentos.find(o => 
      ['enviado', 'negociando'].includes(o.status)
    );

    if (orcamentoPendente) {
      sugestoes.push({
        tag_nome: 'orcamento_aberto',
        motivo: `Orçamento ${orcamentoPendente.status}`,
        confianca: 1.0
      });
    }

    console.log(`[TAG MANAGER] 💡 ${sugestoes.length} tags sugeridas`);

    return {
      success: true,
      contact_id,
      sugestoes
    };

  } catch (error) {
    console.error('[TAG MANAGER] Erro ao sugerir tags:', error);
    throw error;
  }
}
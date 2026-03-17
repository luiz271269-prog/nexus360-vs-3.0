// Função cirúrgica para corrigir whatsapp_setores dos atendentes
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Verificar se é admin
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Correções específicas para os 3 atendentes
    const correcoes = [
      { id: '68de787c320cf6fb72dc879c', whatsapp_setores: ['vendas'], nome: 'Tiago (vendas1)' },
      { id: '68effb5720ac6ce2022879ff', whatsapp_setores: ['vendas'], nome: 'Thais (vendas5)' },
      { id: '69824ad82b2934a3b50757d2', whatsapp_setores: ['assistencia'], availability_status: 'online', nome: 'Ricardo' }
    ];

    const resultados = [];
    
    for (const correcao of correcoes) {
      try {
        // Buscar usuário atual
        const userAtual = await base44.asServiceRole.entities.User.get(correcao.id);
        
        // Mesclar dados existentes com correções
        const dataMerged = {
          ...userAtual.data,
          whatsapp_setores: correcao.whatsapp_setores
        };
        
        if (correcao.availability_status) {
          dataMerged.availability_status = correcao.availability_status;
        }

        // Tentar atualizar via SDK
        const updated = await base44.asServiceRole.entities.User.update(correcao.id, {
          data: dataMerged
        });

        resultados.push({
          nome: correcao.nome,
          sucesso: true,
          whatsapp_setores: correcao.whatsapp_setores,
          availability_status: correcao.availability_status || 'não alterado'
        });
        
        console.log(`✅ ${correcao.nome} atualizado`);
      } catch (e) {
        console.error(`❌ ${correcao.nome} falhou:`, e.message);
        resultados.push({
          nome: correcao.nome,
          sucesso: false,
          erro: e.message
        });
      }
    }

    return Response.json({ sucesso: true, resultados });
  } catch (error) {
    console.error('[CORRECAO] Erro:', error.message);
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});
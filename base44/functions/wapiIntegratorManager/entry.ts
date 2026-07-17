import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Gerenciador de Instâncias W-API Integrador
 * - Criar instâncias (já com webhooks configurados)
 * - Listar instâncias
 * - Deletar instâncias
 * 
 * Baseado na documentação oficial W-API Integrador
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { action } = payload;

    // Ações de mutação exigem admin; leitura de status liberada para usuários logados
    const ACOES_ADMIN = ['createInstance', 'deleteInstance', 'disconnect'];
    if (ACOES_ADMIN.includes(action) && user.role !== 'admin') {
      return Response.json({ error: 'Apenas admins podem gerenciar instâncias' }, { status: 403 });
    }

    const INTEGRATOR_TOKEN = Deno.env.get('WAPI_INTEGRATOR_TOKEN');
    if (!INTEGRATOR_TOKEN) {
      return Response.json({ 
        error: 'WAPI_INTEGRATOR_TOKEN não configurado' 
      }, { status: 500 });
    }

    // ✅ BUSCAR URL DO BANCO: Para integrações existentes, usar a URL cadastrada
    // Para novas, usar a URL padrão do ambiente
    const DEFAULT_WEBHOOK_URL = 'https://nexus360-pro.base44.app/api/apps/68a7d067890527304dbe8477/functions/webhookWapi';

    // ========================================================================
    // AÇÃO: CRIAR INSTÂNCIA
    // ========================================================================
    if (action === 'createInstance') {
      const { instanceName } = payload;

      if (!instanceName) {
        return Response.json({ error: 'instanceName é obrigatório' }, { status: 400 });
      }

      console.log('[WAPI-INTEGRATOR] 🚀 Criando instância:', instanceName);

      try {
        const response = await fetch('https://api.w-api.app/v1/integrator/create-instance', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${INTEGRATOR_TOKEN}`
          },
          body: JSON.stringify({
            instanceName,
            rejectCalls: true,
            callMessage: "Não estamos disponíveis para chamadas no momento.",
            // ✅ CONFIGURAR WEBHOOKS NA CRIAÇÃO (evita passo extra)
            webhookReceivedUrl: DEFAULT_WEBHOOK_URL,
            webhookDeliveryUrl: DEFAULT_WEBHOOK_URL,
            webhookDisconnectedUrl: DEFAULT_WEBHOOK_URL
          })
        });

        const data = await response.json();

        if (data.error === false && data.instanceId && data.token) {
          console.log('[WAPI-INTEGRATOR] ✅ Instância criada:', data.instanceId);

          return Response.json({
            success: true,
            instanceId: data.instanceId,
            token: data.token,
            webhookUrl: DEFAULT_WEBHOOK_URL,
            message: 'Instância criada com webhooks já configurados!'
          });
        } else {
          console.error('[WAPI-INTEGRATOR] ❌ Erro na resposta:', data);
          return Response.json({
            success: false,
            error: data.message || 'Erro ao criar instância'
          }, { status: 400 });
        }
      } catch (error) {
        console.error('[WAPI-INTEGRATOR] ❌ Erro na requisição:', error);
        return Response.json({
          success: false,
          error: error.message
        }, { status: 500 });
      }
    }

    // ========================================================================
    // AÇÃO: LISTAR INSTÂNCIAS
    // ========================================================================
    if (action === 'listInstances') {
      const { pageSize = 50, page = 1 } = payload;

      try {
        const url = `https://api.w-api.app/v1/integrator/instances?pageSize=${pageSize}&page=${page}`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${INTEGRATOR_TOKEN}`
          }
        });

        const data = await response.json();

        if (data.error === false) {
          return Response.json({
            success: true,
            instances: data.data || [],
            total: data.total || 0,
            page: data.page || 1,
            totalPages: data.totalPage || 1
          });
        } else {
          return Response.json({
            success: false,
            error: data.message || 'Erro ao listar instâncias'
          }, { status: 400 });
        }
      } catch (error) {
        console.error('[WAPI-INTEGRATOR] ❌ Erro ao listar:', error);
        return Response.json({
          success: false,
          error: error.message
        }, { status: 500 });
      }
    }

    // ========================================================================
    // AÇÃO: DELETAR INSTÂNCIA
    // ========================================================================
    if (action === 'deleteInstance') {
      const { instanceId } = payload;

      if (!instanceId) {
        return Response.json({ error: 'instanceId é obrigatório' }, { status: 400 });
      }

      try {
        const url = `https://api.w-api.app/v1/integrator/delete-instance?instanceId=${instanceId}`;
        
        const response = await fetch(url, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${INTEGRATOR_TOKEN}`
          }
        });

        const data = await response.json();

        if (data.error === false) {
          console.log('[WAPI-INTEGRATOR] ✅ Instância deletada:', instanceId);
          return Response.json({
            success: true,
            message: 'Instância deletada com sucesso'
          });
        } else {
          return Response.json({
            success: false,
            error: data.message || 'Erro ao deletar instância'
          }, { status: 400 });
        }
      } catch (error) {
        console.error('[WAPI-INTEGRATOR] ❌ Erro ao deletar:', error);
        return Response.json({
          success: false,
          error: error.message
        }, { status: 500 });
      }
    }

    // ========================================================================
    // AÇÃO: STATUS DE TODAS (auto-teste ao entrar na tela — 1 chamada ao provedor)
    // ========================================================================
    if (action === 'getStatusAll') {
      try {
        const r = await fetch('https://api.w-api.app/v1/integrator/instances?pageSize=100&page=1', {
          headers: { 'Authorization': `Bearer ${INTEGRATOR_TOKEN}` },
          signal: AbortSignal.timeout(15000)
        });
        const data = await r.json();
        if (data.error !== false) {
          return Response.json({ success: false, error: data.message || 'Erro ao listar instâncias' }, { status: 400 });
        }
        const instancias = data.data || [];
        const locais = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
          { api_provider: 'w_api' }, '-created_date', 100
        );
        let atualizadas = 0;
        const statusMap: Record<string, unknown> = {};
        for (const local of locais) {
          const inst = instancias.find((i) => i.instanceId === local.instance_id_provider);
          if (!inst) { statusMap[local.id] = { encontrada: false }; continue; }
          const statusReal = inst.connected ? 'conectado' : 'desconectado';
          statusMap[local.id] = { encontrada: true, connected: !!inst.connected, phone: inst.connectedPhone || null };
          if (local.status !== statusReal || (inst.connectedPhone && local.numero_telefone !== inst.connectedPhone)) {
            await base44.asServiceRole.entities.WhatsAppIntegration.update(local.id, {
              status: statusReal,
              numero_telefone: inst.connectedPhone || local.numero_telefone,
              ultima_atividade: new Date().toISOString()
            });
            atualizadas++;
          }
        }
        console.log(`[WAPI-INTEGRATOR] ✅ getStatusAll: ${atualizadas} atualizada(s)`);
        return Response.json({ success: true, atualizadas, status: statusMap });
      } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
      }
    }

    // ========================================================================
    // AÇÃO: STATUS DE UMA INSTÂNCIA (fonte de verdade: API do Integrador)
    // ========================================================================
    if (action === 'getStatus') {
      const integracao = await base44.asServiceRole.entities.WhatsAppIntegration.get(payload.integration_id);
      if (!integracao) return Response.json({ success: false, error: 'Integração não encontrada' }, { status: 404 });

      try {
        const r = await fetch('https://api.w-api.app/v1/integrator/instances?pageSize=100&page=1', {
          headers: { 'Authorization': `Bearer ${INTEGRATOR_TOKEN}` },
          signal: AbortSignal.timeout(15000)
        });
        const data = await r.json();
        const inst = data.error === false
          ? (data.data || []).find((i) => i.instanceId === integracao.instance_id_provider)
          : null;

        if (!inst) {
          // Não encontrada no integrador — devolve o que o banco sabe
          return Response.json({
            success: true,
            connected: integracao.status === 'conectado',
            phone: integracao.numero_telefone || null,
            fonte: 'banco'
          });
        }

        const connected = !!inst.connected;
        const statusReal = connected ? 'conectado' : 'desconectado';
        if (integracao.status !== statusReal || (inst.connectedPhone && integracao.numero_telefone !== inst.connectedPhone)) {
          await base44.asServiceRole.entities.WhatsAppIntegration.update(integracao.id, {
            status: statusReal,
            numero_telefone: inst.connectedPhone || integracao.numero_telefone,
            ultima_atividade: new Date().toISOString()
          });
        }
        return Response.json({ success: true, connected, phone: inst.connectedPhone || null, fonte: 'integrator' });
      } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
      }
    }

    // ========================================================================
    // AÇÃO: GERAR QR CODE (server-side — resolve CORS e protege o token)
    // ========================================================================
    if (action === 'getQrCode') {
      const integracao = await base44.asServiceRole.entities.WhatsAppIntegration.get(payload.integration_id);
      if (!integracao) return Response.json({ success: false, error: 'Integração não encontrada' }, { status: 404 });

      try {
        const url = `https://api.w-api.app/v1/instance/qr-code?instanceId=${integracao.instance_id_provider}&image=enable`;
        const r = await fetch(url, {
          headers: { 'Authorization': `Bearer ${integracao.api_key_provider}` },
          signal: AbortSignal.timeout(15000)
        });
        const data = await r.json().catch(() => null);
        const qrcode = data?.qrcode || data?.base64 || data?.image;
        if (!r.ok || !qrcode) {
          return Response.json({
            success: false,
            error: data?.message || `Falha ao gerar QR Code (HTTP ${r.status}). A instância pode já estar conectada.`
          }, { status: 400 });
        }
        await base44.asServiceRole.entities.WhatsAppIntegration.update(integracao.id, {
          status: 'pendente_qrcode',
          qr_code_url: qrcode,
          qr_code_gerado_em: new Date().toISOString()
        });
        return Response.json({ success: true, qrcode });
      } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
      }
    }

    // ========================================================================
    // AÇÃO: GERAR PAIRING CODE (server-side)
    // ========================================================================
    if (action === 'getPairingCode') {
      const integracao = await base44.asServiceRole.entities.WhatsAppIntegration.get(payload.integration_id);
      if (!integracao) return Response.json({ success: false, error: 'Integração não encontrada' }, { status: 404 });

      const telefone = String(payload.phoneNumber || integracao.numero_telefone || '').replace(/\D/g, '');
      if (!telefone) {
        return Response.json({ success: false, error: 'Número de telefone não cadastrado nesta instância. Edite a conexão e informe o número.' }, { status: 400 });
      }

      try {
        const url = `https://api.w-api.app/v1/instance/pairing-code?instanceId=${integracao.instance_id_provider}&phoneNumber=${telefone}`;
        const r = await fetch(url, {
          headers: { 'Authorization': `Bearer ${integracao.api_key_provider}` },
          signal: AbortSignal.timeout(15000)
        });
        const data = await r.json().catch(() => null);
        const pairingCode = data?.pairingCode || data?.code;
        if (!r.ok || !pairingCode) {
          return Response.json({
            success: false,
            error: data?.message || `Falha ao gerar código de pareamento (HTTP ${r.status}). A instância pode já estar conectada.`
          }, { status: 400 });
        }
        await base44.asServiceRole.entities.WhatsAppIntegration.update(integracao.id, {
          status: 'pendente_qrcode',
          pairing_code: pairingCode,
          pairing_code_gerado_em: new Date().toISOString()
        });
        return Response.json({ success: true, pairingCode });
      } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
      }
    }

    // ========================================================================
    // AÇÃO: DESCONECTAR APARELHO (logout da sessão WhatsApp)
    // ========================================================================
    if (action === 'disconnect') {
      const integracao = await base44.asServiceRole.entities.WhatsAppIntegration.get(payload.integration_id);
      if (!integracao) return Response.json({ success: false, error: 'Integração não encontrada' }, { status: 404 });

      try {
        const url = `https://api.w-api.app/v1/instance/logout?instanceId=${integracao.instance_id_provider}`;
        const r = await fetch(url, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${integracao.api_key_provider}` },
          signal: AbortSignal.timeout(15000)
        });
        const data = await r.json().catch(() => null);
        if (!r.ok || data?.error === true) {
          return Response.json({
            success: false,
            error: data?.message || `Falha ao desconectar (HTTP ${r.status})`
          }, { status: 400 });
        }
        await base44.asServiceRole.entities.WhatsAppIntegration.update(integracao.id, {
          status: 'desconectado',
          ultima_atividade: new Date().toISOString()
        });
        console.log('[WAPI-INTEGRATOR] 📴 Instância desconectada:', integracao.instance_id_provider);
        return Response.json({ success: true, message: 'Aparelho desconectado' });
      } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
      }
    }

    return Response.json({ error: 'Ação inválida. Use: createInstance, listInstances, deleteInstance, getStatus, getStatusAll, getQrCode, getPairingCode ou disconnect' }, { status: 400 });

  } catch (error) {
    console.error('[WAPI-INTEGRATOR] ❌ Erro geral:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});
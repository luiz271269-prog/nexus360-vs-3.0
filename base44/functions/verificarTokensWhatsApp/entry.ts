import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Verificação Periódica de Tokens WhatsApp
 * 
 * Esta função deve ser executada periodicamente (ex: daily cron job)
 * para verificar a validade dos tokens de todas as instâncias WhatsApp ativas.
 * 
 * Funcionalidades:
 * - Verifica status de cada instância via API do provedor
 * - Atualiza status do token (válido/inválido/expirando)
 * - Marca instâncias com token inválido
 * - Registra data da última verificação
 * - Notifica administradores sobre tokens expirados
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Autenticação: apenas service role ou admin pode executar
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized: admin access required' }, { status: 403 });
    }

    console.log('[TOKEN_VERIFICATION] Iniciando verificação de tokens...');

    // Buscar todas as integrações WhatsApp ativas
    const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.list();
    
    const resultados = {
      total: integracoes.length,
      verificadas: 0,
      validas: 0,
      invalidas: 0,
      expirando: 0,
      erros: 0,
      detalhes: []
    };

    for (const integracao of integracoes) {
      try {
        console.log(`[TOKEN_VERIFICATION] Verificando: ${integracao.nome_instancia} (${integracao.api_provider})`);
        
        const resultado = await verificarTokenIntegracao(integracao, base44);
        resultados.verificadas++;
        
        if (resultado.status === 'valido') resultados.validas++;
        else if (resultado.status === 'invalido') resultados.invalidas++;
        else if (resultado.status === 'expirando') resultados.expirando++;
        
        resultados.detalhes.push({
          instancia: integracao.nome_instancia,
          provider: integracao.api_provider,
          status: resultado.status,
          mensagem: resultado.mensagem
        });

      } catch (error) {
        console.error(`[TOKEN_VERIFICATION] Erro ao verificar ${integracao.nome_instancia}:`, error);
        resultados.erros++;
        resultados.detalhes.push({
          instancia: integracao.nome_instancia,
          provider: integracao.api_provider,
          status: 'erro',
          mensagem: error.message
        });
      }
    }

    // Notificar administradores se houver tokens inválidos
    if (resultados.invalidas > 0) {
      await notificarAdmins(base44, resultados);
    }

    console.log('[TOKEN_VERIFICATION] Verificação concluída:', resultados);

    return Response.json({
      success: true,
      timestamp: new Date().toISOString(),
      resultados
    });

  } catch (error) {
    console.error('[TOKEN_VERIFICATION] Erro fatal:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});

/**
 * Verifica token de uma integração específica
 */
async function verificarTokenIntegracao(integracao, base44) {
  const provider = integracao.api_provider || 'z_api';
  const agora = new Date().toISOString();

  let statusToken = 'nao_verificado';
  let mensagem = '';
  let statusIntegracao = integracao.status;

  try {
    // Z-API: verificar via endpoint /status
    if (provider === 'z_api') {
      const url = `${integracao.base_url_provider}/instances/${integracao.instance_id_provider}/status`;
      const response = await fetch(url, {
        headers: {
          'Client-Token': integracao.security_client_token_header || ''
        }
      });

      if (response.ok) {
        const data = await response.json();
        statusToken = 'valido';
        mensagem = 'Token Z-API válido';
        
        // Atualizar status de conexão se disponível
        if (data.connected === true) {
          statusIntegracao = 'conectado';
        }
      } else if (response.status === 401 || response.status === 403) {
        statusToken = 'invalido';
        mensagem = 'Token Z-API inválido ou expirado';
        statusIntegracao = 'token_invalido';
      } else {
        statusToken = 'nao_verificado';
        mensagem = `Erro HTTP ${response.status}`;
      }
    }
    
    // W-API: verificar via endpoint /instance/status
    else if (provider === 'w_api') {
      const url = `${integracao.base_url_provider}/instance/status?instanceId=${integracao.instance_id_provider}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${integracao.api_key_provider}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        statusToken = 'valido';
        mensagem = 'Token W-API válido';
        
        // Atualizar status de conexão
        if (data.connected === true || data.status === 'connected') {
          statusIntegracao = 'conectado';
        }
      } else if (response.status === 401 || response.status === 403) {
        statusToken = 'invalido';
        mensagem = 'Token W-API inválido ou expirado';
        statusIntegracao = 'token_invalido';
      } else {
        statusToken = 'nao_verificado';
        mensagem = `Erro HTTP ${response.status}`;
      }
    }

    // Atualizar entidade com resultado da verificação
    await base44.asServiceRole.entities.WhatsAppIntegration.update(integracao.id, {
      token_status: statusToken,
      token_ultima_verificacao: agora,
      status: statusIntegracao
    });

    return { status: statusToken, mensagem };

  } catch (error) {
    console.error(`[TOKEN_VERIFICATION] Erro ao verificar ${integracao.nome_instancia}:`, error);
    
    // Marcar como erro na última verificação
    await base44.asServiceRole.entities.WhatsAppIntegration.update(integracao.id, {
      token_ultima_verificacao: agora
    });

    throw error;
  }
}

/**
 * Notifica administradores sobre tokens inválidos
 */
async function notificarAdmins(base44, resultados) {
  try {
    console.log('[TOKEN_VERIFICATION] Notificando administradores sobre tokens inválidos...');

    // Buscar todos os administradores
    const usuarios = await base44.asServiceRole.entities.User.list();
    const admins = usuarios.filter(u => u.role === 'admin');

    if (admins.length === 0) {
      console.warn('[TOKEN_VERIFICATION] Nenhum administrador encontrado para notificar');
      return;
    }

    const instanciasInvalidas = resultados.detalhes
      .filter(d => d.status === 'invalido')
      .map(d => `- ${d.instancia} (${d.provider}): ${d.mensagem}`)
      .join('\n');

    const mensagem = `
⚠️ ALERTA: Tokens WhatsApp Inválidos

${resultados.invalidas} instância(s) com token inválido detectada(s):

${instanciasInvalidas}

Acesse a Central de Comunicação para reconectar as instâncias afetadas.
    `.trim();

    // Criar evento de notificação para cada admin
    for (const admin of admins) {
      await base44.asServiceRole.entities.NotificationEvent.create({
        user_id: admin.id,
        tipo: 'system_alert',
        titulo: '⚠️ Tokens WhatsApp Inválidos',
        mensagem: mensagem,
        prioridade: 'alta',
        lido: false,
        metadata: {
          origem: 'verificacao_tokens',
          tokens_invalidos: resultados.invalidas
        }
      });
    }

    console.log(`[TOKEN_VERIFICATION] ${admins.length} administrador(es) notificado(s)`);

  } catch (error) {
    console.error('[TOKEN_VERIFICATION] Erro ao notificar administradores:', error);
  }
}
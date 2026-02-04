import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Hook para monitorar saúde de integrações WhatsApp em tempo real.
 * Detecta desconexões e notifica usuários com permissão.
 */
export function useIntegrationHealth(userPermissions) {
  const [integrations, setIntegrations] = useState([]);
  const [disconnectedCount, setDisconnectedCount] = useState(0);
  const [lastCheck, setLastCheck] = useState(null);

  // Carregar integrações que o usuário pode ver
  const loadIntegrations = useCallback(async () => {
    if (!userPermissions?.integracoes) return;

    try {
      const integrationIds = Object.keys(userPermissions.integracoes).filter(
        (id) => userPermissions.integracoes[id].can_view !== false
      );

      if (integrationIds.length === 0) return;

      const integs = await Promise.all(
        integrationIds.map((id) => 
          base44.entities.WhatsAppIntegration.get(id).catch(() => null)
        )
      );

      const validIntegrations = integs.filter(Boolean);
      setIntegrations(validIntegrations);

      // Contar desconectadas
      const disconnected = validIntegrations.filter(
        (i) => i.status !== 'conectado'
      );
      setDisconnectedCount(disconnected.length);
      setLastCheck(new Date());

    } catch (error) {
      console.error('[IntegrationHealth] Erro ao carregar:', error);
    }
  }, [userPermissions]);

  // Detectar mudanças de status e notificar
  const handleStatusChange = useCallback((event) => {
    if (event.type !== 'update') return;
    
    const integration = event.data;
    const hasAccess = userPermissions?.integracoes?.[integration.id]?.can_view !== false;
    
    if (!hasAccess) return;

    // Detectar mudança para desconectado
    const wasConnected = integrations.find(i => i.id === integration.id)?.status === 'conectado';
    const nowDisconnected = integration.status !== 'conectado';

    if (wasConnected && nowDisconnected) {
      // Criar notificação para o usuário
      createDisconnectionNotification(integration);
    }

    // Atualizar lista local
    setIntegrations(prev => 
      prev.map(i => i.id === integration.id ? integration : i)
    );
  }, [integrations, userPermissions]);

  // Criar notificação de desconexão
  const createDisconnectionNotification = async (integration) => {
    try {
      await base44.entities.NotificationEvent.create({
        tipo: 'integracao_desconectada',
        titulo: `📵 ${integration.nome_instancia} Desconectada`,
        mensagem: `A instância WhatsApp foi desconectada. Mensagens novas podem não chegar.`,
        prioridade: 'alta',
        lida: false,
        metadata: {
          integration_id: integration.id,
          integration_name: integration.nome_instancia,
          status: integration.status,
          disconnected_at: integration.last_disconnected_at || new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('[IntegrationHealth] Erro ao criar notificação:', error);
    }
  };

  // Carregar inicialmente
  useEffect(() => {
    loadIntegrations();
  }, [loadIntegrations]);

  // Subscribe para mudanças
  useEffect(() => {
    const unsubscribe = base44.entities.WhatsAppIntegration.subscribe(handleStatusChange);
    return unsubscribe;
  }, [handleStatusChange]);

  // Polling de backup (30s)
  useEffect(() => {
    const interval = setInterval(loadIntegrations, 30000);
    return () => clearInterval(interval);
  }, [loadIntegrations]);

  return {
    integrations,
    disconnectedCount,
    lastCheck,
    refresh: loadIntegrations
  };
}
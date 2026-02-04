import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { AlertCircle, Wifi, WifiOff, RefreshCw, Clock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

/**
 * Banner que exibe aviso quando a integração WhatsApp está desconectada.
 * Aparece na área de mensagens do chat.
 */
export default function IntegrationStatusBanner({ integrationId, userPermissions }) {
  const [integration, setIntegration] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!integrationId) {
      setLoading(false);
      return;
    }

    // Carregar status da integração
    const loadStatus = async () => {
      try {
        const integ = await base44.entities.WhatsAppIntegration.get(integrationId);
        setIntegration(integ);
      } catch (error) {
        console.error('[IntegrationStatus] Erro ao carregar:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStatus();

    // Subscribe para mudanças em tempo real
    const unsubscribe = base44.entities.WhatsAppIntegration.subscribe((event) => {
      if (event.id === integrationId) {
        setIntegration(event.data);
        
        // Notificar quando desconectar
        if (event.type === 'update' && event.data.status !== 'conectado') {
          toast.error(`📵 Instância ${event.data.nome_instancia} desconectada`, {
            description: 'Mensagens novas podem não chegar'
          });
        }
        
        // Notificar quando reconectar
        if (event.type === 'update' && event.data.status === 'conectado') {
          toast.success(`✅ Instância ${event.data.nome_instancia} reconectada`);
        }
      }
    });

    // Polling de backup (caso subscribe não funcione)
    const pollInterval = setInterval(loadStatus, 30000); // 30s

    return () => {
      unsubscribe();
      clearInterval(pollInterval);
    };
  }, [integrationId]);

  // Verificar se usuário tem permissão para ver este aviso
  const hasAccess = userPermissions?.integracoes?.[integrationId]?.can_view !== false;

  if (loading || !integration || !hasAccess) return null;

  // Só mostrar se NÃO estiver conectado
  if (integration.status === 'conectado') return null;

  const statusConfig = {
    desconectado: {
      icon: WifiOff,
      color: 'border-red-500 bg-red-50 text-red-900',
      iconColor: 'text-red-500',
      title: '📵 Instância Desconectada',
      message: 'Mensagens novas não chegam. Aguarde reconexão.'
    },
    pendente_qrcode: {
      icon: RefreshCw,
      color: 'border-yellow-500 bg-yellow-50 text-yellow-900',
      iconColor: 'text-yellow-500',
      title: '⚠️ QR Code Necessário',
      message: 'Escaneie o QR code no painel de configurações para reconectar.'
    },
    erro_conexao: {
      icon: AlertCircle,
      color: 'border-orange-500 bg-orange-50 text-orange-900',
      iconColor: 'text-orange-500',
      title: '⚠️ Erro de Conexão',
      message: 'Falha ao conectar com o provedor. Verifique configurações.'
    },
    reconectando: {
      icon: RefreshCw,
      color: 'border-blue-500 bg-blue-50 text-blue-900',
      iconColor: 'text-blue-500 animate-spin',
      title: '🔄 Reconectando...',
      message: 'Aguarde enquanto restabelecemos a conexão.'
    },
    token_invalido: {
      icon: AlertCircle,
      color: 'border-red-500 bg-red-50 text-red-900',
      iconColor: 'text-red-500',
      title: '🔒 Token Inválido',
      message: 'Token de autenticação expirado. Reconfigure no painel.'
    }
  };

  const config = statusConfig[integration.status] || statusConfig.desconectado;
  const Icon = config.icon;

  const formatTime = (isoString) => {
    if (!isoString) return null;
    const date = new Date(isoString);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const disconnectedTime = formatTime(integration.last_disconnected_at || integration.ultima_atividade);

  return (
    <Alert className={`mb-3 ${config.color} border-2`}>
      <Icon className={`h-5 w-5 ${config.iconColor}`} />
      <AlertDescription className="ml-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="font-semibold text-sm mb-1">
              {config.title} - {integration.nome_instancia}
            </p>
            <p className="text-xs mb-2">{config.message}</p>
            {disconnectedTime && (
              <div className="flex items-center gap-1 text-xs opacity-75">
                <Clock className="w-3 h-3" />
                <span>Desde {disconnectedTime}</span>
              </div>
            )}
          </div>

          {integration.status === 'pendente_qrcode' && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={() => {
                window.open('/configuracoes-whatsapp', '_blank');
              }}
            >
              Abrir Config
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
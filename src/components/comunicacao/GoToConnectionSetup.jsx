import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Phone, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  ExternalLink,
  Key,
  RefreshCw,
  Trash2,
  Webhook
} from 'lucide-react';
import { toast } from 'sonner';

const GoToLogo = () => (
  <svg viewBox="0 0 120 40" className="h-6" fill="currentColor">
    <rect x="0" y="28" width="40" height="8" fill="#FFD700"/>
    <text x="5" y="22" fontFamily="Arial, sans-serif" fontSize="20" fontWeight="bold">GoTo</text>
  </svg>
);

export default function GoToConnectionSetup({ integracoes = [], onRecarregar }) {
  const [connecting, setConnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(null);
  const [registeringWebhook, setRegisteringWebhook] = useState(null);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const result = await base44.functions.invoke('gotoInitiateOAuth', {});
      
      if (result.data.success && result.data.authorization_url) {
        // Abrir popup OAuth
        window.open(result.data.authorization_url, 'GoTo OAuth', 'width=600,height=700');
        toast.info('🔐 Complete a autenticação na janela do GoTo');
      } else {
        toast.error('Erro ao iniciar OAuth');
      }
    } catch (error) {
      console.error('[GOTO SETUP] Erro:', error);
      toast.error(`Erro: ${error.message}`);
    } finally {
      setConnecting(false);
    }
  };

  const handleRefreshToken = async (integration) => {
    setRefreshing(integration.id);
    try {
      const result = await base44.functions.invoke('gotoRefreshToken', {
        integration_id: integration.id
      });
      
      if (result.data.success) {
        toast.success('✅ Token renovado!');
        if (onRecarregar) await onRecarregar();
      } else {
        toast.error('Erro ao renovar token');
      }
    } catch (error) {
      console.error('[GOTO REFRESH] Erro:', error);
      toast.error(`Erro: ${error.message}`);
    } finally {
      setRefreshing(null);
    }
  };

  const handleRegisterWebhook = async (integration) => {
    setRegisteringWebhook(integration.id);
    try {
      const result = await base44.functions.invoke('gotoRegisterWebhook', {
        integration_id: integration.id
      });
      
      if (result.data.success) {
        toast.success('✅ Webhook registrado!');
        if (onRecarregar) await onRecarregar();
      } else {
        toast.error('Erro ao registrar webhook');
      }
    } catch (error) {
      console.error('[GOTO WEBHOOK] Erro:', error);
      toast.error(`Erro: ${error.message}`);
    } finally {
      setRegisteringWebhook(null);
    }
  };

  const handleDelete = async (integration) => {
    if (!confirm(`Excluir conexão ${integration.nome_instancia}?`)) return;

    try {
      await base44.entities.GoToIntegration.delete(integration.id);
      toast.success('Conexão excluída!');
      if (onRecarregar) await onRecarregar();
    } catch (error) {
      console.error('[GOTO DELETE] Erro:', error);
      toast.error('Erro ao excluir');
    }
  };

  const isTokenExpiring = (integration) => {
    if (!integration.token_expires_at) return false;
    const now = new Date();
    const expiresAt = new Date(integration.token_expires_at);
    const hoursUntilExpiry = (expiresAt - now) / (1000 * 60 * 60);
    return hoursUntilExpiry < 24;
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg">
                <Phone className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <GoToLogo />
                  <Badge className="bg-yellow-100 text-yellow-800">Connect</Badge>
                </div>
                <h2 className="text-xl font-bold text-yellow-900">Telefonia & SMS</h2>
                <p className="text-yellow-700 mt-1">
                  Configure sua linha GoTo para SMS e chamadas
                </p>
                {integracoes.length > 0 && (
                  <div className="flex gap-2 mt-3">
                    <Badge className="bg-green-100 text-green-800">
                      {integracoes.filter(i => i.status === 'conectado').length} Conectadas
                    </Badge>
                    <Badge className="bg-blue-100 text-blue-800">
                      {integracoes.length} Total
                    </Badge>
                  </div>
                )}
              </div>
            </div>
            <Button
              onClick={handleConnect}
              disabled={connecting}
              className="bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700"
            >
              {connecting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ExternalLink className="w-4 h-4 mr-2" />
              )}
              Conectar GoTo
            </Button>
          </div>
        </CardContent>
      </Card>

      <Alert className="bg-blue-50 border-blue-200">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-sm text-blue-800">
          <strong>Pré-requisitos:</strong> Configure GOTO_CLIENT_ID e GOTO_CLIENT_SECRET nas variáveis de ambiente antes de conectar.
        </AlertDescription>
      </Alert>

      {integracoes.length > 0 && (
        <div className="grid gap-4">
          {integracoes.map((integracao) => (
            <Card key={integracao.id} className="border-yellow-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Phone className="w-4 h-4 text-yellow-600" />
                    {integracao.nome_instancia}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {integracao.status === 'conectado' ? (
                      <Badge className="bg-green-100 text-green-700">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Conectado
                      </Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-700">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Desconectado
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">Telefone:</span>
                    <p className="font-semibold">{integracao.phone_number || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Account Key:</span>
                    <p className="font-mono text-xs">{integracao.account_key || 'N/A'}</p>
                  </div>
                  {integracao.token_expires_at && (
                    <div className="col-span-2">
                      <span className="text-slate-500">Token expira em:</span>
                      <p className={`text-sm ${isTokenExpiring(integracao) ? 'text-orange-600 font-semibold' : ''}`}>
                        {new Date(integracao.token_expires_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  )}
                  {integracao.notification_channel_id && (
                    <div className="col-span-2">
                      <span className="text-slate-500">Webhook:</span>
                      <p className="font-mono text-xs text-green-600">
                        ✓ Channel ID: {integracao.notification_channel_id}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-3 border-t">
                  {isTokenExpiring(integracao) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRefreshToken(integracao)}
                      disabled={refreshing === integracao.id}
                      className="border-orange-300 text-orange-700"
                    >
                      {refreshing === integracao.id ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3 h-3 mr-1" />
                      )}
                      Renovar Token
                    </Button>
                  )}
                  
                  {!integracao.notification_channel_id && integracao.status === 'conectado' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRegisterWebhook(integracao)}
                      disabled={registeringWebhook === integracao.id}
                      className="border-blue-300 text-blue-700"
                    >
                      {registeringWebhook === integracao.id ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <Webhook className="w-3 h-3 mr-1" />
                      )}
                      Registrar Webhook
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(integracao)}
                    className="border-red-300 text-red-700 ml-auto"
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Excluir
                  </Button>
                </div>

                {integracao.estatisticas && (
                  <div className="grid grid-cols-2 gap-2 pt-3 border-t">
                    <div className="bg-green-50 rounded-lg p-2 text-center">
                      <div className="text-[10px] text-slate-500">SMS Enviados</div>
                      <div className="font-bold text-green-600">
                        {integracao.estatisticas.total_sms_enviados || 0}
                      </div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-2 text-center">
                      <div className="text-[10px] text-slate-500">SMS Recebidos</div>
                      <div className="font-bold text-blue-600">
                        {integracao.estatisticas.total_sms_recebidos || 0}
                      </div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-2 text-center">
                      <div className="text-[10px] text-slate-500">Chamadas</div>
                      <div className="font-bold text-purple-600">
                        {(integracao.estatisticas.total_chamadas_recebidas || 0) + 
                         (integracao.estatisticas.total_chamadas_realizadas || 0)}
                      </div>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-2 text-center">
                      <div className="text-[10px] text-slate-500">Tempo Médio</div>
                      <div className="font-bold text-orange-600">
                        {Math.round((integracao.estatisticas.tempo_medio_chamada_segundos || 0) / 60)}min
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
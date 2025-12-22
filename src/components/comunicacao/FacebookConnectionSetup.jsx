import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  ExternalLink,
  Trash2,
  Webhook,
  Edit2
} from 'lucide-react';
import { toast } from 'sonner';

const FacebookLogo = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

export default function FacebookConnectionSetup({ integracoes = [], onRecarregar }) {
  const [connecting, setConnecting] = useState(false);
  const [registeringWebhook, setRegisteringWebhook] = useState(null);
  const [editingNameId, setEditingNameId] = useState(null);
  const [editingName, setEditingName] = useState('');

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const result = await base44.functions.invoke('facebookInitiateOAuth', {});
      
      if (result.data.success && result.data.authorization_url) {
        window.open(result.data.authorization_url, 'Facebook OAuth', 'width=600,height=700');
        toast.info('🔐 Complete a autenticação do Facebook');
      } else {
        toast.error('Erro ao iniciar OAuth');
      }
    } catch (error) {
      console.error('[FACEBOOK SETUP] Erro:', error);
      toast.error(`Erro: ${error.message}`);
    } finally {
      setConnecting(false);
    }
  };

  const handleRegisterWebhook = async (integration) => {
    setRegisteringWebhook(integration.id);
    try {
      const result = await base44.functions.invoke('facebookRegisterWebhook', {
        integration_id: integration.id
      });
      
      if (result.data.success) {
        toast.success('✅ Webhook registrado!');
        if (onRecarregar) await onRecarregar();
      } else {
        toast.error('Erro ao registrar webhook');
      }
    } catch (error) {
      console.error('[FACEBOOK WEBHOOK] Erro:', error);
      toast.error(`Erro: ${error.message}`);
    } finally {
      setRegisteringWebhook(null);
    }
  };

  const handleDelete = async (integration) => {
    if (!confirm(`Excluir conexão ${integration.nome_instancia}?`)) return;

    try {
      await base44.entities.FacebookIntegration.delete(integration.id);
      toast.success('Conexão excluída!');
      if (onRecarregar) await onRecarregar();
    } catch (error) {
      console.error('[FACEBOOK DELETE] Erro:', error);
      toast.error('Erro ao excluir');
    }
  };

  const handleUpdateName = async (integrationId) => {
    if (!editingName.trim()) {
      toast.error('Nome não pode estar vazio');
      return;
    }

    try {
      await base44.entities.FacebookIntegration.update(integrationId, { 
        nome_instancia: editingName.trim() 
      });
      toast.success('✅ Nome atualizado!');
      setEditingNameId(null);
      setEditingName('');
      if (onRecarregar) await onRecarregar();
    } catch (error) {
      console.error('[FACEBOOK UPDATE] Erro:', error);
      toast.error('Erro ao atualizar nome');
    }
  };

  const startEditingName = (integration) => {
    setEditingNameId(integration.id);
    setEditingName(integration.nome_instancia || '');
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <FacebookLogo />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-xl font-bold text-blue-900">Facebook Messenger</h2>
                  <Badge className="bg-blue-100 text-blue-800">Meta API</Badge>
                </div>
                <p className="text-blue-700 mt-1">
                  Configure sua Página do Facebook para Messenger
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
              className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
            >
              {connecting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ExternalLink className="w-4 h-4 mr-2" />
              )}
              Conectar Facebook
            </Button>
          </div>
        </CardContent>
      </Card>

      <Alert className="bg-blue-50 border-blue-200">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-sm text-blue-800">
          <strong>Pré-requisitos:</strong> Configure META_APP_ID e META_APP_SECRET, e gerencie uma Página do Facebook.
        </AlertDescription>
      </Alert>

      {integracoes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <div className="flex justify-center mb-3">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <FacebookLogo />
              </div>
            </div>
            <p className="text-sm text-slate-600 font-medium">Nenhuma conexão Facebook</p>
            <p className="text-xs text-slate-400 mt-1">Clique em "Conectar Facebook" acima para iniciar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {integracoes.map((integracao) => (
            <Card key={integracao.id} className="border-blue-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  {editingNameId === integracao.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUpdateName(integracao.id);
                          if (e.key === 'Escape') {
                            setEditingNameId(null);
                            setEditingName('');
                          }
                        }}
                        className="text-sm h-8"
                        placeholder="Nome da conexão"
                        autoFocus
                      />
                      <Button
                        size="sm"
                        onClick={() => handleUpdateName(integracao.id)}
                        className="h-8"
                      >
                        Salvar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingNameId(null);
                          setEditingName('');
                        }}
                        className="h-8"
                      >
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <CardTitle className="text-base flex items-center gap-2 flex-1">
                      <FacebookLogo />
                      <span>{integracao.nome_instancia || 'Sem Nome'}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => startEditingName(integracao)}
                        className="h-6 w-6 ml-1"
                      >
                        <Edit2 className="w-3 h-3 text-slate-400" />
                      </Button>
                    </CardTitle>
                  )}
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
                    <span className="text-slate-500">Page ID:</span>
                    <p className="font-mono text-xs">{integracao.page_id}</p>
                  </div>
                  {integracao.webhook_url && (
                    <div className="col-span-2">
                      <span className="text-slate-500">Webhook:</span>
                      <p className="font-mono text-xs text-green-600">
                        ✓ {integracao.webhook_url}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-3 border-t">
                  {!integracao.webhook_url && integracao.status === 'conectado' && (
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
                    <div className="bg-blue-50 rounded-lg p-2 text-center">
                      <div className="text-[10px] text-slate-500">Enviadas</div>
                      <div className="font-bold text-blue-600">
                        {integracao.estatisticas.total_mensagens_enviadas || 0}
                      </div>
                    </div>
                    <div className="bg-indigo-50 rounded-lg p-2 text-center">
                      <div className="text-[10px] text-slate-500">Recebidas</div>
                      <div className="font-bold text-indigo-600">
                        {integracao.estatisticas.total_mensagens_recebidas || 0}
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
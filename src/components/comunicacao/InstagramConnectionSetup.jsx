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

const InstagramLogo = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z"/>
  </svg>
);

export default function InstagramConnectionSetup({ integracoes = [], onRecarregar }) {
  const [connecting, setConnecting] = useState(false);
  const [registeringWebhook, setRegisteringWebhook] = useState(null);
  const [editingNameId, setEditingNameId] = useState(null);
  const [editingName, setEditingName] = useState('');

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const result = await base44.functions.invoke('instagramInitiateOAuth', {});
      
      if (result.data.success && result.data.authorization_url) {
        window.open(result.data.authorization_url, 'Instagram OAuth', 'width=600,height=700');
        toast.info('🔐 Complete a autenticação do Instagram/Facebook');
      } else {
        toast.error('Erro ao iniciar OAuth');
      }
    } catch (error) {
      console.error('[INSTAGRAM SETUP] Erro:', error);
      toast.error(`Erro: ${error.message}`);
    } finally {
      setConnecting(false);
    }
  };

  const handleRegisterWebhook = async (integration) => {
    setRegisteringWebhook(integration.id);
    try {
      const result = await base44.functions.invoke('instagramRegisterWebhook', {
        integration_id: integration.id
      });
      
      if (result.data.success) {
        toast.success('✅ Webhook registrado!');
        if (onRecarregar) await onRecarregar();
      } else {
        toast.error('Erro ao registrar webhook');
      }
    } catch (error) {
      console.error('[INSTAGRAM WEBHOOK] Erro:', error);
      toast.error(`Erro: ${error.message}`);
    } finally {
      setRegisteringWebhook(null);
    }
  };

  const handleDelete = async (integration) => {
    if (!confirm(`Excluir conexão ${integration.nome_instancia}?`)) return;

    try {
      await base44.entities.InstagramIntegration.delete(integration.id);
      toast.success('Conexão excluída!');
      if (onRecarregar) await onRecarregar();
    } catch (error) {
      console.error('[INSTAGRAM DELETE] Erro:', error);
      toast.error('Erro ao excluir');
    }
  };

  const handleUpdateName = async (integrationId) => {
    if (!editingName.trim()) {
      toast.error('Nome não pode estar vazio');
      return;
    }

    try {
      await base44.entities.InstagramIntegration.update(integrationId, { 
        nome_instancia: editingName.trim() 
      });
      toast.success('✅ Nome atualizado!');
      setEditingNameId(null);
      setEditingName('');
      if (onRecarregar) await onRecarregar();
    } catch (error) {
      console.error('[INSTAGRAM UPDATE] Erro:', error);
      toast.error('Erro ao atualizar nome');
    }
  };

  const startEditingName = (integration) => {
    setEditingNameId(integration.id);
    setEditingName(integration.nome_instancia || '');
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-r from-pink-50 to-purple-50 border-pink-200">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <InstagramLogo />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-xl font-bold text-pink-900">Instagram Direct</h2>
                  <Badge className="bg-pink-100 text-pink-800">Meta API</Badge>
                </div>
                <p className="text-pink-700 mt-1">
                  Configure sua conta comercial do Instagram
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
              className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700"
            >
              {connecting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ExternalLink className="w-4 h-4 mr-2" />
              )}
              Conectar Instagram
            </Button>
          </div>
        </CardContent>
      </Card>

      <Alert className="bg-blue-50 border-blue-200">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-sm text-blue-800">
          <strong>Pré-requisitos:</strong> Configure META_APP_ID e META_APP_SECRET, e tenha uma conta Instagram Business vinculada a uma Página do Facebook.
        </AlertDescription>
      </Alert>

      {integracoes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <div className="flex justify-center mb-3">
              <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center">
                <InstagramLogo />
              </div>
            </div>
            <p className="text-sm text-slate-600 font-medium">Nenhuma conexão Instagram</p>
            <p className="text-xs text-slate-400 mt-1">Clique em "Conectar Instagram" acima para iniciar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {integracoes.map((integracao) => (
            <Card key={integracao.id} className="border-pink-200">
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
                      <InstagramLogo />
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
                    <span className="text-slate-500">Business Account:</span>
                    <p className="font-mono text-xs">{integracao.instagram_business_account_id}</p>
                  </div>
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
                    <div className="bg-pink-50 rounded-lg p-2 text-center">
                      <div className="text-[10px] text-slate-500">Enviadas</div>
                      <div className="font-bold text-pink-600">
                        {integracao.estatisticas.total_mensagens_enviadas || 0}
                      </div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-2 text-center">
                      <div className="text-[10px] text-slate-500">Recebidas</div>
                      <div className="font-bold text-purple-600">
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
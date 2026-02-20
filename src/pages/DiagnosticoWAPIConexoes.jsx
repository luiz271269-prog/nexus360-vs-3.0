import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, RefreshCw, Loader2, CheckCircle2, XCircle, Wifi, WifiOff, Power } from 'lucide-react';
import { toast } from 'sonner';

export default function DiagnosticoWAPIConexoes() {
  const [instancias, setInstancias] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [reconectandoId, setReconectandoId] = useState(null);

  useEffect(() => {
    carregarInstancias();
  }, []);

  const carregarInstancias = async () => {
    setCarregando(true);
    try {
      const integracoes = await base44.entities.WhatsAppIntegration.filter({
        api_provider: 'w_api'
      });
      
      const comDiagnostico = await Promise.all(
        integracoes.map(async (integ) => {
          try {
            // Chamar função para verificar status real no W-API
            const resposta = await base44.functions.invoke('testarConexaoWapi', {
              instanceId: integ.instance_id_provider,
              apiKey: integ.api_key_provider
            });
            
            return {
              ...integ,
              statusReal: resposta?.data?.status || 'desconhecido',
              ultimaVerificacao: new Date().toLocaleTimeString('pt-BR')
            };
          } catch (error) {
            return {
              ...integ,
              statusReal: 'erro_verificacao',
              erroDetalhe: error.message
            };
          }
        })
      );
      
      setInstancias(comDiagnostico);
    } catch (error) {
      toast.error(`❌ Erro ao carregar instâncias: ${error.message}`);
    } finally {
      setCarregando(false);
    }
  };

  const reconectar = async (instancia) => {
    setReconectandoId(instancia.id);
    try {
      // Chamar função para reconectar
      const resposta = await base44.functions.invoke('sincronizarInstanciasWapiIntegrador', {
        instanceId: instancia.instance_id_provider,
        integrationId: instancia.id,
        force: true
      });

      if (resposta?.data?.success) {
        // Atualizar status no banco
        await base44.entities.WhatsAppIntegration.update(instancia.id, {
          status: 'conectado',
          ultima_atividade: new Date().toISOString(),
          token_status: 'valido'
        });
        
        toast.success(`✅ ${instancia.nome_instancia} reconectado!`);
        setTimeout(carregarInstancias, 1000);
      } else {
        toast.error(`❌ Falha ao reconectar: ${resposta?.data?.erro}`);
      }
    } catch (error) {
      toast.error(`❌ ${error.message}`);
    } finally {
      setReconectandoId(null);
    }
  };

  const obterCorStatus = (status) => {
    if (status === 'conectado') return 'bg-green-500';
    if (status === 'desconectado') return 'bg-red-500';
    if (status === 'erro_verificacao') return 'bg-yellow-500';
    return 'bg-slate-500';
  };

  const obterIconeStatus = (status) => {
    if (status === 'conectado') return <CheckCircle2 className="w-5 h-5 text-green-600" />;
    if (status === 'desconectado') return <WifiOff className="w-5 h-5 text-red-600" />;
    return <AlertCircle className="w-5 h-5 text-yellow-600" />;
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Diagnóstico W-API</h1>
        <Button onClick={carregarInstancias} disabled={carregando}>
          {carregando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Atualizar
        </Button>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Total: <strong>{instancias.length} instâncias</strong> • 
          Conectadas: <strong className="text-green-600">{instancias.filter(i => i.statusReal === 'conectado').length}</strong> • 
          Desconectadas: <strong className="text-red-600">{instancias.filter(i => i.statusReal === 'desconectado').length}</strong>
        </AlertDescription>
      </Alert>

      <div className="grid gap-4">
        {instancias.map((instancia) => (
          <Card key={instancia.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full ${obterCorStatus(instancia.statusReal)}`} />
                  <div>
                    <CardTitle className="text-lg">{instancia.nome_instancia}</CardTitle>
                    <p className="text-sm text-slate-500">
                      Instance ID: {instancia.instance_id_provider}
                    </p>
                  </div>
                </div>
                <Badge className={obterCorStatus(instancia.statusReal) + ' text-white'}>
                  {instancia.statusReal.toUpperCase()}
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-600">📱 Telefone (DB)</p>
                  <p className="font-mono">{instancia.numero_telefone}</p>
                </div>
                <div>
                  <p className="text-slate-600">📱 Telefone (W-API)</p>
                  <p className="font-mono">{instancia.statusReal === 'conectado' ? instancia.numero_telefone : 'Não conectado'}</p>
                </div>
                <div>
                  <p className="text-slate-600">Status (DB)</p>
                  <p><Badge variant="outline">{instancia.status}</Badge></p>
                </div>
                <div>
                  <p className="text-slate-600">Status (W-API)</p>
                  <p><Badge variant="outline">{instancia.statusReal}</Badge></p>
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <p className="text-sm text-slate-600">🔗 Webhook URL</p>
                <p className="text-xs font-mono bg-slate-100 p-2 rounded break-all">
                  {instancia.webhook_url}
                </p>
              </div>

              {instancia.statusReal === 'desconectado' && (
                <Button 
                  onClick={() => reconectar(instancia)}
                  disabled={reconectandoId === instancia.id}
                  className="w-full bg-amber-500 hover:bg-amber-600"
                >
                  {reconectandoId === instancia.id ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Power className="w-4 h-4 mr-2" />
                  )}
                  Reconectar Instância
                </Button>
              )}

              {instancia.statusReal === 'conectado' && (
                <div className="bg-green-50 border border-green-200 rounded p-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <span className="text-sm text-green-800">Instância conectada e operacional</span>
                </div>
              )}

              {instancia.erroDetalhe && (
                <div className="bg-red-50 border border-red-200 rounded p-3">
                  <p className="text-sm text-red-800 font-semibold">⚠️ Erro na verificação</p>
                  <p className="text-xs text-red-700 mt-1">{instancia.erroDetalhe}</p>
                </div>
              )}

              <p className="text-xs text-slate-400">
                ⏱️ Última verificação: {instancia.ultimaVerificacao}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {instancias.length === 0 && !carregando && (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600">Nenhuma instância W-API encontrada</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Loader2, Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export default function DiagnosticoWebhookWAPICompleto() {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [integracoes, setIntegracoes] = useState([]);

  const WEBHOOK_URL = `https://${window.location.hostname}/functions/webhookWapi`;

  const buscarIntegracoes = async () => {
    try {
      const ints = await base44.entities.WhatsAppIntegration.filter(
        { api_provider: 'w_api' },
        '-created_date',
        10
      );
      setIntegracoes(ints);
      return ints;
    } catch (error) {
      console.error('Erro ao buscar integrações:', error);
      toast.error('Erro ao buscar integrações W-API');
      return [];
    }
  };

  const verificarWebhook = async (integracao) => {
    try {
      const baseUrl = integracao.base_url_provider || 'https://api.w-api.app/v1';
      const instanceId = integracao.instance_id_provider;
      const token = integracao.api_key_provider;

      const response = await fetch(
        `${baseUrl}/instance/webhook?instanceId=${instanceId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();
      
      return {
        sucesso: response.ok,
        webhookAtual: data.webhook || data.webhookUrl || null,
        status: data.status || 'unknown',
        detalhes: data
      };
    } catch (error) {
      return {
        sucesso: false,
        erro: error.message
      };
    }
  };

  const registrarWebhook = async (integracao) => {
    try {
      const baseUrl = integracao.base_url_provider || 'https://api.w-api.app/v1';
      const instanceId = integracao.instance_id_provider;
      const token = integracao.api_key_provider;

      const response = await fetch(
        `${baseUrl}/instance/webhook?instanceId=${instanceId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            webhook: WEBHOOK_URL
          })
        }
      );

      const data = await response.json();
      
      return {
        sucesso: response.ok,
        mensagem: data.message || 'Webhook registrado',
        detalhes: data
      };
    } catch (error) {
      return {
        sucesso: false,
        erro: error.message
      };
    }
  };

  const executarDiagnostico = async () => {
    setLoading(true);
    const resultados = [];

    try {
      // 1. Buscar integrações W-API
      const ints = await buscarIntegracoes();
      
      if (ints.length === 0) {
        setResultado({
          erro: 'Nenhuma integração W-API encontrada',
          integracoes: []
        });
        return;
      }

      // 2. Verificar cada integração
      for (const integracao of ints) {
        const verificacao = await verificarWebhook(integracao);
        
        const webhookCorreto = verificacao.webhookAtual === WEBHOOK_URL;
        
        resultados.push({
          integracao,
          verificacao,
          webhookCorreto,
          webhookEsperado: WEBHOOK_URL
        });
      }

      setResultado({
        sucesso: true,
        integracoes: resultados,
        webhookUrl: WEBHOOK_URL
      });

    } catch (error) {
      toast.error('Erro no diagnóstico: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegistrarWebhook = async (integracao) => {
    const confirmacao = confirm(
      `Registrar webhook para ${integracao.nome_instancia}?\n\nURL: ${WEBHOOK_URL}`
    );

    if (!confirmacao) return;

    setLoading(true);
    try {
      const resultado = await registrarWebhook(integracao);
      
      if (resultado.sucesso) {
        toast.success('Webhook registrado com sucesso!');
        // Reexecutar diagnóstico
        await executarDiagnostico();
      } else {
        toast.error('Erro ao registrar webhook: ' + (resultado.erro || 'Desconhecido'));
      }
    } catch (error) {
      toast.error('Erro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const copiarUrl = () => {
    navigator.clipboard.writeText(WEBHOOK_URL);
    toast.success('URL copiada!');
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>🔬 Diagnóstico Webhook W-API</span>
          <Button
            onClick={executarDiagnostico}
            disabled={loading}
            size="sm"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Diagnosticando...
              </>
            ) : (
              'Executar Diagnóstico'
            )}
          </Button>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* URL do Webhook */}
        <div className="p-4 bg-slate-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-slate-700">
              URL do Webhook:
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={copiarUrl}
            >
              <Copy className="w-4 h-4 mr-1" />
              Copiar
            </Button>
          </div>
          <code className="text-xs bg-white px-3 py-2 rounded border block break-all">
            {WEBHOOK_URL}
          </code>
        </div>

        {/* Resultados */}
        {resultado?.erro && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-900">{resultado.erro}</p>
              </div>
            </div>
          </div>
        )}

        {resultado?.integracoes && resultado.integracoes.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Integrações W-API</h3>
            
            {resultado.integracoes.map((item, index) => (
              <Card key={index} className={`${
                item.webhookCorreto ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'
              }`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">
                        {item.integracao.nome_instancia}
                      </CardTitle>
                      {item.webhookCorreto ? (
                        <Badge className="bg-green-500">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Webhook OK
                        </Badge>
                      ) : (
                        <Badge className="bg-orange-500">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Webhook Incorreto
                        </Badge>
                      )}
                    </div>
                    
                    {!item.webhookCorreto && (
                      <Button
                        onClick={() => handleRegistrarWebhook(item.integracao)}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700"
                        disabled={loading}
                      >
                        Registrar Webhook
                      </Button>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {/* Status da Integração */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-slate-600">Status:</span>
                      <Badge className="ml-2" variant="outline">
                        {item.integracao.status}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-slate-600">Instance ID:</span>
                      <code className="ml-2 text-xs bg-slate-100 px-2 py-1 rounded">
                        {item.integracao.instance_id_provider?.substring(0, 12)}...
                      </code>
                    </div>
                  </div>

                  {/* Webhook Atual */}
                  <div>
                    <p className="text-sm font-semibold text-slate-700 mb-1">
                      Webhook Atual:
                    </p>
                    {item.verificacao.webhookAtual ? (
                      <code className="text-xs bg-white px-3 py-2 rounded border block break-all">
                        {item.verificacao.webhookAtual}
                      </code>
                    ) : (
                      <p className="text-sm text-orange-600 italic">
                        Nenhum webhook registrado
                      </p>
                    )}
                  </div>

                  {/* Webhook Esperado (se diferente) */}
                  {!item.webhookCorreto && (
                    <div>
                      <p className="text-sm font-semibold text-slate-700 mb-1">
                        Webhook Esperado:
                      </p>
                      <code className="text-xs bg-green-50 px-3 py-2 rounded border border-green-200 block break-all">
                        {item.webhookEsperado}
                      </code>
                    </div>
                  )}

                  {/* Erro */}
                  {item.verificacao.erro && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded">
                      <p className="text-sm text-red-700">
                        <strong>Erro:</strong> {item.verificacao.erro}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Instruções Manuais */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-semibold text-blue-900 mb-2">
            📋 Registro Manual (se automático falhar)
          </h4>
          <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
            <li>Acesse o painel da W-API</li>
            <li>Vá em Configurações → Webhooks</li>
            <li>Cole a URL acima no campo "Webhook URL"</li>
            <li>Ative os eventos: <code className="bg-white px-1 rounded">ReceivedCallback</code></li>
            <li>Salve as alterações</li>
          </ol>
        </div>

        {/* Teste de Envio */}
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <h4 className="font-semibold text-purple-900 mb-2">
            🧪 Como Testar
          </h4>
          <ol className="text-sm text-purple-800 space-y-1 list-decimal list-inside">
            <li>Envie uma mensagem de teste para o WhatsApp W-API</li>
            <li>Verifique os logs em: Dashboard → Code → Functions → webhookWapi</li>
            <li>Procure por: <code className="bg-white px-1 rounded">[WAPI] 📥 Payload:</code></li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
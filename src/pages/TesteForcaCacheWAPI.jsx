import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Zap, AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function TesteForcaCacheWAPI() {
  const [testando, setTestando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const forcarRedeployCache = async () => {
    setTestando(true);
    setResultado(null);

    try {
      // 1. Buscar integração
      const integracoes = await base44.entities.WhatsAppIntegration.list();
      if (integracoes.length === 0) {
        toast.error('Nenhuma integração W-API encontrada');
        setTestando(false);
        return;
      }

      const integracao = integracoes[0];
      const webhookUrl = integracao.webhook_url;

      // 2. Testar GET com cache-busting
      const timestampCache = Date.now();
      const getUrl = `${webhookUrl}?v=${timestampCache}&cache_bust=${Math.random()}`;
      
      console.log('🔄 Testando GET com cache-busting:', getUrl);
      
      const getResponse = await fetch(getUrl, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });

      const getResult = await getResponse.json();
      
      setResultado({
        url_testada: getUrl,
        status: getResponse.status,
        version: getResult.version || 'VERSÃO NÃO IDENTIFICADA',
        build_date: getResult.build_date || 'N/A',
        auth_method: getResult.auth_method || 'N/A',
        response_completa: getResult,
        versao_esperada: 'v22.0.0-FORCE-REDEPLOY',
        versao_match: getResult.version === 'v22.0.0-FORCE-REDEPLOY'
      });

      if (getResult.version === 'v22.0.0-FORCE-REDEPLOY') {
        toast.success('✅ Versão v22 está ATIVA!');
      } else {
        toast.error(`❌ Versão antiga detectada: ${getResult.version || 'desconhecida'}`);
      }

    } catch (error) {
      console.error('[TESTE-CACHE] Erro:', error);
      toast.error('Erro: ' + error.message);
      setResultado({
        erro: error.message,
        stack: error.stack
      });
    } finally {
      setTestando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <Card className="border-2 border-orange-500">
          <CardHeader className="bg-orange-50">
            <CardTitle className="flex items-center gap-3 text-2xl">
              <RefreshCw className="w-7 h-7 text-orange-600" />
              Teste de Força de Cache W-API
            </CardTitle>
            <p className="text-slate-600 mt-2">
              Valida se a versão v22.0.0 está realmente ativa, ignorando cache do Deno Deploy.
            </p>
          </CardHeader>
        </Card>

        {/* Instruções */}
        <Alert className="bg-blue-50 border-blue-300">
          <AlertTriangle className="h-4 w-4 text-blue-700" />
          <AlertDescription className="text-blue-800">
            <strong>O que este teste faz:</strong>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Adiciona parâmetros de cache-busting à URL (?v=timestamp)</li>
              <li>Força headers HTTP que invalidam cache</li>
              <li>Verifica a versão retornada pelo GET do webhook</li>
              <li>Compara com a versão esperada (v22.0.0-FORCE-REDEPLOY)</li>
            </ul>
          </AlertDescription>
        </Alert>

        {/* Botão de Teste */}
        <div className="flex justify-center">
          <Button
            onClick={forcarRedeployCache}
            disabled={testando}
            size="lg"
            className="bg-orange-600 hover:bg-orange-700 text-white gap-3"
          >
            {testando ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Testando...
              </>
            ) : (
              <>
                <Zap className="w-5 h-5" />
                Testar Versão Ativa (Ignore Cache)
              </>
            )}
          </Button>
        </div>

        {/* Resultados */}
        {resultado && (
          <Card className={`border-2 ${resultado.versao_match ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-lg">
                {resultado.versao_match ? (
                  <>
                    <CheckCircle className="w-6 h-6 text-green-600" />
                    <span className="text-green-900">✅ Versão v22 Confirmada!</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-6 h-6 text-red-600" />
                    <span className="text-red-900">❌ Versão Antiga Detectada</span>
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Comparação de Versões */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-white rounded-lg border">
                  <div className="text-xs text-slate-500 mb-1">Versão Esperada:</div>
                  <div className="text-lg font-bold text-green-700">
                    {resultado.versao_esperada}
                  </div>
                </div>
                <div className="p-4 bg-white rounded-lg border">
                  <div className="text-xs text-slate-500 mb-1">Versão Detectada:</div>
                  <div className={`text-lg font-bold ${resultado.versao_match ? 'text-green-700' : 'text-red-700'}`}>
                    {resultado.version}
                  </div>
                </div>
              </div>

              {/* Detalhes */}
              <div className="grid gap-3">
                <div className="p-3 bg-white rounded border">
                  <div className="text-xs text-slate-500">Build Date:</div>
                  <div className="font-mono text-sm">{resultado.build_date}</div>
                </div>
                <div className="p-3 bg-white rounded border">
                  <div className="text-xs text-slate-500">Auth Method:</div>
                  <div className="font-mono text-sm">{resultado.auth_method}</div>
                </div>
                <div className="p-3 bg-white rounded border">
                  <div className="text-xs text-slate-500">Status HTTP:</div>
                  <Badge className={resultado.status === 200 ? 'bg-green-600' : 'bg-red-600'}>
                    {resultado.status}
                  </Badge>
                </div>
              </div>

              {/* Resposta Completa */}
              <details className="bg-slate-900 rounded-lg p-4">
                <summary className="text-white cursor-pointer hover:text-slate-300">
                  📋 Ver resposta completa do webhook
                </summary>
                <pre className="mt-3 text-xs text-slate-300 overflow-x-auto">
                  {JSON.stringify(resultado.response_completa, null, 2)}
                </pre>
              </details>

              {/* Diagnóstico */}
              {!resultado.versao_match && !resultado.erro && (
                <Alert className="bg-yellow-50 border-yellow-500">
                  <AlertTriangle className="h-4 w-4 text-yellow-700" />
                  <AlertDescription className="text-yellow-900">
                    <strong>⚠️ A versão v22 NÃO está ativa!</strong>
                    <div className="mt-2 space-y-1 text-sm">
                      <p><strong>Possíveis causas:</strong></p>
                      <ul className="list-disc ml-6">
                        <li>A função não foi salva/deployada após a edição</li>
                        <li>Cache agressivo do Deno Deploy (pode levar minutos)</li>
                        <li>O webhook da W-API aponta para outra URL/função</li>
                      </ul>
                      <p className="mt-3"><strong>Soluções:</strong></p>
                      <ul className="list-disc ml-6">
                        <li>Aguardar 2-3 minutos e testar novamente</li>
                        <li>Verificar se a função foi realmente salva no Base44</li>
                        <li>Confirmar a URL do webhook na W-API</li>
                        <li>Enviar uma mensagem REAL via WhatsApp para forçar o runtime</li>
                      </ul>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {resultado.erro && (
                <Alert className="bg-red-50 border-red-500">
                  <XCircle className="h-4 w-4 text-red-700" />
                  <AlertDescription className="text-red-900">
                    <strong>Erro:</strong> {resultado.erro}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
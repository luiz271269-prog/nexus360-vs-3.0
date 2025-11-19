import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, Loader2, Terminal, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function TesteWebhookDireto() {
  const [testando, setTestando] = useState(false);
  const [resultados, setResultados] = useState([]);

  const webhookUrl = `${window.location.origin}/api/functions/whatsappWebhook`;
  
  const variacoesUrl = [
    `${window.location.origin}/api/functions/whatsappWebhook`,
    `${window.location.origin}/functions/whatsappWebhook`,
    `${window.location.origin}/api/whatsappWebhook`,
    `${window.location.origin}/api/functions/whatsapp-webhook`,
    `${window.location.origin}/api/functions/whatsappwebhook`,
  ];

  const testarUrl = async (url, metodo = 'GET', payload = null) => {
    const inicio = Date.now();
    try {
      const opcoes = {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
      };
      
      if (payload) {
        opcoes.body = JSON.stringify(payload);
      }

      const response = await fetch(url, opcoes);
      const duracao = Date.now() - inicio;
      
      let corpo;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        corpo = await response.json();
      } else {
        corpo = await response.text();
      }

      return {
        url,
        metodo,
        status: response.status,
        statusText: response.statusText,
        contentType,
        corpo,
        duracao,
        sucesso: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      };
    } catch (error) {
      const duracao = Date.now() - inicio;
      return {
        url,
        metodo,
        status: 'ERROR',
        statusText: error.message,
        erro: error.message,
        duracao,
        sucesso: false
      };
    }
  };

  const executarTestesCompletos = async () => {
    setTestando(true);
    setResultados([]);
    const novosResultados = [];

    // 1. Teste GET na URL principal
    toast.info('Testando GET health check...');
    const resultadoGet = await testarUrl(webhookUrl, 'GET');
    novosResultados.push({ ...resultadoGet, nome: 'GET Health Check (URL Principal)' });

    // 2. Teste POST na URL principal
    toast.info('Testando POST com payload...');
    const payloadTeste = {
      instanceId: 'TEST_INSTANCE',
      instance: 'TEST_INSTANCE',
      type: 'ReceivedCallback',
      event: 'ReceivedCallback',
      phone: '5548999999999',
      momment: Date.now(),
      text: {
        message: '🧪 TESTE DIRETO DO NAVEGADOR'
      }
    };
    
    const resultadoPost = await testarUrl(webhookUrl, 'POST', payloadTeste);
    novosResultados.push({ ...resultadoPost, nome: 'POST com Payload (URL Principal)', payload: payloadTeste });

    // 3. Se algum deu 404, testar variações de URL
    if (resultadoGet.status === 404 || resultadoPost.status === 404) {
      toast.info('Detectado 404 - Testando variações de URL...');
      
      for (const urlVariacao of variacoesUrl) {
        if (urlVariacao === webhookUrl) continue; // Já testamos
        
        const resultado = await testarUrl(urlVariacao, 'GET');
        novosResultados.push({ 
          ...resultado, 
          nome: `Variação GET: ${urlVariacao.split('/').slice(-2).join('/')}`
        });
        
        // Se encontrou uma URL que funciona, para de testar
        if (resultado.sucesso) {
          toast.success(`✅ Encontrada URL funcional: ${urlVariacao}`);
          break;
        }
      }
    }

    setResultados(novosResultados);
    setTestando(false);

    // Análise final
    const sucessos = novosResultados.filter(r => r.sucesso);
    if (sucessos.length > 0) {
      toast.success(`✅ ${sucessos.length} teste(s) bem-sucedido(s)`);
    } else {
      toast.error('❌ Todos os testes falharam - webhook não acessível');
    }
  };

  const getStatusColor = (status) => {
    if (status === 'ERROR') return 'bg-red-500';
    if (status >= 200 && status < 300) return 'bg-green-500';
    if (status >= 400 && status < 500) return 'bg-red-500';
    if (status >= 500) return 'bg-orange-500';
    return 'bg-gray-500';
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card className="border-2 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="w-6 h-6 text-blue-600" />
            Diagnóstico Direto do Webhook
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              Este teste será executado diretamente do seu navegador para a URL do webhook.
              Isso elimina intermediários e mostra exatamente o que o servidor responde.
            </AlertDescription>
          </Alert>

          <div className="bg-slate-50 p-4 rounded-lg">
            <p className="text-sm font-semibold text-slate-700 mb-2">URL do Webhook:</p>
            <code className="text-sm bg-white p-2 rounded border border-slate-300 block overflow-x-auto">
              {webhookUrl}
            </code>
          </div>

          <Button
            onClick={executarTestesCompletos}
            disabled={testando}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600"
            size="lg"
          >
            {testando ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Testando...
              </>
            ) : (
              <>
                <Terminal className="w-5 h-5 mr-2" />
                Executar Diagnóstico Completo
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {resultados.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Resultados dos Testes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {resultados.map((resultado, idx) => (
              <Card key={idx} className="border-l-4" style={{ borderLeftColor: resultado.sucesso ? '#22c55e' : '#ef4444' }}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {resultado.sucesso ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600" />
                      )}
                      <span className="font-semibold">{resultado.nome}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(resultado.status)}>
                        {resultado.metodo} {resultado.status}
                      </Badge>
                      <Badge variant="outline">{resultado.duracao}ms</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-slate-600">URL:</span>
                      <p className="font-mono text-xs text-slate-900 break-all">{resultado.url}</p>
                    </div>
                    <div>
                      <span className="text-slate-600">Content-Type:</span>
                      <p className="font-mono text-xs text-slate-900">{resultado.contentType || 'N/A'}</p>
                    </div>
                  </div>

                  {resultado.payload && (
                    <div className="bg-slate-50 p-3 rounded">
                      <p className="text-xs font-semibold text-slate-700 mb-1">Payload Enviado:</p>
                      <pre className="text-xs text-slate-600 overflow-x-auto">
                        {JSON.stringify(resultado.payload, null, 2)}
                      </pre>
                    </div>
                  )}

                  <div className="bg-slate-900 p-3 rounded">
                    <p className="text-xs font-semibold text-slate-300 mb-1">Resposta do Servidor:</p>
                    <pre className="text-xs text-green-400 overflow-x-auto max-h-48 overflow-y-auto">
                      {typeof resultado.corpo === 'object' 
                        ? JSON.stringify(resultado.corpo, null, 2)
                        : resultado.corpo || resultado.erro || 'Sem corpo'}
                    </pre>
                  </div>

                  {!resultado.sucesso && resultado.status === 404 && (
                    <Alert className="bg-red-50 border-red-300">
                      <AlertTriangle className="h-4 w-4 text-red-700" />
                      <AlertDescription className="text-red-800 text-sm">
                        <strong>404 Not Found</strong> - O servidor não encontrou a função nesta URL.
                        Verifique:
                        <ul className="list-disc ml-4 mt-2 space-y-1">
                          <li>Se a função está implantada no Dashboard Base44</li>
                          <li>Se o nome do arquivo é exatamente <code>whatsappWebhook.js</code></li>
                          <li>Se você está no ambiente correto (dev/prod)</li>
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  {resultado.sucesso && resultado.corpo?.ignored === 'missing_required_fields' && (
                    <Alert className="bg-yellow-50 border-yellow-300">
                      <AlertTriangle className="h-4 w-4 text-yellow-700" />
                      <AlertDescription className="text-yellow-800 text-sm">
                        <strong>Webhook acessível, mas payload rejeitado.</strong>
                        O webhook está funcionando, mas o payload precisa dos campos: <code>event</code>, <code>instance</code>
                      </AlertDescription>
                    </Alert>
                  )}

                  {resultado.sucesso && resultado.corpo?.success && !resultado.corpo?.ignored && (
                    <Alert className="bg-green-50 border-green-300">
                      <CheckCircle className="h-4 w-4 text-green-700" />
                      <AlertDescription className="text-green-800 text-sm">
                        <strong>✅ Teste bem-sucedido!</strong> O webhook processou a requisição corretamente.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
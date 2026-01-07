import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Activity,
  Database,
  Code,
  Zap,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { getWebhookUrlIntegracao } from '../components/lib/webhookUtils';

export default function DiagnosticoCirurgico() {
  const [testando, setTestando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [testandoCache, setTestandoCache] = useState(false);
  const [resultadoCache, setResultadoCache] = useState(null);

  const executarDiagnosticoCirurgico = async () => {
    setTestando(true);
    setResultado(null);

    const diagnostico = {
      timestamp: new Date().toISOString(),
      testes: []
    };

    try {
      // ========== TESTE 1: BUSCAR INTEGRAÇÃO ==========
      console.log('[DIAG] Buscando integracao...');
      const integracoes = await base44.entities.WhatsAppIntegration.list();
      
      diagnostico.testes.push({
        nome: '1. Integração WhatsApp Existe',
        status: integracoes.length > 0 ? 'sucesso' : 'erro',
        detalhes: {
          total: integracoes.length,
          primeira: integracoes[0]
        }
      });

      if (integracoes.length === 0) {
        setResultado(diagnostico);
        setTestando(false);
        return;
      }

      const integracao = integracoes[0];

      // ========== TESTE 2: TESTAR CONEXÃO HTTP ==========
      console.log('[DIAG] Testando conexao HTTP com webhook...');
      const webhookUrlBase = getWebhookUrlIntegracao(integracao);
      const webhookUrl = webhookUrlBase.includes('?') ? `${webhookUrlBase}&debug=true` : `${webhookUrlBase}?debug=true`;
      
      try {
        const response = await fetch(webhookUrl, { method: 'GET' });
        diagnostico.testes.push({
          nome: '2. Webhook Responde (GET)',
          status: response.ok ? 'sucesso' : 'erro',
          detalhes: {
            status: response.status,
            url: webhookUrl
          }
        });
      } catch (error) {
        diagnostico.testes.push({
          nome: '2. Webhook Responde (GET)',
          status: 'erro',
          detalhes: {
            erro: error.message,
            url: webhookUrl
          }
        });
      }

      // ========== TESTE 3: ENVIAR PAYLOAD TESTE ==========
      console.log('[DIAG] Enviando payload de teste...');
      const messageIdTeste = `DIAG_TEST_${Date.now()}`;
      const payloadTeste = {
        // Chaves de roteamento: incluir todos os aliases comuns
        instanceId: integracao.instance_id_provider,
        instance: integracao.instance_id_provider,
        instance_id: integracao.instance_id_provider,
        
        type: 'ReceivedCallback',
        event: 'ReceivedCallback',
        eventName: 'ReceivedCallback',
        event_type: 'ReceivedCallback',
        
        // Objeto evento aninhado (opcional, para compatibilidade)
        evento: {
          event: 'ReceivedCallback',
          instanceId: integracao.instance_id_provider,
          type: 'ReceivedCallback'
        },
        
        // Dados da mensagem
        phone: '5548999000111',
        telefone: '5548999000111',
        momment: Date.now(),
        messageId: messageIdTeste,
        id: messageIdTeste, // espelhar para id
        text: { message: 'TESTE CIRURGICO' }
      };

      let webhookResponse = null;
      try {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadTeste)
        });
        webhookResponse = await response.json();
        
        diagnostico.testes.push({
          nome: '3. Webhook Aceita POST',
          status: response.ok ? 'sucesso' : 'erro',
          detalhes: {
            status: response.status,
            response: webhookResponse,
            debug: webhookResponse?.debug || null
          }
        });
      } catch (error) {
        diagnostico.testes.push({
          nome: '3. Webhook Aceita POST',
          status: 'erro',
          detalhes: {
            erro: error.message
          }
        });
      }

      // ========== TESTE 4: AGUARDAR PROCESSAMENTO ==========
      console.log('[DIAG] Aguardando 3 segundos para processamento...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      // ========== TESTE 5: VERIFICAR ZAPIPALOADNORMALIZED ==========
      console.log('[DIAG] Verificando ZapiPayloadNormalized...');
      try {
        const payloads = await base44.asServiceRole.entities.ZapiPayloadNormalized.filter(
          { instance_identificado: integracao.instance_id_provider },
          '-timestamp_recebido',
          10
        );

        const payloadEncontrado = payloads.find(p => 
          p.payload_bruto?.messageId === messageIdTeste
        );

        diagnostico.testes.push({
          nome: '4. ZapiPayloadNormalized Criado',
          status: payloadEncontrado ? 'sucesso' : 'erro',
          detalhes: {
            total_recentes: payloads.length,
            encontrado: !!payloadEncontrado,
            messageId_buscado: messageIdTeste,
            payload: payloadEncontrado
          }
        });
      } catch (error) {
        diagnostico.testes.push({
          nome: '4. ZapiPayloadNormalized Criado',
          status: 'erro',
          detalhes: {
            erro: error.message,
            stack: error.stack
          }
        });
      }

      // ========== TESTE 6: VERIFICAR MESSAGE ==========
      console.log('[DIAG] Verificando Message...');
      try {
        const messages = await base44.asServiceRole.entities.Message.filter(
          { whatsapp_message_id: messageIdTeste },
          '-created_date',
          1
        );

        diagnostico.testes.push({
          nome: '5. Message Criada',
          status: messages.length > 0 ? 'sucesso' : 'erro',
          detalhes: {
            encontrada: messages.length > 0,
            messageId_buscado: messageIdTeste,
            message: messages[0]
          }
        });
      } catch (error) {
        diagnostico.testes.push({
          nome: '5. Message Criada',
          status: 'erro',
          detalhes: {
            erro: error.message,
            stack: error.stack
          }
        });
      }

      // ========== TESTE 7: VERIFICAR CONTACT ==========
      console.log('[DIAG] Verificando Contact...');
      try {
        const contacts = await base44.asServiceRole.entities.Contact.filter(
          { telefone: '5548999000111' },
          '-created_date',
          1
        );

        diagnostico.testes.push({
          nome: '6. Contact Criado',
          status: contacts.length > 0 ? 'sucesso' : 'erro',
          detalhes: {
            encontrado: contacts.length > 0,
            telefone_buscado: '5548999000111',
            contact: contacts[0]
          }
        });
      } catch (error) {
        diagnostico.testes.push({
          nome: '6. Contact Criado',
          status: 'erro',
          detalhes: {
            erro: error.message,
            stack: error.stack
          }
        });
      }

      // ========== TESTE 8: VERIFICAR SCHEMA DA ENTIDADE ==========
      console.log('[DIAG] Verificando schema ZapiPayloadNormalized...');
      try {
        const schema = await base44.entities.ZapiPayloadNormalized.schema();
        
        const camposObrigatorios = ['payload_bruto', 'instance_identificado', 'evento', 'timestamp_recebido'];
        const camposFaltando = camposObrigatorios.filter(campo => !schema.properties[campo]);

        diagnostico.testes.push({
          nome: '7. Schema ZapiPayloadNormalized Correto',
          status: camposFaltando.length === 0 ? 'sucesso' : 'erro',
          detalhes: {
            schema_properties: Object.keys(schema.properties),
            campos_obrigatorios: camposObrigatorios,
            campos_faltando: camposFaltando
          }
        });
      } catch (error) {
        diagnostico.testes.push({
          nome: '7. Schema ZapiPayloadNormalized Correto',
          status: 'erro',
          detalhes: {
            erro: error.message
          }
        });
      }

      setResultado(diagnostico);

    } catch (error) {
      console.error('[DIAG] Erro fatal:', error);
      toast.error('Erro no diagnostico: ' + error.message);
    } finally {
      setTestando(false);
    }
  };

  const forcarTesteVersao = async () => {
    setTestandoCache(true);
    setResultadoCache(null);

    try {
      const integracoes = await base44.entities.WhatsAppIntegration.list();
      if (integracoes.length === 0) {
        toast.error('Nenhuma integração encontrada');
        setTestandoCache(false);
        return;
      }

      const integracao = integracoes[0];
      const webhookUrl = getWebhookUrlIntegracao(integracao);
      const timestampCache = Date.now();
      const getUrl = `${webhookUrl}?v=${timestampCache}&cache_bust=${Math.random()}`;
      
      const getResponse = await fetch(getUrl, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });

      const getResult = await getResponse.json();
      
      setResultadoCache({
        status: getResponse.status,
        version: getResult.version || 'VERSÃO NÃO IDENTIFICADA',
        build_date: getResult.build_date || 'N/A',
        auth_method: getResult.auth_method || 'N/A',
        versao_esperada: 'v22.0.0-FORCE-REDEPLOY',
        versao_match: getResult.version === 'v22.0.0-FORCE-REDEPLOY'
      });

      if (getResult.version === 'v22.0.0-FORCE-REDEPLOY') {
        toast.success('✅ Versão v22 está ATIVA!');
      } else {
        toast.error(`❌ Versão antiga: ${getResult.version || 'desconhecida'}`);
      }

    } catch (error) {
      toast.error('Erro: ' + error.message);
      setResultadoCache({ erro: error.message });
    } finally {
      setTestandoCache(false);
    }
  };

  const getIcone = (status) => {
    switch (status) {
      case 'sucesso': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'erro': return <XCircle className="w-5 h-5 text-red-600" />;
      default: return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Zap className="w-8 h-8 text-red-600" />
            Diagnóstico Cirúrgico
          </h1>
          <p className="text-slate-600 mt-1">
            Identifica EXATAMENTE onde o sistema está falhando
          </p>
        </div>

        <Tabs defaultValue="teste-completo" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="teste-completo">Teste Completo</TabsTrigger>
            <TabsTrigger value="verificar-versao">Verificar Versão</TabsTrigger>
          </TabsList>

          {/* ABA 1: TESTE COMPLETO */}
          <TabsContent value="teste-completo" className="space-y-6">
            <div className="flex justify-end">
              <Button 
                onClick={executarDiagnosticoCirurgico}
                disabled={testando}
                className="bg-red-600 hover:bg-red-700 gap-2"
                size="lg"
              >
                {testando ? (
                  <>
                    <Activity className="w-5 h-5 animate-spin" />
                    Executando...
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5" />
                    Executar Diagnóstico
                  </>
                )}
              </Button>
            </div>

            <Alert className="bg-blue-50 border-blue-300">
              <Database className="h-4 w-4 text-blue-700" />
              <AlertDescription className="text-blue-800">
                <strong>O que este diagnóstico faz:</strong>
                <ol className="list-decimal ml-6 mt-2 space-y-1">
                  <li>Verifica se a integração WhatsApp está configurada</li>
                  <li>Testa se o webhook responde (GET e POST)</li>
                  <li>Envia uma mensagem de teste real</li>
                  <li>Verifica se ZapiPayloadNormalized foi criado</li>
                  <li>Verifica se Message foi criada</li>
                  <li>Verifica se Contact foi criado</li>
                  <li>Valida o schema das entidades</li>
                </ol>
              </AlertDescription>
            </Alert>

            {/* Resultados */}
            {resultado && (
          <Card>
            <CardHeader className="bg-slate-50">
              <CardTitle className="text-sm flex items-center gap-2">
                <Code className="w-4 h-4" />
                Resultados do Diagnostico
                <Badge className="ml-auto">
                  {resultado.testes.filter(t => t.status === 'sucesso').length} / {resultado.testes.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {resultado.testes.map((teste, idx) => (
                  <div key={idx} className="p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start gap-3">
                      {getIcone(teste.status)}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm text-slate-900">
                          {teste.nome}
                        </h4>
                        <Badge 
                          className={`mt-1 text-xs ${
                            teste.status === 'sucesso' ? 'bg-green-100 text-green-800' :
                            'bg-red-100 text-red-800'
                          }`}
                        >
                          {teste.status.toUpperCase()}
                        </Badge>
                        
                        {/* Detalhes */}
                        <details className="mt-2">
                          <summary className="text-xs text-blue-600 cursor-pointer hover:underline">
                            Ver detalhes completos
                          </summary>
                          <pre className="mt-2 text-xs bg-slate-900 text-slate-100 p-3 rounded overflow-x-auto">
                            {JSON.stringify(teste.detalhes, null, 2)}
                          </pre>
                        </details>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Diagnóstico de Falhas */}
        {resultado && (
          <Card className="border-2 border-red-300 bg-red-50">
            <CardHeader>
              <CardTitle className="text-sm text-red-900">
                Analise de Falhas Detectadas
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-3">
              {resultado.testes.filter(t => t.status === 'erro').map((teste, idx) => (
                <Alert key={idx} className="bg-white border-red-300">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription>
                    <strong className="text-red-900">{teste.nome}</strong>
                    <p className="text-slate-700 mt-1">
                      {teste.detalhes.erro || 'Falha detectada - veja detalhes acima'}
                    </p>
                    
                    {/* Sugestoes especificas */}
                    {teste.nome.includes('ZapiPayloadNormalized') && (
                      <div className="mt-2 p-2 bg-yellow-50 rounded text-xs">
                        <strong>Solucao:</strong> O webhook nao esta conseguindo persistir no banco.
                        Verifique:
                        <ul className="list-disc ml-6 mt-1">
                          <li>Permissoes do Service Role</li>
                          <li>Logs da funcao whatsappWebhook (Code - Functions - whatsappWebhook - Logs)</li>
                          <li>Se ha erros de validacao de schema</li>
                        </ul>
                      </div>
                    )}
                    
                    {teste.nome.includes('Message Criada') && (
                      <div className="mt-2 p-2 bg-yellow-50 rounded text-xs">
                        <strong>Solucao:</strong> O fluxo esta sendo interrompido antes de criar a Message.
                        Se ZapiPayloadNormalized foi criado mas Message nao, o erro esta no processamento apos normalizacao.
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              ))}
              
              {resultado.testes.filter(t => t.status === 'erro').length === 0 && (
                <Alert className="bg-green-50 border-green-300">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    Todos os testes passaram! O sistema esta funcionando corretamente.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
            )}
          </TabsContent>

          {/* ABA 2: VERIFICAR VERSÃO */}
          <TabsContent value="verificar-versao" className="space-y-6">
            <div className="flex justify-end">
              <Button
                onClick={forcarTesteVersao}
                disabled={testandoCache}
                size="lg"
                className="bg-orange-600 hover:bg-orange-700 gap-2"
              >
                {testandoCache ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Testando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-5 h-5" />
                    Verificar Versão Ativa
                  </>
                )}
              </Button>
            </div>

            <Alert className="bg-blue-50 border-blue-300">
              <Database className="h-4 w-4 text-blue-700" />
              <AlertDescription className="text-blue-800">
                <strong>O que este teste faz:</strong>
                <ul className="list-disc ml-6 mt-2 space-y-1">
                  <li>Força invalidação de cache com parâmetros únicos</li>
                  <li>Verifica qual versão do webhook está ativa</li>
                  <li>Compara com a versão esperada (v22.0.0-FORCE-REDEPLOY)</li>
                </ul>
              </AlertDescription>
            </Alert>

            {resultadoCache && (
              <Card className={`border-2 ${resultadoCache.versao_match ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    {resultadoCache.versao_match ? (
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
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white rounded border">
                      <div className="text-xs text-slate-500 mb-1">Versão Esperada:</div>
                      <div className="text-lg font-bold text-green-700">{resultadoCache.versao_esperada}</div>
                    </div>
                    <div className="p-4 bg-white rounded border">
                      <div className="text-xs text-slate-500 mb-1">Versão Detectada:</div>
                      <div className={`text-lg font-bold ${resultadoCache.versao_match ? 'text-green-700' : 'text-red-700'}`}>
                        {resultadoCache.version}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <div className="p-3 bg-white rounded border">
                      <div className="text-xs text-slate-500">Build Date:</div>
                      <div className="font-mono text-sm">{resultadoCache.build_date}</div>
                    </div>
                    <div className="p-3 bg-white rounded border">
                      <div className="text-xs text-slate-500">Auth Method:</div>
                      <div className="font-mono text-sm">{resultadoCache.auth_method}</div>
                    </div>
                  </div>

                  {!resultadoCache.versao_match && !resultadoCache.erro && (
                    <Alert className="bg-yellow-50 border-yellow-500">
                      <AlertTriangle className="h-4 w-4 text-yellow-700" />
                      <AlertDescription className="text-yellow-900">
                        <strong>⚠️ Versão antiga ainda ativa!</strong>
                        <ul className="list-disc ml-6 mt-2 text-sm">
                          <li>Aguarde 2-3 minutos e teste novamente</li>
                          <li>Envie uma mensagem REAL via WhatsApp para forçar reload</li>
                          <li>Verifique se a função foi salva corretamente</li>
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

      </div>
    </div>
  );
}
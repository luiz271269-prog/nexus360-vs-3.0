import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Activity,
  Database,
  Code,
  Zap
} from 'lucide-react';
import { toast } from 'sonner';

export default function DiagnosticoCirurgico() {
  const [testando, setTestando] = useState(false);
  const [resultado, setResultado] = useState(null);

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
      const webhookUrlBase = integracao.webhook_url || `${window.location.origin}/api/functions/whatsappWebhook`;
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Zap className="w-8 h-8 text-red-600" />
              Diagnostico Cirurgico
            </h1>
            <p className="text-slate-600 mt-1">
              Identifica EXATAMENTE onde o sistema esta falhando
            </p>
          </div>
          
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
                Executar Diagnostico
              </>
            )}
          </Button>
        </div>

        {/* Alertas de Orientação */}
        <Alert className="bg-blue-50 border-blue-300">
          <Database className="h-4 w-4 text-blue-700" />
          <AlertDescription className="text-blue-800">
            <strong>O que este diagnostico faz:</strong>
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

      </div>
    </div>
  );
}
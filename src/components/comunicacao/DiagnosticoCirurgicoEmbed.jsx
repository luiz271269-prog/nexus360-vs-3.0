import React, { useState, useEffect } from 'react';
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
import { getWebhookUrlIntegracao, getProviderNome } from '../lib/webhookUtils';

export default function DiagnosticoCirurgicoEmbed() {
  const [testando, setTestando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [integracoes, setIntegracoes] = useState([]);
  const [integracaoSelecionada, setIntegracaoSelecionada] = useState(null);

  // Carregar integrações ao montar
  React.useEffect(() => {
    carregarIntegracoes();
  }, []);

  const carregarIntegracoes = async () => {
    try {
      const lista = await base44.entities.WhatsAppIntegration.list();
      setIntegracoes(lista);
      
      // Selecionar automaticamente a primeira com número preenchido
      const comNumero = lista.find(i => i.numero_telefone && i.numero_telefone.trim() !== '');
      if (comNumero) {
        setIntegracaoSelecionada(comNumero.id);
      } else if (lista.length > 0) {
        setIntegracaoSelecionada(lista[0].id);
      }
    } catch (error) {
      console.error('[DIAG] Erro ao carregar integrações:', error);
    }
  };

  const executarDiagnosticoCirurgico = async () => {
    if (!integracaoSelecionada) {
      toast.error('Selecione uma integração para testar');
      return;
    }

    setTestando(true);
    setResultado(null);

    const diagnostico = {
      timestamp: new Date().toISOString(),
      testes: []
    };

    try {
      // ========== TESTE 1: BUSCAR INTEGRAÇÃO SELECIONADA ==========
      console.log('[DIAG] Buscando integracao selecionada...');
      const integracao = integracoes.find(i => i.id === integracaoSelecionada);
      
      if (!integracao) {
        diagnostico.testes.push({
          nome: '1. Integração Selecionada',
          status: 'erro',
          detalhes: { erro: 'Integração não encontrada' }
        });
        setResultado(diagnostico);
        setTestando(false);
        return;
      }

      diagnostico.testes.push({
        nome: '1. Integração Selecionada',
        status: 'sucesso',
        detalhes: {
          id: integracao.id,
          nome: integracao.nome_instancia,
          numero: integracao.numero_telefone,
          instance_id: integracao.instance_id_provider,
          provider: integracao.api_provider
        }
      });
      const providerNome = getProviderNome(integracao);
      const isWAPI = integracao.api_provider === 'w_api';

      // ========== TESTE 2: TESTAR CONEXÃO HTTP ==========
      console.log('[DIAG] Testando conexao HTTP com webhook...');
      // ✅ USAR WEBHOOK_URL SALVO NO BANCO (não construir dinamicamente)
      const webhookUrlBase = integracao.webhook_url || getWebhookUrlIntegracao(integracao);
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

      // ========== TESTE 2.5: VALIDAR ARQUITETURA "PORTEIRO CEGO" ==========
      if (isWAPI) {
        const validacaoPorteiro = {
          numero_telefone_presente: !!integracao.numero_telefone,
          instance_id_presente: !!integracao.instance_id_provider,
          webhook_url_presente: !!integracao.webhook_url,
          token_presente: !!integracao.api_key_provider
        };

        const problemas = [];
        if (!validacaoPorteiro.numero_telefone_presente) {
          problemas.push('❌ numero_telefone ausente - Prioridade 1 de lookup falhará');
        }
        if (!validacaoPorteiro.instance_id_presente) {
          problemas.push('❌ instance_id_provider ausente - Fallback falhará');
        }
        if (!validacaoPorteiro.token_presente) {
          problemas.push('⚠️ token ausente - Gerente não poderá agir (envio/mídia)');
        }

        const statusGeral = problemas.length === 0 ? 'sucesso' : 
                           (validacaoPorteiro.numero_telefone_presente || validacaoPorteiro.instance_id_presente) ? 'aviso' : 'erro';

        diagnostico.testes.push({
          nome: '2.5. Validação Arquitetura "PORTEIRO CEGO"',
          status: statusGeral,
          detalhes: {
            arquitetura: 'W-API deve seguir padrão Z-API (Porteiro Cego)',
            integracao: {
              id: integracao.id,
              nome: integracao.nome_instancia,
              numero_telefone: integracao.numero_telefone || 'NÃO CONFIGURADO',
              instance_id_provider: integracao.instance_id_provider || 'NÃO CONFIGURADO',
              token_presente: validacaoPorteiro.token_presente
            },
            validacao_porteiro: validacaoPorteiro,
            problemas_encontrados: problemas.length > 0 ? problemas : ['✅ Integração configurada corretamente'],
            estrategia_lookup: {
              prioridade_1: `connectedPhone → filter({numero_telefone}) ${validacaoPorteiro.numero_telefone_presente ? '✅' : '❌'}`,
              fallback: `instanceId → filter({instance_id_provider}) ${validacaoPorteiro.instance_id_presente ? '✅' : '❌'}`
            }
          }
        });

        // Bloquear apenas se AMBAS as rotas estiverem quebradas
        if (!validacaoPorteiro.numero_telefone_presente && !validacaoPorteiro.instance_id_presente) {
          toast.error('❌ Integração W-API sem numero_telefone E sem instance_id - Porteiro não conseguirá identificar!');
          setResultado(diagnostico);
          setTestando(false);
          return;
        }

        if (problemas.length > 0) {
          toast.warning('⚠️ Problemas detectados na configuração (veja detalhes)');
        }
      }

      // ========== TESTE 3: ENVIAR PAYLOAD TESTE ==========
      console.log('[DIAG] Enviando payload de teste para', providerNome);
      const messageIdTeste = `DIAG_TEST_${Date.now()}`;
      
      // Payload adaptado ao provedor (Z-API vs W-API)
      let payloadTeste;
      if (isWAPI) {
        // ═══════════════════════════════════════════════════════════════════
        // 🏛️ PAYLOAD W-API - ARQUITETURA "PORTEIRO CEGO"
        // ═══════════════════════════════════════════════════════════════════
        // O payload precisa conter os "crachás" que o Porteiro verifica:
        // 1. connectedPhone - Para lookup prioritário por numero_telefone
        // 2. instanceId - Para lookup fallback por instance_id_provider
        //
        // Ambos devem bater com os valores salvos no banco (WhatsAppIntegration)
        // ═══════════════════════════════════════════════════════════════════
        const numeroTelefone = integracao.numero_telefone?.replace(/\D/g, '') || '';
        payloadTeste = {
          // CHAVE 1 (Prioridade): connectedPhone
          connectedPhone: numeroTelefone,
          connected_phone: numeroTelefone,

          // CHAVE 2 (Fallback): instanceId
          instanceId: integracao.instance_id_provider,
          instance: integracao.instance_id_provider,
          instance_id: integracao.instance_id_provider,

          // Dados da mensagem
          type: 'ReceivedCallback',
          event: 'ReceivedCallback',
          messageId: messageIdTeste,
          phone: '5548999000111',
          from: '5548999000111',
          text: { message: 'TESTE CIRURGICO W-API v24 PORTEIRO' },
          body: 'TESTE CIRURGICO W-API v24 PORTEIRO',
          msgContent: {
            conversation: 'TESTE CIRURGICO W-API v24 PORTEIRO'
          },
          pushName: 'Teste Diagnóstico Porteiro',
          senderName: 'Teste Diagnóstico Porteiro',
          fromMe: false,
          momment: Date.now(),
          isGroup: false,
          sender: {
            id: '5548999000111@c.us',
            pushName: 'Teste Diagnóstico Porteiro'
          }
        };
      } else {
        // Formato Z-API (mantido igual)
        payloadTeste = {
          instanceId: integracao.instance_id_provider,
          instance: integracao.instance_id_provider,
          instance_id: integracao.instance_id_provider,
          type: 'ReceivedCallback',
          event: 'ReceivedCallback',
          eventName: 'ReceivedCallback',
          event_type: 'ReceivedCallback',
          evento: {
            event: 'ReceivedCallback',
            instanceId: integracao.instance_id_provider,
            type: 'ReceivedCallback'
          },
          phone: '5548999000111',
          telefone: '5548999000111',
          momment: Date.now(),
          messageId: messageIdTeste,
          id: messageIdTeste,
          text: { message: 'TESTE CIRURGICO' }
        };
      }

      let webhookResponse = null;
      let webhookStatus = null;
      try {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadTeste)
        });
        webhookStatus = response.status;
        webhookResponse = await response.json();
        
        // Identificar erro específico do W-API
        const temErroConfig = webhookResponse?.error === 'config_error' || 
                             webhookResponse?.error === 'auth_error';
        
        diagnostico.testes.push({
          nome: `3. Webhook ${providerNome} Aceita POST`,
          status: response.ok && !temErroConfig ? 'sucesso' : 'erro',
          detalhes: {
            provider: providerNome,
            arquitetura: 'PORTEIRO CEGO - Webhook identifica por connectedPhone/instanceId',
            status: webhookStatus,
            response: webhookResponse,
            payload_enviado: payloadTeste,
            chaves_enviadas: {
              connectedPhone: payloadTeste.connectedPhone || payloadTeste.connected_phone,
              instanceId: payloadTeste.instanceId || payloadTeste.instance
            },
            integracao_banco: {
              id: integracao.id,
              nome: integracao.nome_instancia,
              numero_telefone: integracao.numero_telefone,
              instance_id_provider: integracao.instance_id_provider,
              api_provider: integracao.api_provider
            },
            lookup_esperado: {
              prioridade_1: `connectedPhone (${payloadTeste.connectedPhone}) → numero_telefone (${integracao.numero_telefone})`,
              fallback: `instanceId (${payloadTeste.instanceId}) → instance_id_provider (${integracao.instance_id_provider})`,
              match_prioridade_1: payloadTeste.connectedPhone && integracao.numero_telefone && 
                                 (integracao.numero_telefone.includes(payloadTeste.connectedPhone) || 
                                  payloadTeste.connectedPhone.includes(integracao.numero_telefone.replace(/\D/g, ''))),
              match_fallback: payloadTeste.instanceId === integracao.instance_id_provider
            },
            erro_especifico: temErroConfig ? 
              'Webhook retornou config_error ou auth_error - verificar auth do SDK Base44' : null
          }
        });
      } catch (error) {
        diagnostico.testes.push({
          nome: `3. Webhook ${providerNome} Aceita POST`,
          status: 'erro',
          detalhes: {
            provider: providerNome,
            erro: error.message,
            stack: error.stack,
            payload_enviado: payloadTeste
          }
        });
      }

      // ========== TESTE 4: AGUARDAR PROCESSAMENTO ==========
      console.log('[DIAG] Aguardando 3 segundos para processamento...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      // ========== TESTE 5: VERIFICAR PAYLOAD NORMALIZADO ==========
      console.log('[DIAG] Verificando PayloadNormalized...');
      try {
        const payloads = await base44.entities.ZapiPayloadNormalized.filter(
          { instance_identificado: integracao.instance_id_provider },
          '-timestamp_recebido',
          10
        );

        // Buscar payload - verificar em múltiplos campos
        const payloadEncontrado = payloads.find(p => {
          if (isWAPI) {
            return p.payload_bruto?.messageId === messageIdTeste ||
                   p.payload_bruto?.data?.key?.id === messageIdTeste ||
                   p.message_id === messageIdTeste;
          }
          return p.payload_bruto?.messageId === messageIdTeste ||
                 p.message_id === messageIdTeste;
        });

        diagnostico.testes.push({
          nome: `4. PayloadNormalized (${providerNome})`,
          status: payloadEncontrado ? 'sucesso' : 'erro',
          detalhes: {
            provider: providerNome,
            total_recentes: payloads.length,
            encontrado: !!payloadEncontrado,
            messageId_buscado: messageIdTeste,
            payload: payloadEncontrado,
            message_ids_encontrados: payloads.map(p => ({
              payload_bruto_messageId: p.payload_bruto?.messageId,
              message_id_campo: p.message_id
            }))
          }
        });
      } catch (error) {
        diagnostico.testes.push({
          nome: `4. PayloadNormalized (${providerNome})`,
          status: 'erro',
          detalhes: {
            provider: providerNome,
            erro: error.message,
            stack: error.stack
          }
        });
      }

      // ========== TESTE 6: VERIFICAR MESSAGE ==========
      console.log('[DIAG] Verificando Message...');
      try {
        const messages = await base44.entities.Message.filter(
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

      // ========== TESTE 7: VERIFICAR CONTACT (múltiplas variações) ==========
      console.log('[DIAG] Verificando Contact...');
      try {
        // Testar múltiplas variações do telefone (igual ao webhookWapi)
        const telefoneVariacoes = [
          '5548999000111',
          '+5548999000111',
          '+55489999000111',  // com 9 adicional
          '55489999000111'
        ];
        
        let contactEncontrado = null;
        for (const tel of telefoneVariacoes) {
          const contacts = await base44.entities.Contact.filter(
            { telefone: tel },
            '-created_date',
            1
          );
          if (contacts.length > 0) {
            contactEncontrado = contacts[0];
            break;
          }
        }

        diagnostico.testes.push({
          nome: '6. Contact Criado',
          status: contactEncontrado ? 'sucesso' : 'erro',
          detalhes: {
            encontrado: !!contactEncontrado,
            variacoes_testadas: telefoneVariacoes,
            contact: contactEncontrado
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

      // ========== TESTE 8: VERIFICAR ENTIDADE EXISTE ==========
      console.log('[DIAG] Verificando entidade ZapiPayloadNormalized...');
      try {
        const payloads = await base44.entities.ZapiPayloadNormalized.list('-timestamp_recebido', 1);
        
        diagnostico.testes.push({
          nome: '7. Entidade ZapiPayloadNormalized OK',
          status: 'sucesso',
          detalhes: {
            total_registros: payloads.length,
            entidade_acessivel: true
          }
        });
      } catch (error) {
        diagnostico.testes.push({
          nome: '7. Entidade ZapiPayloadNormalized OK',
          status: 'erro',
          detalhes: {
            erro: error.message,
            entidade_acessivel: false
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <Zap className="w-7 h-7 text-red-600" />
            Diagnóstico Cirúrgico
          </h2>
          <p className="text-slate-600 mt-1">
            Identifica EXATAMENTE onde o sistema está falhando
          </p>
        </div>
        
        <Button 
          onClick={executarDiagnosticoCirurgico}
          disabled={testando || !integracaoSelecionada}
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

      {/* Seletor de Integração */}
      {integracoes.length > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Selecione a integração para testar:
            </label>
            <select
              value={integracaoSelecionada || ''}
              onChange={(e) => setIntegracaoSelecionada(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {integracoes.map((int) => (
                <option key={int.id} value={int.id}>
                  {int.nome_instancia} ({int.numero_telefone || 'sem número'}) - {int.instance_id_provider}
                </option>
              ))}
            </select>
            {integracoes.find(i => i.id === integracaoSelecionada)?.numero_telefone ? (
              <p className="text-xs text-green-700 mt-2">
                ✅ Integração com número configurado: {integracoes.find(i => i.id === integracaoSelecionada)?.numero_telefone}
              </p>
            ) : (
              <p className="text-xs text-red-700 mt-2">
                ⚠️ Esta integração não tem número configurado - o teste pode falhar
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Alertas de Orientação */}
      <Alert className="bg-blue-50 border-blue-300">
        <Database className="h-4 w-4 text-blue-700" />
        <AlertDescription className="text-blue-800">
          <strong>🏛️ Arquitetura "PORTEIRO CEGO" - O que este diagnóstico testa:</strong>
          <ol className="list-decimal ml-6 mt-2 space-y-1">
            <li><strong>Porteiro:</strong> Verifica se a integração tem as "chaves" corretas (numero_telefone, instance_id_provider)</li>
            <li><strong>Porteiro:</strong> Testa se o webhook consegue identificar a integração por connectedPhone (Prioridade 1)</li>
            <li><strong>Porteiro:</strong> Testa se o webhook consegue identificar por instanceId (Fallback)</li>
            <li><strong>Porteiro:</strong> Valida se o payload foi recebido e normalizado (ZapiPayloadNormalized)</li>
            <li><strong>Gerente:</strong> Verifica se a Message foi criada (processamento inbound)</li>
            <li><strong>Gerente:</strong> Verifica se o Contact foi criado/atualizado</li>
            <li><strong>Simetria:</strong> Compara com padrão Z-API (deve ser idêntico)</li>
          </ol>
          <div className="mt-3 p-2 bg-white rounded border border-blue-200">
            <strong>📚 Conceito:</strong> O Webhook é o "Porteiro Cego" - ele só confere o crachá (instanceId/connectedPhone) e deixa o pacote (dados) na portaria (banco). 
            O "Gerente" (Core/Workers) é quem tem a chave do cofre (Token) para abrir o pacote e responder.
          </div>
        </AlertDescription>
      </Alert>

      {/* Resultados */}
      {resultado && (
        <Card>
          <CardHeader className="bg-slate-50">
            <CardTitle className="text-sm flex items-center gap-2">
              <Code className="w-4 h-4" />
              Resultados do Diagnóstico
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
              Análise de Falhas Detectadas
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
                  
                  {teste.nome.includes('ZapiPayloadNormalized') && (
                    <div className="mt-2 p-2 bg-yellow-50 rounded text-xs">
                      <strong>Solução:</strong> O webhook não está conseguindo persistir no banco.
                      Verifique:
                      <ul className="list-disc ml-6 mt-1">
                        <li>Permissões do Service Role</li>
                        <li>Logs da função whatsappWebhook</li>
                        <li>Se há erros de validação de schema</li>
                      </ul>
                    </div>
                  )}
                  
                  {teste.nome.includes('Message Criada') && (
                    <div className="mt-2 p-2 bg-yellow-50 rounded text-xs">
                      <strong>Solução:</strong> O fluxo está sendo interrompido antes de criar a Message.
                      Se ZapiPayloadNormalized foi criado mas Message não, o erro está no processamento após normalização.
                    </div>
                  )}
                  
                  {teste.nome.includes('Webhook') && teste.nome.includes('POST') && (
                    <div className="mt-2 p-2 bg-blue-50 rounded text-xs border border-blue-200">
                      <strong>📊 Análise do Lookup "Porteiro Cego":</strong>
                      {teste.detalhes.lookup_esperado && (
                        <div className="mt-2 space-y-1">
                          <div className={`flex items-start gap-2 ${teste.detalhes.lookup_esperado.match_prioridade_1 ? 'text-green-700' : 'text-orange-700'}`}>
                            {teste.detalhes.lookup_esperado.match_prioridade_1 ? '✅' : '⚠️'}
                            <span>
                              <strong>Prioridade 1:</strong> {teste.detalhes.lookup_esperado.prioridade_1}
                              {!teste.detalhes.lookup_esperado.match_prioridade_1 && ' (FALHA - Porteiro usará fallback)'}
                            </span>
                          </div>
                          <div className={`flex items-start gap-2 ${teste.detalhes.lookup_esperado.match_fallback ? 'text-green-700' : 'text-red-700'}`}>
                            {teste.detalhes.lookup_esperado.match_fallback ? '✅' : '❌'}
                            <span>
                              <strong>Fallback:</strong> {teste.detalhes.lookup_esperado.fallback}
                              {!teste.detalhes.lookup_esperado.match_fallback && ' (FALHA - Porteiro não identificará)'}
                            </span>
                          </div>
                        </div>
                      )}
                      {teste.detalhes.erro_especifico && (
                        <div className="mt-2 p-2 bg-yellow-50 border border-yellow-300 rounded">
                          <strong>⚠️ Erro Detectado:</strong> {teste.detalhes.erro_especifico}
                          <ul className="list-disc ml-6 mt-1">
                            <li>Verificar SDK Base44: <code>createClientFromRequest(req)</code></li>
                            <li>Confirmar uso de <code>base44.asServiceRole</code></li>
                            <li>Verificar logs da função webhookWapi</li>
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            ))}
            
            {resultado.testes.filter(t => t.status === 'erro').length === 0 && (
              <Alert className="bg-green-50 border-green-300">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  Todos os testes passaram! O sistema está funcionando corretamente.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Play,
  RefreshCw,
  Phone,
  Activity,
  AlertTriangle,
  CheckCircle,
  Download,
  BarChart3
} from 'lucide-react';
import { toast } from 'sonner';
import DiagnosticoEtapa from './DiagnosticoEtapa';
import DiagnosticoHistorico from './DiagnosticoHistorico';

export default function DiagnosticoProfissionalZAPI({ integracoes }) {
  const [conexaoSelecionada, setConexaoSelecionada] = useState(null);
  const [executando, setExecutando] = useState(false);
  const [resultadoAtual, setResultadoAtual] = useState(null);
  const [etapasExpandidas, setEtapasExpandidas] = useState({});
  const [historico, setHistorico] = useState([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);

  useEffect(() => {
    if (integracoes.length > 0 && !conexaoSelecionada) {
      setConexaoSelecionada(integracoes[0]);
    }
  }, [integracoes]);

  useEffect(() => {
    if (conexaoSelecionada) {
      carregarHistorico();
    }
  }, [conexaoSelecionada]);

  const carregarHistorico = async () => {
    if (!conexaoSelecionada) return;
    
    setCarregandoHistorico(true);
    try {
      const execucoes = await base44.entities.DiagnosticoExecucao.filter(
        { whatsapp_integration_id: conexaoSelecionada.id },
        '-data_execucao',
        10
      );
      setHistorico(execucoes);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    }
    setCarregandoHistorico(false);
  };

  const executarDiagnostico = async () => {
    if (!conexaoSelecionada) {
      toast.error('Selecione uma conexão primeiro');
      return;
    }

    setExecutando(true);
    const inicioTotal = Date.now();

    const resultado = {
      whatsapp_integration_id: conexaoSelecionada.id,
      integration_nome: conexaoSelecionada.nome_instancia,
      data_execucao: new Date().toISOString(),
      etapas: [],
      ambiente: {
        url_origem: window.location.origin,
        navegador: navigator.userAgent,
        usuario_executor: (await base44.auth.me()).email
      }
    };

    try {
      // ETAPA 1: CONFIGURAÇÃO
      const etapa1 = await executarEtapa1(conexaoSelecionada);
      resultado.etapas.push(etapa1);
      setResultadoAtual({ ...resultado });

      if (etapa1.score < 100) {
        resultado.status_geral = 'bloqueado';
        resultado.etapa_bloqueada = 1;
        await finalizarDiagnostico(resultado, inicioTotal);
        return;
      }

      // ETAPA 2: CONECTIVIDADE
      const etapa2 = await executarEtapa2(conexaoSelecionada);
      resultado.etapas.push(etapa2);
      setResultadoAtual({ ...resultado });

      if (etapa2.score < 75) {
        resultado.status_geral = 'bloqueado';
        resultado.etapa_bloqueada = 2;
        await finalizarDiagnostico(resultado, inicioTotal);
        return;
      }

      // ETAPA 3: RECEBIMENTO
      const etapa3 = await executarEtapa3(conexaoSelecionada);
      resultado.etapas.push(etapa3);
      setResultadoAtual({ ...resultado });

      if (etapa3.score < 50) {
        resultado.status_geral = 'parcial';
        resultado.etapa_bloqueada = 3;
        await finalizarDiagnostico(resultado, inicioTotal);
        return;
      }

      // ETAPA 4: PROCESSAMENTO
      const etapa4 = await executarEtapa4(conexaoSelecionada);
      resultado.etapas.push(etapa4);
      setResultadoAtual({ ...resultado });

      resultado.status_geral = etapa4.score === 100 ? 'sucesso' : 'parcial';

      await finalizarDiagnostico(resultado, inicioTotal);

    } catch (error) {
      console.error('Erro no diagnóstico:', error);
      toast.error('Erro ao executar diagnóstico: ' + error.message);
      setExecutando(false);
    }
  };

  const finalizarDiagnostico = async (resultado, inicioTotal) => {
    resultado.tempo_total_ms = Date.now() - inicioTotal;
    
    // Calcular score total
    const scores = resultado.etapas.map(e => e.score);
    resultado.score_total = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

    // Comparar com execução anterior
    if (historico.length > 0) {
      const anterior = historico[0];
      resultado.comparacao_execucao_anterior = {
        score_anterior: anterior.score_total,
        diferenca: resultado.score_total - anterior.score_total,
        melhorou: resultado.score_total > anterior.score_total
      };
    }

    // Salvar no banco
    try {
      await base44.entities.DiagnosticoExecucao.create(resultado);
      toast.success(`Diagnóstico concluído! Score: ${resultado.score_total}%`);
      await carregarHistorico();
    } catch (error) {
      console.error('Erro ao salvar diagnóstico:', error);
    }

    setExecutando(false);
  };

  // ========== ETAPA 1: CONFIGURAÇÃO ==========
  const executarEtapa1 = async (integracao) => {
    const inicio = Date.now();
    const testes = [];

    // Teste 1: Instance ID
    const t1Inicio = Date.now();
    const temInstanceId = !!integracao.instance_id_provider;
    testes.push({
      nome: 'Instance ID configurado',
      critico: true,
      status: temInstanceId ? 'sucesso' : 'erro',
      tempo_ms: Date.now() - t1Inicio,
      detalhes: { valor: integracao.instance_id_provider || 'NÃO CONFIGURADO' },
      sugestao_correcao: !temInstanceId ? 'Configure o Instance ID na aba Configurações' : null
    });

    // Teste 2: API Key
    const t2Inicio = Date.now();
    const temApiKey = !!integracao.api_key_provider;
    testes.push({
      nome: 'API Key configurada',
      critico: true,
      status: temApiKey ? 'sucesso' : 'erro',
      tempo_ms: Date.now() - t2Inicio,
      detalhes: { configurada: temApiKey },
      sugestao_correcao: !temApiKey ? 'Configure a API Key na aba Configurações' : null
    });

    // Teste 3: Security Token
    const t3Inicio = Date.now();
    const temToken = !!integracao.security_client_token_header;
    testes.push({
      nome: 'Security Token configurado',
      critico: true,
      status: temToken ? 'sucesso' : 'erro',
      tempo_ms: Date.now() - t3Inicio,
      detalhes: { configurado: temToken },
      sugestao_correcao: !temToken ? 'Configure o Security Token na aba Configurações' : null
    });

    // Teste 4: Número de telefone
    const t4Inicio = Date.now();
    const temTelefone = !!integracao.numero_telefone && integracao.numero_telefone.startsWith('+');
    testes.push({
      nome: 'Número de telefone válido',
      critico: false,
      status: temTelefone ? 'sucesso' : 'aviso',
      tempo_ms: Date.now() - t4Inicio,
      detalhes: { numero: integracao.numero_telefone },
      sugestao_correcao: !temTelefone ? 'Use formato internacional (+5511...)' : null
    });

    // Teste 5: Webhook URL
    const t5Inicio = Date.now();
    const temWebhook = !!integracao.webhook_url;
    testes.push({
      nome: 'Webhook URL registrada',
      critico: false,
      status: temWebhook ? 'sucesso' : 'aviso',
      tempo_ms: Date.now() - t5Inicio,
      detalhes: { url: integracao.webhook_url || 'Usando fallback' },
      sugestao_correcao: !temWebhook ? 'Salve a URL do webhook na integração' : null
    });

    const testesComSucesso = testes.filter(t => t.status === 'sucesso').length;
    const score = Math.round((testesComSucesso / testes.length) * 100);

    return {
      numero: 1,
      nome: 'Configuração Básica',
      score,
      tempo_ms: Date.now() - inicio,
      status: score === 100 ? 'sucesso' : score >= 80 ? 'aviso' : 'erro',
      testes
    };
  };

  // ========== ETAPA 2: CONECTIVIDADE ==========
  const executarEtapa2 = async (integracao) => {
    const inicio = Date.now();
    const testes = [];
    const webhookUrl = integracao.webhook_url || `${window.location.origin}/api/functions/whatsappWebhook`;

    // Teste 1: GET Health Check
    const t1Inicio = Date.now();
    try {
      const response = await fetch(webhookUrl, { method: 'GET' });
      const t1Tempo = Date.now() - t1Inicio;
      testes.push({
        nome: 'Webhook responde GET (health check)',
        critico: true,
        status: response.ok ? 'sucesso' : 'erro',
        tempo_ms: t1Tempo,
        detalhes: { status: response.status, statusText: response.statusText },
        sugestao_correcao: !response.ok ? 'Verifique se a função está implantada' : null
      });
    } catch (error) {
      testes.push({
        nome: 'Webhook responde GET (health check)',
        critico: true,
        status: 'erro',
        tempo_ms: Date.now() - t1Inicio,
        detalhes: { erro: error.message },
        sugestao_correcao: 'Webhook inacessível - verifique deploy'
      });
    }

    // Teste 2: Tempo de Resposta
    const t2Inicio = Date.now();
    try {
      await fetch(webhookUrl, { method: 'GET' });
      const t2Tempo = Date.now() - t2Inicio;
      testes.push({
        nome: 'Tempo de resposta < 3s',
        critico: false,
        status: t2Tempo < 3000 ? 'sucesso' : 'aviso',
        tempo_ms: t2Tempo,
        detalhes: { tempo_ms: t2Tempo },
        sugestao_correcao: t2Tempo >= 3000 ? 'Webhook lento - verifique infraestrutura' : null
      });
    } catch (error) {
      testes.push({
        nome: 'Tempo de resposta < 3s',
        critico: false,
        status: 'erro',
        tempo_ms: Date.now() - t2Inicio,
        detalhes: { erro: error.message }
      });
    }

    // Teste 3: POST com Payload
    const t3Inicio = Date.now();
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId: integracao.instance_id_provider,
          type: 'ReceivedCallback',
          phone: '5548999999999',
          momment: Date.now(),
          text: { message: '🧪 TESTE DIAGNÓSTICO' }
        })
      });
      testes.push({
        nome: 'POST com payload aceito',
        critico: true,
        status: response.ok ? 'sucesso' : 'erro',
        tempo_ms: Date.now() - t3Inicio,
        detalhes: { status: response.status },
        sugestao_correcao: !response.ok ? 'Webhook rejeitou POST - verifique handler' : null
      });
    } catch (error) {
      testes.push({
        nome: 'POST com payload aceito',
        critico: true,
        status: 'erro',
        tempo_ms: Date.now() - t3Inicio,
        detalhes: { erro: error.message }
      });
    }

    const testesComSucesso = testes.filter(t => t.status === 'sucesso').length;
    const score = Math.round((testesComSucesso / testes.length) * 100);

    return {
      numero: 2,
      nome: 'Conectividade',
      score,
      tempo_ms: Date.now() - inicio,
      status: score === 100 ? 'sucesso' : score >= 75 ? 'aviso' : 'erro',
      testes
    };
  };

  // ========== ETAPA 3: RECEBIMENTO ==========
  const executarEtapa3 = async (integracao) => {
    const inicio = Date.now();
    const testes = [];

    // Aguardar 2s para mensagem ser processada
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Teste 1: Payload persistido
    const t1Inicio = Date.now();
    try {
      const payloads = await base44.entities.ZapiPayloadNormalized.filter(
        { instance_identificado: integracao.instance_id_provider },
        '-timestamp_recebido',
        5
      );
      const payloadRecente = payloads.find(p => 
        new Date(p.timestamp_recebido) > new Date(Date.now() - 60000)
      );
      testes.push({
        nome: 'Payload recebido e persistido',
        critico: true,
        status: payloadRecente ? 'sucesso' : 'erro',
        tempo_ms: Date.now() - t1Inicio,
        detalhes: { 
          total_payloads: payloads.length,
          payload_recente: !!payloadRecente 
        },
        sugestao_correcao: !payloadRecente ? 'Nenhum payload recente - verifique adapter' : null
      });
    } catch (error) {
      testes.push({
        nome: 'Payload recebido e persistido',
        critico: true,
        status: 'erro',
        tempo_ms: Date.now() - t1Inicio,
        detalhes: { erro: error.message }
      });
    }

    // Teste 2: Instance ID identificado
    const t2Inicio = Date.now();
    try {
      const payloads = await base44.entities.ZapiPayloadNormalized.filter(
        { instance_identificado: integracao.instance_id_provider },
        '-timestamp_recebido',
        1
      );
      const identificado = payloads.length > 0 && payloads[0].integration_id;
      testes.push({
        nome: 'Instance ID identificado corretamente',
        critico: true,
        status: identificado ? 'sucesso' : 'aviso',
        tempo_ms: Date.now() - t2Inicio,
        detalhes: { 
          instance_esperado: integracao.instance_id_provider,
          integration_id_encontrado: payloads[0]?.integration_id 
        },
        sugestao_correcao: !identificado ? 'Verifique busca por instance no webhook' : null
      });
    } catch (error) {
      testes.push({
        nome: 'Instance ID identificado corretamente',
        critico: true,
        status: 'erro',
        tempo_ms: Date.now() - t2Inicio,
        detalhes: { erro: error.message }
      });
    }

    // Teste 3: Evento classificado
    const t3Inicio = Date.now();
    try {
      const payloads = await base44.entities.ZapiPayloadNormalized.filter(
        { instance_identificado: integracao.instance_id_provider },
        '-timestamp_recebido',
        1
      );
      const classificado = payloads.length > 0 && payloads[0].evento;
      testes.push({
        nome: 'Evento classificado',
        critico: false,
        status: classificado ? 'sucesso' : 'aviso',
        tempo_ms: Date.now() - t3Inicio,
        detalhes: { evento: payloads[0]?.evento },
        sugestao_correcao: !classificado ? 'Adapter não está classificando eventos' : null
      });
    } catch (error) {
      testes.push({
        nome: 'Evento classificado',
        critico: false,
        status: 'erro',
        tempo_ms: Date.now() - t3Inicio,
        detalhes: { erro: error.message }
      });
    }

    const testesComSucesso = testes.filter(t => t.status === 'sucesso').length;
    const score = Math.round((testesComSucesso / testes.length) * 100);

    return {
      numero: 3,
      nome: 'Recebimento',
      score,
      tempo_ms: Date.now() - inicio,
      status: score === 100 ? 'sucesso' : score >= 50 ? 'aviso' : 'erro',
      testes
    };
  };

  // ========== ETAPA 4: PROCESSAMENTO ==========
  const executarEtapa4 = async (integracao) => {
    const inicio = Date.now();
    const testes = [];

    // Aguardar 3s para processamento completo
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Teste 1: Contact criado
    const t1Inicio = Date.now();
    try {
      const contacts = await base44.entities.Contact.filter(
        { telefone: '5548999999999' },
        '-created_date',
        1
      );
      const contactRecente = contacts.length > 0 && 
        new Date(contacts[0].created_date) > new Date(Date.now() - 120000);
      testes.push({
        nome: 'Contact criado/encontrado',
        critico: true,
        status: contacts.length > 0 ? 'sucesso' : 'erro',
        tempo_ms: Date.now() - t1Inicio,
        detalhes: { 
          total_contacts: contacts.length,
          contact_recente: contactRecente 
        },
        sugestao_correcao: contacts.length === 0 ? 'Contact não foi criado - verifique webhook' : null
      });
    } catch (error) {
      testes.push({
        nome: 'Contact criado/encontrado',
        critico: true,
        status: 'erro',
        tempo_ms: Date.now() - t1Inicio,
        detalhes: { erro: error.message }
      });
    }

    // Teste 2: Thread criada
    const t2Inicio = Date.now();
    try {
      const threads = await base44.entities.MessageThread.list('-created_date', 5);
      const threadRecente = threads.find(t => 
        new Date(t.created_date) > new Date(Date.now() - 120000)
      );
      testes.push({
        nome: 'MessageThread criada/atualizada',
        critico: true,
        status: threadRecente ? 'sucesso' : 'erro',
        tempo_ms: Date.now() - t2Inicio,
        detalhes: { thread_recente: !!threadRecente },
        sugestao_correcao: !threadRecente ? 'Thread não criada - verifique fluxo' : null
      });
    } catch (error) {
      testes.push({
        nome: 'MessageThread criada/atualizada',
        critico: true,
        status: 'erro',
        tempo_ms: Date.now() - t2Inicio,
        detalhes: { erro: error.message }
      });
    }

    // Teste 3: Message persistida
    const t3Inicio = Date.now();
    try {
      const messages = await base44.entities.Message.filter(
        { whatsapp_message_id: { $ne: null } },
        '-created_date',
        5
      );
      const messageRecente = messages.find(m => 
        new Date(m.created_date) > new Date(Date.now() - 120000)
      );
      testes.push({
        nome: 'Message persistida',
        critico: true,
        status: messageRecente ? 'sucesso' : 'erro',
        tempo_ms: Date.now() - t3Inicio,
        detalhes: { message_recente: !!messageRecente },
        sugestao_correcao: !messageRecente ? 'Message não persistida - verifique transação' : null
      });
    } catch (error) {
      testes.push({
        nome: 'Message persistida',
        critico: true,
        status: 'erro',
        tempo_ms: Date.now() - t3Inicio,
        detalhes: { erro: error.message }
      });
    }

    const testesComSucesso = testes.filter(t => t.status === 'sucesso').length;
    const score = Math.round((testesComSucesso / testes.length) * 100);

    return {
      numero: 4,
      nome: 'Processamento',
      score,
      tempo_ms: Date.now() - inicio,
      status: score === 100 ? 'sucesso' : score >= 66 ? 'aviso' : 'erro',
      testes
    };
  };

  const toggleEtapa = (numero) => {
    setEtapasExpandidas(prev => ({ ...prev, [numero]: !prev[numero] }));
  };

  if (integracoes.length === 0) {
    return (
      <Alert className="bg-yellow-50 border-yellow-300">
        <AlertTriangle className="h-4 w-4 text-yellow-700" />
        <AlertDescription className="text-yellow-800">
          Nenhuma integração configurada. Configure uma conexão na aba "Configurações".
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* COLUNA ESQUERDA: Conexões (30%) */}
      <div className="col-span-12 lg:col-span-4 space-y-4">
        <div className="sticky top-0 bg-white z-10 pb-3 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Phone className="w-4 h-4" />
            Conexões ({integracoes.length})
          </h3>
        </div>

        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
          {integracoes.map((integracao) => (
            <Card
              key={integracao.id}
              className={`cursor-pointer transition-all border-l-4 ${
                conexaoSelecionada?.id === integracao.id
                  ? 'shadow-lg ring-2 ring-blue-400 bg-blue-50'
                  : 'hover:shadow-md'
              }`}
              style={{
                borderLeftColor: integracao.status === 'conectado' ? '#22c55e' : '#ef4444'
              }}
              onClick={() => setConexaoSelecionada(integracao)}
            >
              <CardContent className="p-3">
                <div className="flex items-start gap-2">
                  <div
                    className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                      integracao.status === 'conectado' ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm text-slate-900 truncate">
                      {integracao.nome_instancia}
                    </h4>
                    <p className="text-xs text-slate-600 truncate">{integracao.numero_telefone}</p>
                    <Badge
                      className={`mt-1 text-[10px] ${
                        integracao.status === 'conectado'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {integracao.status}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* COLUNA DIREITA: Diagnóstico (70%) */}
      <div className="col-span-12 lg:col-span-8 space-y-4">
        {conexaoSelecionada ? (
          <>
            {/* Header */}
            <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        conexaoSelecionada.status === 'conectado'
                          ? 'bg-green-500 animate-pulse'
                          : 'bg-red-500'
                      }`}
                    />
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">
                        {conexaoSelecionada.nome_instancia}
                      </h3>
                      <p className="text-sm text-slate-600">{conexaoSelecionada.numero_telefone}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={carregarHistorico}
                      variant="outline"
                      size="sm"
                      disabled={carregandoHistorico}
                    >
                      <RefreshCw
                        className={`w-4 h-4 mr-2 ${carregandoHistorico ? 'animate-spin' : ''}`}
                      />
                      Histórico
                    </Button>
                    <Button
                      onClick={executarDiagnostico}
                      disabled={executando}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600"
                    >
                      {executando ? (
                        <>
                          <Activity className="w-4 h-4 mr-2 animate-spin" />
                          Executando...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Diagnóstico Completo
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Etapas */}
            {resultadoAtual && (
              <div className="space-y-3">
                {resultadoAtual.etapas.map((etapa) => (
                  <DiagnosticoEtapa
                    key={etapa.numero}
                    etapa={etapa}
                    expandido={etapasExpandidas[etapa.numero]}
                    onToggle={() => toggleEtapa(etapa.numero)}
                  />
                ))}
              </div>
            )}

            {/* Histórico */}
            <DiagnosticoHistorico
              historico={historico}
              onVerDetalhes={(exec) => {
                setResultadoAtual(exec);
                setEtapasExpandidas({ 1: true, 2: true, 3: true, 4: true });
              }}
            />
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500">
            <div className="text-center">
              <Phone className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <p className="text-lg font-semibold">Selecione uma conexão</p>
              <p className="text-sm mt-2">Escolha uma conexão à esquerda para iniciar</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
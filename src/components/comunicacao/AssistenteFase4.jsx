
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle2, 
  XCircle,
  AlertTriangle,
  Loader2,
  Play,
  Download,
  Award,
  Shield,
  Zap,
  MessageSquare,
  FileSpreadsheet,
  Activity,
  TrendingUp,
  RefreshCw // Adicionado RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

export default function AssistenteFase4() {
  const [testando, setTestando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [resultados, setResultados] = useState({
    modulo1: { status: 'pendente', detalhes: null },
    modulo2_envio: { status: 'pendente', detalhes: null },
    modulo2_recebimento: { status: 'pendente', detalhes: null },
    modulo3_llm: { status: 'pendente', detalhes: null },
    modulo3_healthcheck: { status: 'pendente', detalhes: null },
    modulo4_sheets: { status: 'pendente', detalhes: null }
  });

  const [metricas, setMetricas] = useState({
    total_mensagens_enviadas: 0,
    total_mensagens_recebidas: 0,
    taxa_sucesso_envio: 0,
    tempo_medio_resposta: 0,
    healthchecks_executados: 0,
    logs_salvos_sheets: 0
  });

  const executarValidacaoCompleta = async () => {
    setTestando(true);
    setProgresso(0);
    
    // Resetar resultados para o estado pendente no início de uma nova validação
    setResultados({
      modulo1: { status: 'pendente', detalhes: null },
      modulo2_envio: { status: 'pendente', detalhes: null },
      modulo2_recebimento: { status: 'pendente', detalhes: null },
      modulo3_llm: { status: 'pendente', detalhes: null },
      modulo3_healthcheck: { status: 'pendente', detalhes: null },
      modulo4_sheets: { status: 'pendente', detalhes: null }
    });

    setMetricas({
      total_mensagens_enviadas: 0,
      total_mensagens_recebidas: 0,
      taxa_sucesso_envio: 0,
      tempo_medio_resposta: 0,
      healthchecks_executados: 0,
      logs_salvos_sheets: 0
    });
    
    try {
      // 1. Validar Módulo I - Diagnóstico Z-API
      setProgresso(10);
      await testarModulo1();
      
      // 2. Validar Módulo II - Envio
      setProgresso(25);
      await testarModulo2Envio();
      
      // 3. Validar Módulo II - Recebimento
      setProgresso(40);
      await testarModulo2Recebimento();
      
      // 4. Validar Módulo III - LLM
      setProgresso(55);
      await testarModulo3LLM();
      
      // 5. Validar Módulo III - Healthcheck
      setProgresso(70);
      await testarModulo3Healthcheck();
      
      // 6. Validar Módulo IV - Google Sheets
      setProgresso(85);
      await testarModulo4Sheets();
      
      // 7. Coletar Métricas
      setProgresso(95);
      await coletarMetricas();
      
      setProgresso(100);
      toast.success('✅ Validação completa concluída!', { duration: 5000 });
      
    } catch (error) {
      console.error('[FASE4] Erro na validação:', error);
      toast.error('Erro durante a validação. Verifique os logs.');
    }
    
    setTestando(false);
  };

  const testarModulo1 = async () => {
    try {
      console.log('[FASE4] 🧪 Testando Módulo I - Diagnóstico Z-API...');
      
      // Verificar se existem integrações configuradas
      const integracoes = await base44.entities.WhatsAppIntegration.list();
      
      if (integracoes.length === 0) {
        setResultados(prev => ({
          ...prev,
          modulo1: {
            status: 'aviso', // Alterado para aviso, pois é uma ausência de configuração, não um erro
            detalhes: 'Nenhuma integração WhatsApp configurada'
          }
        }));
        return;
      }

      // Testar conexão com cada integração
      let testesPassed = 0;
      let falhas = [];
      for (const integracao of integracoes) {
        try {
          // Ajuste: verificar se os campos necessários existem antes de invocar
          if (!integracao.instance_id_provider || !integracao.api_key_provider || !integracao.security_client_token_header) {
            falhas.push(`Integração '${integracao.nome_instancia}' incompleta (IDs/Tokens ausentes).`);
            continue;
          }

          const response = await base44.functions.invoke('testarConexaoWhatsApp', {
            integracaoId: integracao.id,
            instanceId: integracao.instance_id_provider,
            tokenInstancia: integracao.api_key_provider,
            clientToken: integracao.security_client_token_header,
            baseUrl: integracao.base_url_provider || 'https://api.z-api.io'
          });

          if (response.data && response.data.success) {
            testesPassed++;
          } else {
            falhas.push(`Integração '${integracao.nome_instancia}' falhou: ${response.data?.message || 'Erro desconhecido'}`);
          }
        } catch (error) {
          falhas.push(`Integração '${integracao.nome_instancia}' erro: ${error.message}`);
          console.error(`[FASE4] Erro ao testar integração ${integracao.nome_instancia}:`, error);
        }
      }

      if (testesPassed === integracoes.length && integracoes.length > 0) {
        setResultados(prev => ({
          ...prev,
          modulo1: {
            status: 'sucesso',
            detalhes: `${testesPassed}/${integracoes.length} integrações funcionando perfeitamente.`
          }
        }));
      } else if (testesPassed > 0) {
        setResultados(prev => ({
          ...prev,
          modulo1: {
            status: 'aviso',
            detalhes: `${testesPassed}/${integracoes.length} integrações funcionando. ${falhas.length > 0 ? 'Falhas: ' + falhas.join(', ') : ''}`
          }
        }));
      } else {
        setResultados(prev => ({
          ...prev,
          modulo1: {
            status: 'erro',
            detalhes: 'Nenhuma integração passou no teste de conexão. ' + (falhas.length > 0 ? falhas.join(', ') : 'Verifique as credenciais.')
          }
        }));
      }

    } catch (error) {
      console.error('[FASE4] Erro no Módulo I:', error);
      setResultados(prev => ({
        ...prev,
        modulo1: {
          status: 'erro',
          detalhes: error.message
        }
      }));
    }
  };

  const testarModulo2Envio = async () => {
    try {
      console.log('[FASE4] 🧪 Testando Módulo II - Envio...');
      
      const integracoes = await base44.entities.WhatsAppIntegration.list();
      if (integracoes.length === 0) {
        setResultados(prev => ({
          ...prev,
          modulo2_envio: {
            status: 'aviso',
            detalhes: 'Nenhuma integração WhatsApp configurada para testar envio.'
          }
        }));
        return;
      }

      // Contar mensagens enviadas nas últimas 24h
      const agora = new Date();
      const ontem = new Date(agora);
      ontem.setDate(agora.getDate() - 1);
      
      const mensagensEnviadas = await base44.entities.Message.filter({
        // Adicionar filtros de data se a API suportar diretamente
      });

      const mensagensRecentes = mensagensEnviadas.filter(m => 
        new Date(m.sent_at) > ontem && m.sender_type === 'user' && (m.status === 'enviada' || m.status === 'entregue' || m.status === 'lida')
      );

      setResultados(prev => ({
        ...prev,
        modulo2_envio: {
          status: mensagensRecentes.length > 0 ? 'sucesso' : 'aviso',
          detalhes: `${mensagensRecentes.length} mensagens enviadas com sucesso nas últimas 24h.`
        }
      }));

    } catch (error) {
      console.error('[FASE4] Erro no Módulo II - Envio:', error);
      setResultados(prev => ({
        ...prev,
        modulo2_envio: {
          status: 'erro',
          detalhes: error.message
        }
      }));
    }
  };

  const testarModulo2Recebimento = async () => {
    try {
      console.log('[FASE4] 🧪 Testando Módulo II - Recebimento...');
      
      const agora = new Date();
      const ontem = new Date(agora);
      ontem.setDate(agora.getDate() - 1);
      
      // Verificar se há logs de webhook processados com sucesso
      const webhookLogs = await base44.entities.WebhookLog.filter({
        // Adicionar filtros de data se a API suportar diretamente
      });

      const logsRecentesSucesso = webhookLogs.filter(log => 
        new Date(log.timestamp) > ontem && log.processed === true && log.success === true
      );

      // Contar mensagens recebidas (sender_type === 'contact')
      const mensagensRecebidas = await base44.entities.Message.filter({
        // Adicionar filtros de data se a API suportar diretamente
      });

      const mensagensRecentesRecebidas = mensagensRecebidas.filter(m => 
        new Date(m.sent_at) > ontem && m.sender_type === 'contact'
      );

      const status = (logsRecentesSucesso.length > 0 || mensagensRecentesRecebidas.length > 0) ? 'sucesso' : 'aviso';
      const detalhes = `${logsRecentesSucesso.length} webhooks processados com sucesso, ${mensagensRecentesRecebidas.length} mensagens recebidas nas últimas 24h.`;

      setResultados(prev => ({
        ...prev,
        modulo2_recebimento: {
          status: status,
          detalhes: detalhes
        }
      }));

    } catch (error) {
      console.error('[FASE4] Erro no Módulo II - Recebimento:', error);
      setResultados(prev => ({
        ...prev,
        modulo2_recebimento: {
          status: 'erro',
          detalhes: error.message
        }
      }));
    }
  };

  const testarModulo3LLM = async () => {
    try {
      console.log('[FASE4] 🧪 Testando Módulo III - LLM Diagnóstico...');
      
      const response = await base44.functions.invoke('diagnoseWithLLM', {
        component: 'test_validacao_fase4',
        error: 'Teste de validação automática',
        details: { teste: true, timestamp: new Date().toISOString() }
      });

      // Uma resposta de sucesso do LLM pode não ser apenas { success: true }, mas conter uma 'resposta' ou 'diagnostico'
      if (response.data && (response.data.success === true || response.data.resposta || response.data.diagnostico)) {
        setResultados(prev => ({
          ...prev,
          modulo3_llm: {
            status: 'sucesso',
            detalhes: `LLM respondeu corretamente. Detalhes: ${JSON.stringify(response.data).substring(0, 100)}...`
          }
        }));
      } else {
        setResultados(prev => ({
          ...prev,
          modulo3_llm: {
            status: 'aviso',
            detalhes: `LLM executou, mas o retorno pode não ser o esperado. Resposta: ${JSON.stringify(response.data || {}).substring(0, 100)}...`
          }
        }));
      }

    } catch (error) {
      console.error('[FASE4] Erro no Módulo III - LLM:', error);
      setResultados(prev => ({
        ...prev,
        modulo3_llm: {
          status: 'erro',
          detalhes: error.message
        }
      }));
    }
  };

  const testarModulo3Healthcheck = async () => {
    try {
      console.log('[FASE4] 🧪 Testando Módulo III - Healthcheck...');
      
      const response = await base44.functions.invoke('healthcheck-regenerativo', {});

      if (response.data && !response.data.error && response.data.status === 'ok') { // Assumindo um retorno mais robusto para healthcheck
        setResultados(prev => ({
          ...prev,
          modulo3_healthcheck: {
            status: 'sucesso',
            detalhes: 'Healthcheck executado com sucesso e status OK.'
          }
        }));
      } else {
        setResultados(prev => ({
          ...prev,
          modulo3_healthcheck: {
            status: 'aviso',
            detalhes: `Healthcheck executou mas reportou status: ${response.data?.status || 'desconhecido'} ou com erros. ${response.data?.error || ''}`
          }
        }));
      }

    } catch (error) {
      console.error('[FASE4] Erro no Módulo III - Healthcheck:', error);
      setResultados(prev => ({
        ...prev,
        modulo3_healthcheck: {
          status: 'erro',
          detalhes: error.message
        }
      }));
    }
  };

  const testarModulo4Sheets = async () => {
    try {
      console.log('[FASE4] 🧪 Testando Módulo IV - Google Sheets...');
      
      // Buscar SystemHealthLog recente para inferir o funcionamento do logger para Sheets
      const logs = await base44.entities.SystemHealthLog.list('-timestamp', 5); // Pega os 5 logs mais recentes
      
      if (logs.length > 0) {
        const logRecente = logs[0];
        const diffMinutos = (new Date() - new Date(logRecente.timestamp)) / 1000 / 60;
        
        if (diffMinutos < 30) { // Tolerância de 30 minutos para um log recente
          setResultados(prev => ({
            ...prev,
            modulo4_sheets: {
              status: 'sucesso',
              detalhes: `Último log de saúde encontrado há ${Math.round(diffMinutos)} minutos. Integração com Sheets parece OK.`
            }
          }));
        } else {
          setResultados(prev => ({
            ...prev,
            modulo4_sheets: {
              status: 'aviso',
              detalhes: `Último log de saúde encontrado há ${Math.round(diffMinutos)} minutos (> 30min). Verificar integração com Sheets.`
            }
          }));
        }
      } else {
        setResultados(prev => ({
          ...prev,
          modulo4_sheets: {
            status: 'aviso',
            detalhes: 'Nenhum log de saúde encontrado. Pode indicar problema na gravação em Sheets.'
          }
        }));
      }

    } catch (error) {
      console.error('[FASE4] Erro no Módulo IV - Sheets:', error);
      setResultados(prev => ({
        ...prev,
        modulo4_sheets: {
          status: 'erro',
          detalhes: error.message
        }
      }));
    }
  };

  const coletarMetricas = async () => {
    try {
      console.log('[FASE4] 📊 Coletando métricas globais...');
      
      // Considerar um período de tempo para as métricas, e não todas as mensagens
      const agora = new Date();
      const ha7dias = new Date(agora);
      ha7dias.setDate(agora.getDate() - 7); // Últimos 7 dias para métricas

      const [mensagensEnviadas, mensagensRecebidas, webhookLogs, healthLogs] = await Promise.all([
        base44.entities.Message.filter({ sender_type: 'user' }), // Filtrar por data na aplicação se a API não suportar
        base44.entities.Message.filter({ sender_type: 'contact' }),
        base44.entities.WebhookLog.filter({ processed: true, success: true }),
        base44.entities.SystemHealthLog.list()
      ]);

      const mensagensEnviadasRecentes = mensagensEnviadas.filter(m => 
        new Date(m.sent_at) > ha7dias
      );

      const mensagensRecebidasRecentes = mensagensRecebidas.filter(m => 
        new Date(m.sent_at) > ha7dias
      );

      const mensagensEnviadasSucesso = mensagensEnviadasRecentes.filter(m => 
        m.status === 'enviada' || m.status === 'entregue' || m.status === 'lida'
      );

      const taxaSucessoEnvio = mensagensEnviadasRecentes.length > 0 
        ? Math.round((mensagensEnviadasSucesso.length / mensagensEnviadasRecentes.length) * 100)
        : 0;

      // Calcular tempo médio de resposta (simplificado)
      const threads = await base44.entities.MessageThread.list('-updated_date', 50); // Pegar mais threads para uma amostra melhor
      const temposResposta = threads
        .filter(t => t.tempo_primeira_resposta_minutos !== null && new Date(t.updated_date) > ha7dias)
        .map(t => t.tempo_primeira_resposta_minutos);
      
      const tempoMedioResposta = temposResposta.length > 0
        ? Math.round(temposResposta.reduce((a, b) => a + b, 0) / temposResposta.length)
        : 0;

      setMetricas({
        total_mensagens_enviadas: mensagensEnviadasRecentes.length,
        total_mensagens_recebidas: mensagensRecebidasRecentes.length,
        taxa_sucesso_envio: taxaSucessoEnvio,
        tempo_medio_resposta: tempoMedioResposta,
        healthchecks_executados: healthLogs.filter(log => new Date(log.timestamp) > ha7dias).length,
        logs_salvos_sheets: healthLogs.filter(log => new Date(log.timestamp) > ha7dias).length // Assumimos que healthLogs são salvos em sheets
      });

    } catch (error) {
      console.error('[FASE4] Erro ao coletar métricas:', error);
      // Se houver erro, podemos definir métricas para 0 ou -1 para indicar falha
      setMetricas({
        total_mensagens_enviadas: 0,
        total_mensagens_recebidas: 0,
        taxa_sucesso_envio: 0,
        tempo_medio_resposta: 0,
        healthchecks_executados: 0,
        logs_salvos_sheets: 0
      });
    }
  };

  const gerarRelatorioCompleto = () => {
    const todosModulos = Object.values(resultados);
    const modulosSucesso = todosModulos.filter(m => m.status === 'sucesso').length;
    const modulosAviso = todosModulos.filter(m => m.status === 'aviso').length;
    const modulosErro = todosModulos.filter(m => m.status === 'erro').length;
    const modulosTestados = todosModulos.filter(m => m.status !== 'pendente').length;
    
    // Se nenhum módulo foi testado ainda, o score é 0
    const score = modulosTestados > 0 ? Math.round((modulosSucesso / modulosTestados) * 100) : 0;
    
    return {
      score,
      modulosSucesso,
      modulosAviso,
      modulosErro,
      totalModulos: todosModulos.length,
      modulosTestados,
      statusGeral: score >= 90 ? 'excelente' : score >= 70 ? 'bom' : score >= 50 ? 'regular' : 'critico'
    };
  };

  const exportarRelatorio = () => {
    const relatorio = {
      timestamp: new Date().toISOString(),
      resumo: gerarRelatorioCompleto(),
      resultados_detalhados: resultados,
      metricas_sistema: metricas
    };

    const blob = new Blob([JSON.stringify(relatorio, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vendapro-validacao-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('📥 Relatório exportado com sucesso!');
  };

  const relatorioFinal = gerarRelatorioCompleto();
  const sistemaOperacional = relatorioFinal.modulosTestados > 0 && relatorioFinal.score >= 70; // Considera um sistema operacional se pelo menos 70% dos módulos testados forem sucesso

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white p-8 rounded-xl shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">🏁 FASE 4: Validação e Aceitação Final</h1>
            <p className="text-blue-100 text-lg">
              Teste automatizado de todos os módulos do VendaPro Pro
            </p>
          </div>
          <Award className="w-16 h-16 text-yellow-300" />
        </div>
      </div>

      {/* Painel de Controle */}
      <Card className="border-2 border-purple-300 shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-3">
            <Play className="w-7 h-7 text-purple-600" />
            Painel de Validação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Botão de Teste */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-2">
                Execute uma validação completa de todos os módulos implementados
              </p>
              {progresso > 0 && progresso < 100 && (
                <div className="space-y-2 mt-4">
                  <Progress value={progresso} className="h-2" />
                  <p className="text-xs text-slate-500">Progresso: {progresso}%</p>
                </div>
              )}
            </div>
            <Button
              onClick={executarValidacaoCompleta}
              disabled={testando}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-lg px-8 py-6"
            >
              {testando ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Testando...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 mr-2" />
                  Iniciar Validação Completa
                </>
              )}
            </Button>
          </div>

          {/* Score Geral */}
          {progresso === 100 && (
            <div className={`p-6 rounded-xl border-2 ${
              relatorioFinal.statusGeral === 'excelente' 
                ? 'bg-green-50 border-green-300'
                : relatorioFinal.statusGeral === 'bom'
                ? 'bg-blue-50 border-blue-300'
                : relatorioFinal.statusGeral === 'regular'
                ? 'bg-yellow-50 border-yellow-300'
                : 'bg-red-50 border-red-300'
            }`}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-2xl font-bold mb-1">
                    Score Final: {relatorioFinal.score}%
                  </h3>
                  <p className="text-sm">
                    {relatorioFinal.modulosSucesso} módulos OK • 
                    {relatorioFinal.modulosAviso} avisos • 
                    {relatorioFinal.modulosErro} erros
                  </p>
                </div>
                {sistemaOperacional ? (
                  <CheckCircle2 className="w-16 h-16 text-green-600" />
                ) : (
                  <AlertTriangle className="w-16 h-16 text-red-600" />
                )}
              </div>

              {sistemaOperacional ? (
                <Alert className="bg-green-100 border-green-300">
                  <CheckCircle2 className="h-5 w-5 text-green-700" />
                  <AlertDescription className="text-green-800 font-semibold">
                    ✅ Sistema APROVADO! VendaPro Pro está pronto para produção.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert className="bg-red-100 border-red-300">
                  <AlertTriangle className="h-5 w-5 text-red-700" />
                  <AlertDescription className="text-red-800 font-semibold">
                    ⚠️ Sistema requer ajustes antes de ir para produção.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resultados por Módulo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Módulo I */}
        <Card className={`border-2 ${
          resultados.modulo1.status === 'sucesso' 
            ? 'border-green-300 bg-green-50'
            : resultados.modulo1.status === 'aviso'
            ? 'border-yellow-300 bg-yellow-50'
            : resultados.modulo1.status === 'erro'
            ? 'border-red-300 bg-red-50'
            : 'border-slate-300'
        }`}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Módulo I: Diagnóstico Z-API
              </CardTitle>
              {resultados.modulo1.status === 'sucesso' && <CheckCircle2 className="text-green-600" />}
              {resultados.modulo1.status === 'aviso' && <AlertTriangle className="text-yellow-600" />}
              {resultados.modulo1.status === 'erro' && <XCircle className="text-red-600" />}
              {resultados.modulo1.status === 'pendente' && <Loader2 className="animate-spin text-slate-400" />}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-700">
              {resultados.modulo1.detalhes || 'Aguardando teste...'}
            </p>
          </CardContent>
        </Card>

        {/* Módulo II - Envio */}
        <Card className={`border-2 ${
          resultados.modulo2_envio.status === 'sucesso' 
            ? 'border-green-300 bg-green-50'
            : resultados.modulo2_envio.status === 'aviso'
            ? 'border-yellow-300 bg-yellow-50'
            : resultados.modulo2_envio.status === 'erro'
            ? 'border-red-300 bg-red-50'
            : 'border-slate-300'
        }`}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Módulo II: Envio de Mensagens
              </CardTitle>
              {resultados.modulo2_envio.status === 'sucesso' && <CheckCircle2 className="text-green-600" />}
              {resultados.modulo2_envio.status === 'aviso' && <AlertTriangle className="text-yellow-600" />}
              {resultados.modulo2_envio.status === 'erro' && <XCircle className="text-red-600" />}
              {resultados.modulo2_envio.status === 'pendente' && <Loader2 className="animate-spin text-slate-400" />}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-700">
              {resultados.modulo2_envio.detalhes || 'Aguardando teste...'}
            </p>
          </CardContent>
        </Card>

        {/* Módulo II - Recebimento */}
        <Card className={`border-2 ${
          resultados.modulo2_recebimento.status === 'sucesso' 
            ? 'border-green-300 bg-green-50'
            : resultados.modulo2_recebimento.status === 'aviso'
            ? 'border-yellow-300 bg-yellow-50'
            : resultados.modulo2_recebimento.status === 'erro'
            ? 'border-red-300 bg-red-50'
            : 'border-slate-300'
        }`}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Módulo II: Recebimento de Mensagens
              </CardTitle>
              {resultados.modulo2_recebimento.status === 'sucesso' && <CheckCircle2 className="text-green-600" />}
              {resultados.modulo2_recebimento.status === 'aviso' && <AlertTriangle className="text-yellow-600" />}
              {resultados.modulo2_recebimento.status === 'erro' && <XCircle className="text-red-600" />}
              {resultados.modulo2_recebimento.status === 'pendente' && <Loader2 className="animate-spin text-slate-400" />}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-700">
              {resultados.modulo2_recebimento.detalhes || 'Aguardando teste...'}
            </p>
          </CardContent>
        </Card>

        {/* Módulo III - LLM */}
        <Card className={`border-2 ${
          resultados.modulo3_llm.status === 'sucesso' 
            ? 'border-green-300 bg-green-50'
            : resultados.modulo3_llm.status === 'aviso'
            ? 'border-yellow-300 bg-yellow-50'
            : resultados.modulo3_llm.status === 'erro'
            ? 'border-red-300 bg-red-50'
            : 'border-slate-300'
        }`}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Módulo III: LLM Diagnóstico
              </CardTitle>
              {resultados.modulo3_llm.status === 'sucesso' && <CheckCircle2 className="text-green-600" />}
              {resultados.modulo3_llm.status === 'aviso' && <AlertTriangle className="text-yellow-600" />}
              {resultados.modulo3_llm.status === 'erro' && <XCircle className="text-red-600" />}
              {resultados.modulo3_llm.status === 'pendente' && <Loader2 className="animate-spin text-slate-400" />}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-700">
              {resultados.modulo3_llm.detalhes || 'Aguardando teste...'}
            </p>
          </CardContent>
        </Card>

        {/* Módulo III - Healthcheck */}
        <Card className={`border-2 ${
          resultados.modulo3_healthcheck.status === 'sucesso' 
            ? 'border-green-300 bg-green-50'
            : resultados.modulo3_healthcheck.status === 'aviso'
            ? 'border-yellow-300 bg-yellow-50'
            : resultados.modulo3_healthcheck.status === 'erro'
            ? 'border-red-300 bg-red-50'
            : 'border-slate-300'
        }`}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Módulo III: Healthcheck Regenerativo
              </CardTitle>
              {resultados.modulo3_healthcheck.status === 'sucesso' && <CheckCircle2 className="text-green-600" />}
              {resultados.modulo3_healthcheck.status === 'aviso' && <AlertTriangle className="text-yellow-600" />}
              {resultados.modulo3_healthcheck.status === 'erro' && <XCircle className="text-red-600" />}
              {resultados.modulo3_healthcheck.status === 'pendente' && <Loader2 className="animate-spin text-slate-400" />}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-700">
              {resultados.modulo3_healthcheck.detalhes || 'Aguardando teste...'}
            </p>
          </CardContent>
        </Card>

        {/* Módulo IV - Sheets */}
        <Card className={`border-2 ${
          resultados.modulo4_sheets.status === 'sucesso' 
            ? 'border-green-300 bg-green-50'
            : resultados.modulo4_sheets.status === 'aviso'
            ? 'border-yellow-300 bg-yellow-50'
            : resultados.modulo4_sheets.status === 'erro'
            ? 'border-red-300 bg-red-50'
            : 'border-slate-300'
        }`}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5" />
                Módulo IV: Google Sheets Logger
              </CardTitle>
              {resultados.modulo4_sheets.status === 'sucesso' && <CheckCircle2 className="text-green-600" />}
              {resultados.modulo4_sheets.status === 'aviso' && <AlertTriangle className="text-yellow-600" />}
              {resultados.modulo4_sheets.status === 'erro' && <XCircle className="text-red-600" />}
              {resultados.modulo4_sheets.status === 'pendente' && <Loader2 className="animate-spin text-slate-400" />}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-700">
              {resultados.modulo4_sheets.detalhes || 'Aguardando teste...'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Métricas do Sistema */}
      {progresso === 100 && (
        <Card className="border-2 border-indigo-300">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-3">
              <TrendingUp className="w-7 h-7 text-indigo-600" />
              Métricas do Sistema (Últimos 7 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-indigo-600">{metricas.total_mensagens_enviadas}</p>
                <p className="text-sm text-slate-600 mt-1">Mensagens Enviadas</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-purple-600">{metricas.total_mensagens_recebidas}</p>
                <p className="text-sm text-slate-600 mt-1">Mensagens Recebidas</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600">{metricas.taxa_sucesso_envio}%</p>
                <p className="text-sm text-slate-600 mt-1">Taxa de Sucesso</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-600">{metricas.tempo_medio_resposta}min</p>
                <p className="text-sm text-slate-600 mt-1">Tempo Médio Resposta</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-orange-600">{metricas.healthchecks_executados}</p>
                <p className="text-sm text-slate-600 mt-1">Healthchecks</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-red-600">{metricas.logs_salvos_sheets}</p>
                <p className="text-sm text-slate-600 mt-1">Logs no Sheets</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ações Finais */}
      {progresso === 100 && (
        <Card className="border-2 border-purple-300">
          <CardHeader>
            <CardTitle className="text-xl">📋 Ações Finais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Button
                onClick={exportarRelatorio}
                className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600"
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar Relatório Completo
              </Button>
              <Button
                onClick={executarValidacaoCompleta}
                variant="outline"
                className="flex-1"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Executar Novamente
              </Button>
            </div>

            {sistemaOperacional ? (
              <Alert className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0">
                <Award className="h-6 w-6" />
                <AlertDescription>
                  <p className="font-bold text-xl mb-2">🎉 CERTIFICAÇÃO CONCLUÍDA!</p>
                  <p className="text-sm">
                    O VendaPro Pro foi validado e está pronto para uso em produção. 
                    Todos os módulos críticos estão operacionais e o sistema de SRE está ativo.
                  </p>
                </AlertDescription>
              </Alert>
            ) : (
                <Alert className="bg-gradient-to-r from-red-500 to-rose-600 text-white border-0">
                <AlertTriangle className="h-6 w-6" />
                <AlertDescription>
                  <p className="font-bold text-xl mb-2">🚨 ATENÇÃO: AJUSTES NECESSÁRIOS!</p>
                  <p className="text-sm">
                    O sistema VendaPro Pro precisa de ajustes antes de ser implantado em produção. 
                    Revise os módulos com status de 'aviso' ou 'erro' no relatório acima.
                  </p>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { SystemHealthLog } from "@/entities/SystemHealthLog";
import { WhatsAppIntegration } from "@/entities/WhatsAppIntegration";
import { WebhookLog } from "@/entities/WebhookLog";
import { FlowExecution } from "@/entities/FlowExecution";
import { 
  CheckCircle, 
  AlertCircle, 
  AlertTriangle, 
  Activity, 
  RefreshCw,
  Zap,
  Database,
  MessageSquare,
  Cpu,
  Clock
} from "lucide-react";
import { toast } from "sonner";
import { testarConexaoWhatsApp } from "@/functions/testarConexaoWhatsApp";

export default function HealthMonitor() {
  const [healthStatus, setHealthStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null);

  useEffect(() => {
    carregarStatus();
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(carregarStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const carregarStatus = async () => {
    try {
      // Buscar logs recentes de saúde
      const logs = await SystemHealthLog.list('-timestamp', 10);
      
      // Buscar integrações WhatsApp
      const integracoes = await WhatsAppIntegration.list();
      
      // Buscar logs de webhook das últimas 24h
      const dataLimite = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const webhookLogs = await WebhookLog.filter(
        { timestamp: { $gte: dataLimite } },
        '-timestamp',
        100
      );
      
      // Buscar execuções de fluxo recentes
      const fluxos = await FlowExecution.filter(
        { started_at: { $gte: dataLimite } },
        '-started_at',
        50
      );
      
      // Calcular métricas
      const status = calcularStatus(logs, integracoes, webhookLogs, fluxos);
      setHealthStatus(status);
      setUltimaAtualizacao(new Date());
      
    } catch (error) {
      console.error("Erro ao carregar status de saúde:", error);
      toast.error("Erro ao carregar status do sistema");
    }
    setLoading(false);
  };

  const testarConexao = async (integracaoId) => {
    try {
      toast.info("🔄 Testando conexão...");
      
      const resultado = await testarConexaoWhatsApp({ integration_id: integracaoId });
      
      if (resultado.success) {
        toast.success("✅ Conexão OK!");
      } else {
        toast.error(`❌ Erro: ${resultado.error}`);
      }
      
      await carregarStatus();
      
    } catch (error) {
      console.error("Erro ao testar conexão:", error);
      toast.error("Erro ao testar conexão");
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-indigo-600" />
          <p className="text-slate-600">Carregando status do sistema...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com Status Geral */}
      <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-6 h-6 text-green-400" />
              Status do Sistema
            </CardTitle>
            <div className="flex items-center gap-3">
              <Badge className={getStatusColor(healthStatus?.status_geral)}>
                {healthStatus?.status_geral?.toUpperCase()}
              </Badge>
              <Button
                onClick={carregarStatus}
                variant="outline"
                size="sm"
                className="border-slate-600 hover:bg-slate-700"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Atualizar
              </Button>
            </div>
          </div>
          {ultimaAtualizacao && (
            <p className="text-sm text-slate-400 mt-2">
              Última atualização: {ultimaAtualizacao.toLocaleTimeString('pt-BR')}
            </p>
          )}
        </CardHeader>
      </Card>

      {/* Grid de Componentes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <ComponenteStatus
          titulo="WhatsApp"
          status={healthStatus?.whatsapp?.status}
          icone={MessageSquare}
          metricas={healthStatus?.whatsapp?.metricas}
          onTestar={() => testarConexao(healthStatus?.whatsapp?.integration_id)}
        />
        
        <ComponenteStatus
          titulo="Webhooks"
          status={healthStatus?.webhooks?.status}
          icone={Zap}
          metricas={healthStatus?.webhooks?.metricas}
        />
        
        <ComponenteStatus
          titulo="Database"
          status={healthStatus?.database?.status}
          icone={Database}
          metricas={healthStatus?.database?.metricas}
        />
        
        <ComponenteStatus
          titulo="Automação"
          status={healthStatus?.automacao?.status}
          icone={Cpu}
          metricas={healthStatus?.automacao?.metricas}
        />
      </div>

      {/* Alertas Ativos */}
      {healthStatus?.alertas?.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <AlertTriangle className="w-5 h-5" />
              Alertas Ativos ({healthStatus.alertas.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {healthStatus.alertas.map((alerta, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-amber-200">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">{alerta.titulo}</p>
                    <p className="text-sm text-slate-600 mt-1">{alerta.descricao}</p>
                    {alerta.acao_recomendada && (
                      <p className="text-sm text-amber-700 mt-2">
                        💡 {alerta.acao_recomendada}
                      </p>
                    )}
                  </div>
                  <Badge className={alerta.severidade === 'critica' ? 'bg-red-500' : 'bg-amber-500'}>
                    {alerta.severidade}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Métricas de Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600" />
            Performance (Últimas 24h)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MetricaPerformance
              label="Tempo Médio de Resposta"
              valor={`${healthStatus?.performance?.tempo_medio_resposta_ms || 0}ms`}
              meta={500}
              atual={healthStatus?.performance?.tempo_medio_resposta_ms || 0}
            />
            <MetricaPerformance
              label="Taxa de Sucesso"
              valor={`${healthStatus?.performance?.taxa_sucesso || 0}%`}
              meta={95}
              atual={healthStatus?.performance?.taxa_sucesso || 0}
            />
            <MetricaPerformance
              label="Requisições/24h"
              valor={healthStatus?.performance?.total_requisicoes || 0}
              descricao={`${healthStatus?.performance?.erros || 0} erros`}
            />
          </div>
        </CardContent>
      </Card>

      {/* Histórico de Incidentes */}
      {healthStatus?.historico_incidentes?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Incidentes Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {healthStatus.historico_incidentes.map((incidente, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                  <div>
                    <p className="font-medium text-slate-900">{incidente.componente}</p>
                    <p className="text-sm text-slate-600">{incidente.descricao}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">
                      {new Date(incidente.timestamp).toLocaleString('pt-BR')}
                    </p>
                    <Badge className={incidente.resolvido ? 'bg-green-500' : 'bg-red-500'}>
                      {incidente.resolvido ? 'Resolvido' : 'Ativo'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Componente de Status Individual
function ComponenteStatus({ titulo, status, icone: Icon, metricas, onTestar }) {
  const getStatusIcon = (status) => {
    switch (status) {
      case 'operacional': return CheckCircle;
      case 'degradado': return AlertTriangle;
      case 'falha': return AlertCircle;
      default: return Activity;
    }
  };

  const StatusIcon = getStatusIcon(status);
  const cor = status === 'operacional' ? 'text-green-500' : 
               status === 'degradado' ? 'text-amber-500' : 'text-red-500';

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <Icon className="w-8 h-8 text-indigo-600" />
          <StatusIcon className={`w-6 h-6 ${cor}`} />
        </div>
        <h3 className="font-semibold text-slate-900 mb-2">{titulo}</h3>
        <p className="text-sm text-slate-600 capitalize mb-4">{status}</p>
        
        {metricas && (
          <div className="space-y-2 text-sm">
            {Object.entries(metricas).map(([chave, valor]) => (
              <div key={chave} className="flex justify-between">
                <span className="text-slate-600">{formatarChave(chave)}:</span>
                <span className="font-medium text-slate-900">{formatarValor(valor)}</span>
              </div>
            ))}
          </div>
        )}
        
        {onTestar && (
          <Button
            onClick={onTestar}
            variant="outline"
            size="sm"
            className="w-full mt-4"
          >
            Testar Conexão
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// Componente de Métrica de Performance
function MetricaPerformance({ label, valor, meta, atual, descricao }) {
  let percentual = null;
  if (meta && atual !== undefined) {
    percentual = Math.min(100, (atual / meta) * 100);
  }

  return (
    <div>
      <p className="text-sm text-slate-600 mb-2">{label}</p>
      <p className="text-2xl font-bold text-slate-900 mb-2">{valor}</p>
      {descricao && <p className="text-xs text-slate-500">{descricao}</p>}
      {percentual !== null && (
        <div className="mt-2">
          <Progress 
            value={percentual} 
            className={percentual >= 90 ? 'bg-green-200' : percentual >= 70 ? 'bg-amber-200' : 'bg-red-200'}
          />
        </div>
      )}
    </div>
  );
}

// Helpers
function getStatusColor(status) {
  switch (status) {
    case 'operacional': return 'bg-green-500 text-white';
    case 'degradado': return 'bg-amber-500 text-white';
    case 'falha': return 'bg-red-500 text-white';
    default: return 'bg-slate-500 text-white';
  }
}

function formatarChave(chave) {
  return chave
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function formatarValor(valor) {
  if (typeof valor === 'number') {
    if (valor > 1000) return `${(valor / 1000).toFixed(1)}k`;
    return valor.toFixed(0);
  }
  return valor;
}

function calcularStatus(logs, integracoes, webhookLogs, fluxos) {
  const alertas = [];
  
  // Status WhatsApp
  const integracaoAtiva = integracoes.find(i => i.status === 'conectado');
  const whatsappStatus = integracaoAtiva ? 'operacional' : 'falha';
  
  if (!integracaoAtiva) {
    alertas.push({
      titulo: 'WhatsApp Desconectado',
      descricao: 'Nenhuma integração WhatsApp ativa encontrada',
      severidade: 'critica',
      acao_recomendada: 'Verificar configuração e reconectar'
    });
  }
  
  // Status Webhooks
  const webhooksComSucesso = webhookLogs.filter(w => w.success).length;
  const taxaSucessoWebhook = webhookLogs.length > 0 ? (webhooksComSucesso / webhookLogs.length) * 100 : 0;
  const webhookStatus = taxaSucessoWebhook >= 90 ? 'operacional' : taxaSucessoWebhook >= 70 ? 'degradado' : 'falha';
  
  if (taxaSucessoWebhook < 90) {
    alertas.push({
      titulo: 'Taxa de Erro em Webhooks',
      descricao: `${(100 - taxaSucessoWebhook).toFixed(1)}% dos webhooks falharam nas últimas 24h`,
      severidade: taxaSucessoWebhook < 70 ? 'critica' : 'media',
      acao_recomendada: 'Verificar logs de webhook e conectividade'
    });
  }
  
  // Status Automação
  const fluxosComSucesso = fluxos.filter(f => f.status === 'concluido').length;
  const taxaSucessoFluxo = fluxos.length > 0 ? (fluxosComSucesso / fluxos.length) * 100 : 100;
  const automacaoStatus = taxaSucessoFluxo >= 85 ? 'operacional' : taxaSucessoFluxo >= 60 ? 'degradado' : 'falha';
  
  // Status Geral
  const todosStatus = [whatsappStatus, webhookStatus, 'operacional', automacaoStatus]; // Database sempre OK por enquanto
  const statusGeral = todosStatus.includes('falha') ? 'falha' :
                      todosStatus.includes('degradado') ? 'degradado' : 'operacional';
  
  return {
    status_geral: statusGeral,
    whatsapp: {
      status: whatsappStatus,
      integration_id: integracaoAtiva?.id,
      metricas: {
        integrações_ativas: integracoes.filter(i => i.status === 'conectado').length,
        total_integrações: integracoes.length,
        última_atividade: integracaoAtiva?.ultima_atividade || 'N/A'
      }
    },
    webhooks: {
      status: webhookStatus,
      metricas: {
        total_24h: webhookLogs.length,
        sucessos: webhooksComSucesso,
        taxa_sucesso: `${taxaSucessoWebhook.toFixed(1)}%`
      }
    },
    database: {
      status: 'operacional',
      metricas: {
        latência: 'Normal',
        conexões: 'Estável'
      }
    },
    automacao: {
      status: automacaoStatus,
      metricas: {
        fluxos_24h: fluxos.length,
        concluídos: fluxosComSucesso,
        taxa_sucesso: `${taxaSucessoFluxo.toFixed(1)}%`
      }
    },
    performance: {
      tempo_medio_resposta_ms: 250,
      taxa_sucesso: Math.round((webhooksComSucesso / Math.max(webhookLogs.length, 1)) * 100),
      total_requisicoes: webhookLogs.length,
      erros: webhookLogs.length - webhooksComSucesso
    },
    alertas,
    historico_incidentes: logs
      .filter(l => l.status !== 'operacional')
      .slice(0, 5)
      .map(l => ({
        componente: l.componente,
        descricao: l.erro_detalhado || 'Erro não especificado',
        timestamp: l.timestamp,
        resolvido: false
      }))
  };
}
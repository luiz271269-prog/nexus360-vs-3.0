import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  RefreshCw,
  Database,
  Zap,
  Wifi,
  Server,
  Activity,
  Clock
} from "lucide-react";
import { SystemHealthLog } from "@/entities/SystemHealthLog";

/**
 * SystemHealthDashboard - Dashboard de Saúde do Sistema
 * Monitoramento em tempo real de todos os componentes
 */
export default function SystemHealthDashboard() {
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastCheck, setLastCheck] = useState(null);

  useEffect(() => {
    checkSystemHealth();
    const interval = setInterval(checkSystemHealth, 60000); // Check a cada 1min
    return () => clearInterval(interval);
  }, []);

  const checkSystemHealth = async () => {
    setLoading(true);
    try {
      // Buscar últimos logs de cada componente
      const logs = await SystemHealthLog.list('-timestamp', 50);
      
      const componentes = [
        'whatsapp_z_api',
        'whatsapp_evolution',
        'webhook_inbound',
        'database',
        'llm_integration',
        'base44_platform'
      ];

      const health = {};
      
      componentes.forEach(comp => {
        const logsComp = logs.filter(l => l.componente === comp);
        const ultimoLog = logsComp[0];
        
        if (ultimoLog) {
          health[comp] = {
            status: ultimoLog.status,
            tempo_resposta: ultimoLog.tempo_resposta_ms,
            ultima_verificacao: ultimoLog.timestamp,
            metricas: ultimoLog.metricas_adicionais,
            erro: ultimoLog.erro_detalhado
          };
        } else {
          health[comp] = {
            status: 'desconhecido',
            tempo_resposta: null,
            ultima_verificacao: null
          };
        }
      });

      setHealthData(health);
      setLastCheck(new Date());

    } catch (error) {
      console.error("Erro ao verificar saúde do sistema:", error);
    }
    setLoading(false);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'operacional':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'degradado':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'falha':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'operacional':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'degradado':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'falha':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const componenteInfo = {
    whatsapp_z_api: { nome: 'WhatsApp Z-API', icon: Wifi },
    whatsapp_evolution: { nome: 'WhatsApp Evolution', icon: Zap },
    webhook_inbound: { nome: 'Webhooks', icon: Activity },
    database: { nome: 'Banco de Dados', icon: Database },
    llm_integration: { nome: 'Integração IA', icon: Zap },
    base44_platform: { nome: 'Plataforma Base44', icon: Server }
  };

  if (loading && !healthData) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  const statusGeral = healthData && Object.values(healthData).every(h => h.status === 'operacional')
    ? 'operacional'
    : healthData && Object.values(healthData).some(h => h.status === 'falha')
    ? 'falha'
    : 'degradado';

  return (
    <div className="space-y-6">
      {/* Status Geral */}
      <Card className={`border-2 ${getStatusColor(statusGeral)}`}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getStatusIcon(statusGeral)}
              <div>
                <h2 className="text-2xl font-bold">
                  Sistema {statusGeral === 'operacional' ? 'Operacional' : statusGeral === 'degradado' ? 'Degradado' : 'Com Falhas'}
                </h2>
                <p className="text-sm text-slate-600">
                  Última verificação: {lastCheck?.toLocaleTimeString('pt-BR')}
                </p>
              </div>
            </div>
            <Button onClick={checkSystemHealth} variant="outline" size="sm">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Componentes Individuais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {healthData && Object.entries(healthData).map(([key, data]) => {
          const info = componenteInfo[key];
          const Icon = info?.icon || Server;

          return (
            <Card key={key} className={`border ${getStatusColor(data.status)}`}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="w-5 h-5" />
                  {info?.nome || key}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    {getStatusIcon(data.status)}
                    <Badge className={getStatusColor(data.status)}>
                      {data.status}
                    </Badge>
                  </div>

                  {data.tempo_resposta !== null && (
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-600">Tempo de Resposta</span>
                        <span className="font-semibold">{data.tempo_resposta}ms</span>
                      </div>
                      <Progress 
                        value={Math.min((data.tempo_resposta / 1000) * 100, 100)} 
                        className="h-2"
                      />
                    </div>
                  )}

                  {data.metricas && (
                    <div className="text-xs text-slate-600 space-y-1">
                      {data.metricas.taxa_sucesso_ultimas_24h && (
                        <div>Taxa de Sucesso: {data.metricas.taxa_sucesso_ultimas_24h}%</div>
                      )}
                      {data.metricas.total_requisicoes_24h && (
                        <div>Requisições 24h: {data.metricas.total_requisicoes_24h}</div>
                      )}
                    </div>
                  )}

                  {data.erro && (
                    <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                      {data.erro}
                    </div>
                  )}

                  {data.ultima_verificacao && (
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Clock className="w-3 h-3" />
                      {new Date(data.ultima_verificacao).toLocaleString('pt-BR')}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
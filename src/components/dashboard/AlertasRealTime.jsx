import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  X,
  Bell,
  ChevronDown,
  ChevronUp,
  Zap,
  MessageSquare,
  Clock,
  TrendingDown
} from "lucide-react";
import { toast } from "sonner";

/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║  SISTEMA DE ALERTAS EM TEMPO REAL                            ║
 * ║  + Notificações flutuantes                                    ║
 * ║  + Priorização por severidade                                 ║
 * ║  + Ações rápidas                                              ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

export default function AlertasRealTime() {
  const [expandido, setExpandido] = useState(true);
  const [alertasAtivos, setAlertasAtivos] = useState([]);

  // Buscar dados para identificar problemas
  const { data: webhookLogs = [] } = useQuery({
    queryKey: ['webhook_logs_alertas'],
    queryFn: () => base44.entities.WebhookLog.list('-timestamp', 30),
    refetchInterval: 10000, // 10s
    initialData: []
  });

  const { data: execucoes = [] } = useQuery({
    queryKey: ['execucoes_alertas'],
    queryFn: () => base44.entities.FlowExecution.list('-updated_date', 50),
    refetchInterval: 15000, // 15s
    initialData: []
  });

  const { data: threads = [] } = useQuery({
    queryKey: ['threads_alertas'],
    queryFn: () => base44.entities.MessageThread.list('-last_message_at', 50),
    refetchInterval: 20000, // 20s
    initialData: []
  });

  // Analisar e gerar alertas
  useEffect(() => {
    const novosAlertas = [];

    // 1. Verificar erros de webhook
    const ultimosWebhooks = webhookLogs.filter(log => {
      const diffMinutos = (Date.now() - new Date(log.timestamp)) / (1000 * 60);
      return diffMinutos <= 10;
    });

    const webhooksErro = ultimosWebhooks.filter(w => w.success === false);
    
    if (webhooksErro.length >= 5) {
      novosAlertas.push({
        id: 'webhook_errors_' + Date.now(),
        tipo: 'webhook_errors',
        severidade: 'alta',
        titulo: `${webhooksErro.length} erros de webhook`,
        descricao: 'Múltiplas falhas detectadas nos últimos 10 minutos',
        icon: MessageSquare,
        timestamp: new Date(),
        acao: () => window.location.href = '/DebugWebhooks'
      });
    }

    // 2. Verificar se webhook parou de receber mensagens
    if (ultimosWebhooks.length === 0) {
      const ultimoLog = webhookLogs[0];
      if (ultimoLog) {
        const diffMinutos = (Date.now() - new Date(ultimoLog.timestamp)) / (1000 * 60);
        if (diffMinutos > 10) {
          novosAlertas.push({
            id: 'webhook_timeout_' + Date.now(),
            tipo: 'webhook_timeout',
            severidade: 'critica',
            titulo: 'Webhook sem atividade',
            descricao: `Nenhuma mensagem recebida há ${Math.round(diffMinutos)} minutos`,
            icon: Clock,
            timestamp: new Date(),
            acao: () => toast.info("Verificar conexão WhatsApp")
          });
        }
      }
    }

    // 3. Verificar execuções travadas
    const execucoesTravadas = execucoes.filter(exec => {
      if (exec.status !== 'ativo') return false;
      const diffMinutos = (Date.now() - new Date(exec.updated_date)) / (1000 * 60);
      return diffMinutos > 30; // Sem atualização há 30min
    });

    if (execucoesTravadas.length > 0) {
      novosAlertas.push({
        id: 'execucoes_travadas_' + Date.now(),
        tipo: 'execucoes_travadas',
        severidade: 'media',
        titulo: `${execucoesTravadas.length} execuções travadas`,
        descricao: 'Execuções sem atividade há mais de 30 minutos',
        icon: Zap,
        timestamp: new Date(),
        acao: () => window.location.href = '/MonitoramentoRealTime'
      });
    }

    // 4. Verificar conversas sem resposta
    const conversasSemResposta = threads.filter(thread => {
      if (thread.last_message_sender !== 'contact') return false;
      const diffMinutos = (Date.now() - new Date(thread.last_message_at)) / (1000 * 60);
      return diffMinutos > 60 && thread.status === 'aberta'; // 1h sem resposta
    });

    if (conversasSemResposta.length >= 5) {
      novosAlertas.push({
        id: 'conversas_sem_resposta_' + Date.now(),
        tipo: 'conversas_sem_resposta',
        severidade: 'media',
        titulo: `${conversasSemResposta.length} conversas sem resposta`,
        descricao: 'Clientes aguardando resposta há mais de 1 hora',
        icon: MessageSquare,
        timestamp: new Date(),
        acao: () => window.location.href = '/Comunicacao'
      });
    }

    // 5. Verificar taxa de conversão baixa
    const execucoesRecentes = execucoes.filter(exec => {
      const diffHoras = (Date.now() - new Date(exec.created_date)) / (1000 * 60 * 60);
      return diffHoras <= 24;
    });

    const execucoesConcluidas = execucoesRecentes.filter(e => e.status === 'concluido').length;
    const taxaConversao = execucoesRecentes.length > 0 
      ? (execucoesConcluidas / execucoesRecentes.length) * 100
      : 0;

    if (taxaConversao < 30 && execucoesRecentes.length >= 10) {
      novosAlertas.push({
        id: 'baixa_conversao_' + Date.now(),
        tipo: 'baixa_conversao',
        severidade: 'baixa',
        titulo: 'Taxa de conversão baixa',
        descricao: `Apenas ${Math.round(taxaConversao)}% das execuções estão sendo concluídas`,
        icon: TrendingDown,
        timestamp: new Date(),
        acao: () => window.location.href = '/AnalyticsPlaybooks'
      });
    }

    // Atualizar alertas (remover duplicados)
    setAlertasAtivos(prevAlertas => {
      const alertasExistentes = prevAlertas.filter(a => 
        !novosAlertas.some(n => n.tipo === a.tipo)
      );
      return [...alertasExistentes, ...novosAlertas];
    });

  }, [webhookLogs, execucoes, threads]);

  const handleDismiss = (alertaId) => {
    setAlertasAtivos(prev => prev.filter(a => a.id !== alertaId));
  };

  const handleDismissAll = () => {
    setAlertasAtivos([]);
    toast.success("Todos os alertas foram dispensados");
  };

  if (alertasAtivos.length === 0) {
    return null;
  }

  const getSeveridadeColor = (severidade) => {
    switch (severidade) {
      case 'critica': return 'from-red-500 to-pink-600';
      case 'alta': return 'from-orange-500 to-amber-600';
      case 'media': return 'from-yellow-500 to-orange-600';
      default: return 'from-blue-500 to-indigo-600';
    }
  };

  const getSeveridadeBadge = (severidade) => {
    switch (severidade) {
      case 'critica': return 'bg-red-600 text-white';
      case 'alta': return 'bg-orange-600 text-white';
      case 'media': return 'bg-yellow-600 text-white';
      default: return 'bg-blue-600 text-white';
    }
  };

  return (
    <motion.div
      initial={{ x: 400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: "spring", damping: 20 }}
      className="fixed top-20 right-6 z-50 w-96 max-h-[calc(100vh-120px)] flex flex-col shadow-2xl"
    >
      
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-t-2xl px-4 py-3 flex items-center justify-between border-2 border-slate-700">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bell className="w-5 h-5 text-amber-400" />
            {alertasAtivos.length > 0 && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-[10px] font-bold text-white">{alertasAtivos.length}</span>
              </div>
            )}
          </div>
          <h3 className="text-white font-bold text-sm">Alertas do Sistema</h3>
        </div>
        
        <div className="flex items-center gap-2">
          {alertasAtivos.length > 0 && (
            <Button
              onClick={handleDismissAll}
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/10 h-7 text-xs"
            >
              Limpar Tudo
            </Button>
          )}
          <Button
            onClick={() => setExpandido(!expandido)}
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10 h-7 w-7"
          >
            {expandido ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Body */}
      <AnimatePresence>
        {expandido && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-slate-900/95 backdrop-blur-xl rounded-b-2xl border-2 border-t-0 border-slate-700 overflow-hidden"
          >
            <div className="p-3 space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto">
              <AnimatePresence>
                {alertasAtivos.map((alerta, index) => {
                  const Icon = alerta.icon;
                  
                  return (
                    <motion.div
                      key={alerta.id}
                      initial={{ x: 50, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: -50, opacity: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`bg-gradient-to-r ${getSeveridadeColor(alerta.severidade)} rounded-xl p-3 shadow-lg`}
                    >
                      <div className="flex items-start gap-3">
                        <Icon className="w-5 h-5 text-white flex-shrink-0 mt-0.5" />
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="text-white font-bold text-sm">
                              {alerta.titulo}
                            </h4>
                            <Badge className={getSeveridadeBadge(alerta.severidade) + " text-[9px] px-1.5"}>
                              {alerta.severidade.toUpperCase()}
                            </Badge>
                          </div>
                          
                          <p className="text-white/90 text-xs leading-tight mb-2">
                            {alerta.descricao}
                          </p>

                          <div className="flex items-center justify-between">
                            <span className="text-white/70 text-[10px]">
                              {alerta.timestamp.toLocaleTimeString('pt-BR')}
                            </span>
                            
                            <div className="flex items-center gap-2">
                              {alerta.acao && (
                                <Button
                                  size="sm"
                                  onClick={alerta.acao}
                                  className="h-6 text-[10px] bg-white/20 hover:bg-white/30 text-white px-2"
                                >
                                  Ver Detalhes
                                </Button>
                              )}
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDismiss(alerta.id)}
                                className="h-6 w-6 hover:bg-white/20 text-white"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
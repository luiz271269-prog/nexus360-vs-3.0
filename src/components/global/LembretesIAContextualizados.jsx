
import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  AlertTriangle,
  Clock,
  TrendingUp,
  Zap,
  X,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Brain,
  DollarSign,
  CheckCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const PRIORIDADE_CONFIG = {
  critica: {
    icon: AlertTriangle,
    cardBg: 'bg-gradient-to-r from-red-500 to-pink-600',
    badge: 'CRÍTICA',
    badgeColor: 'bg-red-600'
  },
  alta: {
    icon: Zap,
    cardBg: 'bg-gradient-to-r from-orange-500 to-amber-600',
    badge: 'ALTA',
    badgeColor: 'bg-orange-600'
  },
  media: {
    icon: TrendingUp,
    cardBg: 'bg-gradient-to-r from-blue-500 to-indigo-600',
    badge: 'MÉDIA',
    badgeColor: 'bg-blue-600'
  },
  baixa: {
    icon: Clock,
    cardBg: 'bg-gradient-to-r from-slate-500 to-slate-600',
    badge: 'BAIXA',
    badgeColor: 'bg-slate-600'
  }
};

export default function LembretesIAContextualizados({ 
  lembretes = [], 
  onAcaoExecutada,
  statsQualidade = null,
  insightsIA = null,
  onQualidadeClick,
  onInsightsClick
}) {
  const [expandido, setExpandido] = useState(true);
  const [qualidadeExpandida, setQualidadeExpandida] = useState(false);
  const [insightsExpandidos, setInsightsExpandidos] = useState(false);

  const totalItens = lembretes.length + (statsQualidade ? 1 : 0) + (insightsIA ? 1 : 0);

  if (totalItens === 0) return null;

  return (
    <motion.div
      initial={{ x: 400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: "spring", damping: 20 }}
      className="fixed top-20 right-6 z-40 w-[5cm] max-h-[calc(100vh-120px)] flex flex-col"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 rounded-t-2xl px-3 py-2 flex items-center justify-between shadow-2xl border-2 border-slate-700">
        <div className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <h3 className="text-white font-bold text-xs">Nexus IA</h3>
          <Badge className="bg-red-500 text-white font-bold text-[9px] px-1.5 py-0.5 rounded-full">
            {totalItens}
          </Badge>
        </div>
        
        <div className="flex items-center gap-0.5">
          <Button
            onClick={() => setExpandido(!expandido)}
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10 h-6 w-6 rounded-full"
          >
            {expandido ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </Button>
          <Button
            onClick={() => onAcaoExecutada && onAcaoExecutada({ id: 'fechar_tudo' })}
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10 h-6 w-6 rounded-full"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Cards - Stack Vertical Compacto */}
      <AnimatePresence>
        {expandido && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-slate-900/95 backdrop-blur-xl rounded-b-2xl border-2 border-t-0 border-slate-700 shadow-2xl overflow-hidden"
          >
            <div className="p-2 space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-800">
              
              {/* 🆕 CARD: Qualidade RAG (Expansível) */}
              {statsQualidade && (
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-lg">
                  <button
                    onClick={() => {
                      if (!qualidadeExpandida && onQualidadeClick) {
                        onQualidadeClick();
                      }
                      setQualidadeExpandida(!qualidadeExpandida);
                    }}
                    className="w-full p-2 text-left flex items-center justify-between hover:bg-white/10 transition-all rounded-xl"
                  >
                    <div className="flex items-center gap-2">
                      <Brain className="w-4 h-4 text-white" />
                      <span className="text-white font-bold text-[10px]">Qualidade RAG</span>
                      <Badge className="bg-white/20 text-white text-[8px] px-1 py-0">
                        {statsQualidade.scoreGeral}%
                      </Badge>
                    </div>
                    <ChevronRight className={`w-3 h-3 text-white transition-transform ${qualidadeExpandida ? 'rotate-90' : ''}`} />
                  </button>
                  
                  <AnimatePresence>
                    {qualidadeExpandida && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="px-2 pb-2"
                      >
                        <div className="space-y-2 pt-2 border-t border-white/20">
                          <Progress value={statsQualidade.scoreGeral} className="h-2 bg-white/20" />
                          
                          <div className="grid grid-cols-2 gap-1.5">
                            <div className="bg-green-500/30 p-1.5 rounded-lg border border-green-400/30">
                              <div className="text-[8px] text-green-100 font-medium">Excelente</div>
                              <div className="text-sm font-bold text-green-50">{statsQualidade.excelente}</div>
                            </div>
                            <div className="bg-blue-500/30 p-1.5 rounded-lg border border-blue-400/30">
                              <div className="text-[8px] text-blue-100 font-medium">Bom</div>
                              <div className="text-sm font-bold text-blue-50">{statsQualidade.bom}</div>
                            </div>
                            <div className="bg-yellow-500/30 p-1.5 rounded-lg border border-yellow-400/30">
                              <div className="text-[8px] text-yellow-100 font-medium">Médio</div>
                              <div className="text-sm font-bold text-yellow-50">{statsQualidade.medio}</div>
                            </div>
                            <div className="bg-red-500/30 p-1.5 rounded-lg border border-red-400/30">
                              <div className="text-[8px] text-red-100 font-medium">Baixo</div>
                              <div className="text-sm font-bold text-red-50">{statsQualidade.baixo}</div>
                            </div>
                          </div>

                          {statsQualidade.baixo > 0 && (
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onQualidadeClick) onQualidadeClick();
                              }}
                              className="bg-red-500 hover:bg-red-600 text-white text-[8px] px-2 py-1 w-full h-auto"
                            >
                              Ver {statsQualidade.baixo} produto{statsQualidade.baixo > 1 ? 's' : ''} para corrigir
                            </Button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* 🆕 CARD: Insights de Precificação (Expansível) */}
              {insightsIA && (
                <div className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl shadow-lg">
                  <button
                    onClick={() => {
                      if (!insightsExpandidos && onInsightsClick) {
                        onInsightsClick();
                      }
                      setInsightsExpandidos(!insightsExpandidos);
                    }}
                    className="w-full p-2 text-left flex items-center justify-between hover:bg-white/10 transition-all rounded-xl"
                  >
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-white" />
                      <span className="text-white font-bold text-[10px]">Insights Precificação</span>
                    </div>
                    <ChevronRight className={`w-3 h-3 text-white transition-transform ${insightsExpandidos ? 'rotate-90' : ''}`} />
                  </button>
                  
                  <AnimatePresence>
                    {insightsExpandidos && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="px-2 pb-2"
                      >
                        <div className="space-y-2 pt-2 border-t border-white/20">
                          <div className="p-2 rounded-lg bg-white/10 border border-white/20">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="font-bold text-[9px] text-white">
                                Margem: {insightsIA.analise_margem?.status === 'saudavel' ? '✅ Saudável' : insightsIA.analise_margem?.status === 'critico' ? '❌ Crítico' : '⚠️ Atenção'}
                              </span>
                            </div>
                            <p className="text-[8px] text-white/90 leading-tight">{insightsIA.analise_margem?.comentario}</p>
                          </div>

                          {insightsIA.oportunidades_bundling && insightsIA.oportunidades_bundling.length > 0 && (
                            <div className="bg-white/10 p-2 rounded-lg border border-white/20">
                              <div className="font-bold text-[9px] mb-1 text-white">Oportunidades</div>
                              <ul className="text-[8px] space-y-0.5 text-white/90">
                                {insightsIA.oportunidades_bundling.slice(0, 2).map((oportunidade, idx) => (
                                  <li key={idx} className="flex items-start gap-1">
                                    <CheckCircle className="w-2.5 h-2.5 text-green-300 mt-0.5 flex-shrink-0" />
                                    <span className="line-clamp-2">{oportunidade}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onInsightsClick) onInsightsClick();
                            }}
                            className="bg-white/20 hover:bg-white/30 text-white text-[8px] px-2 py-1 w-full h-auto"
                          >
                            Ver Detalhes Completos
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Lembretes Originais */}
              {lembretes.map((lembrete, index) => {
                const config = PRIORIDADE_CONFIG[lembrete.prioridade] || PRIORIDADE_CONFIG.media;
                const Icon = config.icon;

                return (
                  <motion.div
                    key={lembrete.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => {
                      if (lembrete.onAcao) {
                        lembrete.onAcao();
                      }
                      if (onAcaoExecutada) {
                        onAcaoExecutada(lembrete);
                      }
                    }}
                    className={`${config.cardBg} rounded-xl p-2 shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer hover:scale-[1.02] relative overflow-hidden group`}
                  >
                    <div className="absolute top-1.5 right-1.5">
                      <Badge className={`${config.badgeColor} text-white text-[8px] font-bold px-1 py-0.5`}>
                        {config.badge}
                      </Badge>
                    </div>

                    <div className="flex items-start gap-1.5 pr-12">
                      <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                        <Icon className="w-3 h-3 text-white" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-bold text-[10px] leading-tight mb-0.5 line-clamp-2">
                          {lembrete.titulo}
                        </h4>
                        <p className="text-white/85 text-[9px] leading-snug line-clamp-2">
                          {lembrete.descricao}
                        </p>
                      </div>
                    </div>

                    <div className="mt-1.5 pt-1.5 border-t border-white/20 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[8px] text-white/70 flex-wrap">
                        {lembrete.metadata?.clienteNome && (
                          <span className="truncate max-w-[80px]">👤 {lembrete.metadata.clienteNome}</span>
                        )}
                        {lembrete.metadata?.valor && (
                          <span>💰 {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(lembrete.metadata.valor)}</span>
                        )}
                        {lembrete.metadata?.diasAtraso && (
                          <span>⏰ {lembrete.metadata.diasAtraso}d</span>
                        )}
                        {lembrete.metadata?.quantidade && (
                          <span className="font-semibold">{lembrete.metadata.quantidade} {lembrete.metadata.tipo}</span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-0.5 text-white/90 text-[9px] font-medium">
                        <span className="hidden sm:inline truncate max-w-[40px]">{lembrete.acao_sugerida?.split(' ')[0]}</span>
                        <ChevronRight className="w-2.5 h-2.5 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>

                    <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

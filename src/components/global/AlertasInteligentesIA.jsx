import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  Clock,
  TrendingUp,
  Zap,
  X,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Brain
} from 'lucide-react';

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

export default function AlertasInteligentesIA({ 
  alertas = [],
  onAcaoExecutada,
  titulo = "Alertas IA"
}) {
  const [expandido, setExpandido] = useState(true);

  if (alertas.length === 0) return null;

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
          <Brain className="w-3.5 h-3.5 text-amber-400" />
          <h3 className="text-white font-bold text-xs">{titulo}</h3>
          <Badge className="bg-red-500 text-white font-bold text-[9px] px-1.5 py-0.5 rounded-full">
            {alertas.length}
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

      {/* Cards de Alertas */}
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
              {alertas.map((alerta, index) => {
                const config = PRIORIDADE_CONFIG[alerta.prioridade] || PRIORIDADE_CONFIG.media;
                const IconComponent = config.icon;

                return (
                  <motion.div
                    key={alerta.id || index}
                    initial={{ x: 50, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className={`${config.cardBg} rounded-xl p-2 shadow-lg`}
                  >
                    <div className="flex items-start gap-2">
                      <IconComponent className="w-4 h-4 text-white flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-white font-bold text-[10px] leading-tight">
                            {alerta.titulo}
                          </h4>
                          <Badge className={`${config.badgeColor} text-white text-[7px] px-1 py-0`}>
                            {config.badge}
                          </Badge>
                        </div>
                        
                        <p className="text-white/90 text-[9px] leading-tight mb-1.5">
                          {alerta.descricao}
                        </p>

                        {alerta.acao_sugerida && (
                          <Button
                            onClick={() => alerta.onAcao && alerta.onAcao()}
                            size="sm"
                            className="w-full bg-white/20 hover:bg-white/30 text-white text-[9px] h-6 px-2 backdrop-blur-sm"
                          >
                            {alerta.acao_sugerida}
                            <ChevronRight className="w-3 h-3 ml-1" />
                          </Button>
                        )}
                      </div>
                    </div>
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
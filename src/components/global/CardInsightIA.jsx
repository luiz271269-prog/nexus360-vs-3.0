
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Brain, 
  Sparkles, 
  AlertCircle, 
  CheckCircle, 
  TrendingUp,
  DollarSign,
  Package,
  Users,
  Target
} from 'lucide-react';

/**
 * ═══════════════════════════════════════════════════════════
 * CARD DE INSIGHT IA - COMPONENTE REUTILIZÁVEL
 * ═══════════════════════════════════════════════════════════
 * 
 * Usado para exibir insights da IA em qualquer tela do sistema
 * com visual consistente e profissional.
 */

const iconMap = {
  brain: Brain,
  sparkles: Sparkles,
  alert: AlertCircle,
  check: CheckCircle,
  trending: TrendingUp,
  dollar: DollarSign,
  package: Package,
  users: Users,
  target: Target
};

export default function CardInsightIA({ 
  titulo,
  tipo = 'info',
  icone = 'brain',
  children,
  score,
  badge,
  className = ''
}) {
  const Icon = iconMap[icone] || Brain;

  const tipoConfig = {
    info: {
      gradiente: 'from-indigo-500 to-purple-600',
      borda: 'border-indigo-500',
      iconeBg: 'from-indigo-600 to-purple-600',
      textoCor: 'text-white'
    },
    success: {
      gradiente: 'from-green-500 to-emerald-600',
      borda: 'border-green-500',
      iconeBg: 'from-green-600 to-emerald-600',
      textoCor: 'text-white'
    },
    warning: {
      gradiente: 'from-amber-500 to-orange-600',
      borda: 'border-amber-500',
      iconeBg: 'from-amber-600 to-orange-600',
      textoCor: 'text-white'
    },
    error: {
      gradiente: 'from-red-500 to-pink-600',
      borda: 'border-red-500',
      iconeBg: 'from-red-600 to-pink-600',
      textoCor: 'text-white'
    }
  };

  const config = tipoConfig[tipo];

  return (
    <div className={`bg-gradient-to-r ${config.gradiente} rounded-2xl shadow-2xl border-2 ${config.borda} ${className}`}>
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${config.iconeBg} flex items-center justify-center shadow-lg`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <span className={`${config.textoCor} font-bold text-xs leading-tight block truncate`}>{titulo}</span>
            {badge && (
              <Badge className="mt-0.5 bg-white/20 text-white text-[8px] px-1 py-0">{badge}</Badge>
            )}
          </div>
          {score !== undefined && (
            <div className="text-right">
              <div className={`text-xl font-bold ${config.textoCor}`}>{score}</div>
              <div className="text-[8px] text-white/80">Score</div>
            </div>
          )}
        </div>
        <div className="text-white text-[10px] leading-snug">
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * Card Especializado: Qualidade RAG
 */
export function CardQualidadeRAG({ stats }) {
  if (!stats) return null;

  return (
    <CardInsightIA
      titulo="Qualidade IA"
      tipo="info"
      icone="brain"
      score={stats.scoreGeral}
    >
      <div className="space-y-2">
        <Progress value={stats.scoreGeral} className="h-2 bg-white/20" />
        
        <div className="grid grid-cols-2 gap-1.5">
          <div className="bg-green-500/30 p-1.5 rounded-lg border border-green-400/30">
            <div className="text-[8px] text-green-100 font-medium">Excelente</div>
            <div className="text-sm font-bold text-green-50">{stats.excelente}</div>
          </div>
          <div className="bg-blue-500/30 p-1.5 rounded-lg border border-blue-400/30">
            <div className="text-[8px] text-blue-100 font-medium">Bom</div>
            <div className="text-sm font-bold text-blue-50">{stats.bom}</div>
          </div>
          <div className="bg-yellow-500/30 p-1.5 rounded-lg border border-yellow-400/30">
            <div className="text-[8px] text-yellow-100 font-medium">Médio</div>
            <div className="text-sm font-bold text-yellow-50">{stats.medio}</div>
          </div>
          <div className="bg-red-500/30 p-1.5 rounded-lg border border-red-400/30">
            <div className="text-[8px] text-red-100 font-medium">Baixo</div>
            <div className="text-sm font-bold text-red-50">{stats.baixo}</div>
          </div>
        </div>

        {stats.baixo > 0 && (
          <Badge className="bg-red-500 text-white text-[8px] px-1.5 py-0.5">
            {stats.baixo} produto{stats.baixo > 1 ? 's' : ''} precisa{stats.baixo > 1 ? 'm' : ''} atenção
          </Badge>
        )}
      </div>
    </CardInsightIA>
  );
}

/**
 * Card Especializado: Insights de Precificação
 */
export function CardInsightsPrecificacao({ insights }) {
  if (!insights) return null;

  const statusConfig = {
    saudavel: { tipo: 'success', label: 'Saudável' },
    atencao: { tipo: 'warning', label: 'Atenção' },
    critico: { tipo: 'error', label: 'Crítico' }
  };

  const status = statusConfig[insights.analise_margem?.status] || statusConfig.atencao;

  return (
    <CardInsightIA
      titulo="Insights Precificação"
      tipo={status.tipo}
      icone="dollar"
    >
      <div className="space-y-2">
        <div className="p-2 rounded-lg bg-white/10 border border-white/20">
          <div className="flex items-center gap-1.5 mb-1">
            <DollarSign className="w-3 h-3" />
            <span className="font-bold text-[9px]">Margem: {status.label}</span>
          </div>
          <p className="text-[8px] text-white/90 leading-tight">{insights.analise_margem?.comentario}</p>
        </div>

        {insights.oportunidades_bundling && insights.oportunidades_bundling.length > 0 && (
          <div className="bg-white/10 p-2 rounded-lg border border-white/20">
            <div className="font-bold text-[9px] mb-1">Oportunidades</div>
            <ul className="text-[8px] space-y-0.5">
              {insights.oportunidades_bundling.slice(0, 2).map((oportunidade, idx) => (
                <li key={idx} className="flex items-start gap-1">
                  <CheckCircle className="w-2.5 h-2.5 text-green-300 mt-0.5 flex-shrink-0" />
                  <span className="line-clamp-2">{oportunidade}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-[8px] text-white/80 italic line-clamp-2">{insights.estrategia_geral}</p>
      </div>
    </CardInsightIA>
  );
}

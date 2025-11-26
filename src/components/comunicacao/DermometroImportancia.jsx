import React from "react";
import { 
  Flame, 
  Snowflake, 
  Sun, 
  Thermometer,
  Star,
  AlertTriangle,
  TrendingUp,
  Crown,
  Zap
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Níveis do Dermômetro
const NIVEIS_IMPORTANCIA = [
  { 
    min: 0, max: 20, 
    nivel: 'frio', 
    label: 'Frio', 
    icon: Snowflake, 
    cor: 'bg-blue-400', 
    corTexto: 'text-blue-600',
    gradiente: 'from-blue-400 to-blue-600',
    emoji: '❄️',
    descricao: 'Contato com baixo engajamento'
  },
  { 
    min: 21, max: 40, 
    nivel: 'morno', 
    label: 'Morno', 
    icon: Sun, 
    cor: 'bg-yellow-400', 
    corTexto: 'text-yellow-600',
    gradiente: 'from-yellow-400 to-orange-400',
    emoji: '🌤️',
    descricao: 'Contato com interesse moderado'
  },
  { 
    min: 41, max: 60, 
    nivel: 'quente', 
    label: 'Quente', 
    icon: Flame, 
    cor: 'bg-orange-500', 
    corTexto: 'text-orange-600',
    gradiente: 'from-orange-400 to-red-500',
    emoji: '🔥',
    descricao: 'Contato engajado e interessado'
  },
  { 
    min: 61, max: 80, 
    nivel: 'muito_quente', 
    label: 'Muito Quente', 
    icon: Zap, 
    cor: 'bg-red-500', 
    corTexto: 'text-red-600',
    gradiente: 'from-red-500 to-pink-600',
    emoji: '⚡',
    descricao: 'Alta probabilidade de conversão'
  },
  { 
    min: 81, max: 100, 
    nivel: 'vip', 
    label: 'VIP', 
    icon: Crown, 
    cor: 'bg-purple-600', 
    corTexto: 'text-purple-600',
    gradiente: 'from-purple-500 to-pink-500',
    emoji: '👑',
    descricao: 'Cliente estratégico prioritário'
  },
];

// Calcula o score de importância baseado nos dados do contato
export function calcularScoreImportancia(contato) {
  if (!contato) return 0;
  
  let score = 30; // Base
  
  // Tags de destaque aumentam muito o score
  const tags = contato.tags || [];
  if (tags.includes('vip')) score += 40;
  if (tags.includes('prioridade')) score += 25;
  if (tags.includes('fidelizado')) score += 20;
  if (tags.includes('potencial')) score += 15;
  
  // Tipo de contato
  if (contato.tipo_contato === 'cliente') score += 15;
  if (contato.tipo_contato === 'parceiro') score += 10;
  
  // Estágio no ciclo de vida
  if (contato.estagio_ciclo_vida === 'decisao') score += 20;
  if (contato.estagio_ciclo_vida === 'fidelizacao') score += 15;
  if (contato.estagio_ciclo_vida === 'consideracao') score += 10;
  
  // Score de engajamento existente
  if (contato.score_engajamento) {
    score += Math.floor(contato.score_engajamento * 0.2);
  }
  
  // Cliente score existente
  if (contato.cliente_score) {
    score += Math.floor(contato.cliente_score * 0.3);
  }
  
  // Interação recente aumenta score
  if (contato.ultima_interacao) {
    const diasSemInteracao = Math.floor(
      (new Date() - new Date(contato.ultima_interacao)) / (1000 * 60 * 60 * 24)
    );
    if (diasSemInteracao < 1) score += 10;
    else if (diasSemInteracao < 7) score += 5;
    else if (diasSemInteracao > 30) score -= 10;
  }
  
  // Atendente fidelizado indica relacionamento
  if (contato.atendente_fidelizado_vendas || contato.is_cliente_fidelizado) {
    score += 10;
  }
  
  return Math.min(100, Math.max(0, score));
}

// Obtém a configuração do nível baseado no score
export function getNivelImportancia(score) {
  return NIVEIS_IMPORTANCIA.find(n => score >= n.min && score <= n.max) || NIVEIS_IMPORTANCIA[0];
}

// Componente Principal do Dermômetro
export default function DermometroImportancia({ 
  contato, 
  tamanho = 'md', // 'xs', 'sm', 'md', 'lg'
  mostrarLabel = false,
  mostrarScore = false,
  animado = true,
  onClick
}) {
  const score = calcularScoreImportancia(contato);
  const nivel = getNivelImportancia(score);
  const Icon = nivel.icon;
  
  // Tamanhos
  const tamanhos = {
    xs: { container: 'w-5 h-5', icon: 'w-3 h-3', text: 'text-[9px]' },
    sm: { container: 'w-6 h-6', icon: 'w-3.5 h-3.5', text: 'text-[10px]' },
    md: { container: 'w-8 h-8', icon: 'w-4 h-4', text: 'text-xs' },
    lg: { container: 'w-10 h-10', icon: 'w-5 h-5', text: 'text-sm' },
  };
  
  const tam = tamanhos[tamanho] || tamanhos.md;
  
  // Verificar se precisa de atenção (classificação incompleta)
  const precisaAtencao = !contato?.tipo_contato || 
    (!contato?.tags || contato.tags.length === 0);
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className={`flex items-center gap-1.5 cursor-pointer ${onClick ? 'hover:scale-110 transition-transform' : ''}`}
            onClick={onClick}
          >
            {/* Ícone do Dermômetro */}
            <div className={`
              ${tam.container} rounded-full 
              bg-gradient-to-br ${nivel.gradiente}
              flex items-center justify-center
              shadow-lg shadow-${nivel.cor}/30
              ${animado ? 'animate-pulse' : ''}
              relative
            `}>
              <Icon className={`${tam.icon} text-white`} />
              
              {/* Indicador de Atenção */}
              {precisaAtencao && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center border border-white">
                  <AlertTriangle className="w-2 h-2 text-white" />
                </div>
              )}
            </div>
            
            {/* Label e Score */}
            {(mostrarLabel || mostrarScore) && (
              <div className="flex flex-col">
                {mostrarLabel && (
                  <span className={`${tam.text} font-semibold ${nivel.corTexto}`}>
                    {nivel.emoji} {nivel.label}
                  </span>
                )}
                {mostrarScore && (
                  <span className={`${tam.text} text-slate-500`}>
                    {score} pts
                  </span>
                )}
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="p-3 max-w-xs">
          <div className="space-y-2">
            {/* Header */}
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${nivel.gradiente} flex items-center justify-center`}>
                <Icon className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className={`font-bold ${nivel.corTexto}`}>
                  {nivel.emoji} {nivel.label}
                </p>
                <p className="text-xs text-slate-500">{score} pontos</p>
              </div>
            </div>
            
            {/* Barra de Progresso */}
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div 
                className={`h-full bg-gradient-to-r ${nivel.gradiente} transition-all duration-500`}
                style={{ width: `${score}%` }}
              />
            </div>
            
            {/* Descrição */}
            <p className="text-xs text-slate-600">{nivel.descricao}</p>
            
            {/* Alerta de Classificação */}
            {precisaAtencao && (
              <div className="flex items-center gap-1.5 p-2 bg-amber-50 border border-amber-200 rounded-md">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span className="text-xs text-amber-700 font-medium">
                  Complete a classificação deste contato!
                </span>
              </div>
            )}
            
            {/* Fatores do Score */}
            <div className="pt-2 border-t border-slate-100">
              <p className="text-[10px] text-slate-400 font-medium mb-1">FATORES:</p>
              <div className="flex flex-wrap gap-1">
                {contato?.tipo_contato && (
                  <Badge variant="outline" className="text-[10px]">
                    {contato.tipo_contato === 'cliente' ? '💎' : '🎯'} {contato.tipo_contato}
                  </Badge>
                )}
                {contato?.estagio_ciclo_vida && (
                  <Badge variant="outline" className="text-[10px]">
                    📊 {contato.estagio_ciclo_vida}
                  </Badge>
                )}
                {contato?.tags?.slice(0, 2).map(tag => (
                  <Badge key={tag} variant="outline" className="text-[10px]">
                    🏷️ {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Componente Compacto para Sidebar
export function DermometroCompacto({ contato, onClick }) {
  const score = calcularScoreImportancia(contato);
  const nivel = getNivelImportancia(score);
  const Icon = nivel.icon;
  
  const precisaAtencao = !contato?.tipo_contato || 
    (!contato?.tags || contato.tags.length === 0);
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className={`relative w-5 h-5 rounded-full bg-gradient-to-br ${nivel.gradiente} flex items-center justify-center shadow-sm cursor-pointer hover:scale-110 transition-transform`}
            onClick={onClick}
          >
            <Icon className="w-3 h-3 text-white" />
            {precisaAtencao && (
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full border border-white" />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          <div className="flex items-center gap-1">
            <span>{nivel.emoji}</span>
            <span className="font-medium">{nivel.label}</span>
            <span className="text-slate-400">({score}pts)</span>
          </div>
          {precisaAtencao && (
            <p className="text-amber-500 text-[10px] mt-1">⚠️ Classificar!</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Barra Visual do Dermômetro (para o Header do Chat)
export function BarraDermometro({ contato, className = '' }) {
  const score = calcularScoreImportancia(contato);
  const nivel = getNivelImportancia(score);
  const Icon = nivel.icon;
  
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${nivel.gradiente} flex items-center justify-center shadow-md`}>
        <Icon className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="flex-1 min-w-[80px]">
        <div className="flex items-center justify-between mb-0.5">
          <span className={`text-[10px] font-bold ${nivel.corTexto}`}>
            {nivel.emoji} {nivel.label}
          </span>
          <span className="text-[10px] text-slate-400">{score}%</span>
        </div>
        <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div 
            className={`h-full bg-gradient-to-r ${nivel.gradiente} transition-all duration-700 ease-out`}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// Exportar níveis para uso externo
export { NIVEIS_IMPORTANCIA };
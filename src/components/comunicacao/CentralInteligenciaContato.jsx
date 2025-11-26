import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  Flame, Snowflake, Sun, Crown, Zap, Star, AlertTriangle, TrendingUp,
  Target, Building2, Truck, Handshake, User, Users, UserCheck, Tag,
  MessageSquare, Phone, Calendar, Gift, Sparkles, ArrowRight, Clock,
  CheckCircle2, XCircle, ChevronRight, Heart, Lightbulb, Send
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ETIQUETAS_FIXAS_CONTATO } from "./EtiquetadorContato";

// ============================================================================
// CONFIGURAÇÕES DO SISTEMA DE CLASSIFICAÇÃO INTELIGENTE
// ============================================================================

const TIPOS_CONTATO = [
  { value: 'lead', label: 'Lead', icon: Target, color: 'bg-amber-500', gradiente: 'from-amber-400 to-amber-600', emoji: '🎯', descricao: 'Potencial cliente em prospecção' },
  { value: 'cliente', label: 'Cliente', icon: Building2, color: 'bg-emerald-500', gradiente: 'from-emerald-400 to-emerald-600', emoji: '💎', descricao: 'Cliente ativo com relacionamento' },
  { value: 'fornecedor', label: 'Fornecedor', icon: Truck, color: 'bg-blue-500', gradiente: 'from-blue-400 to-blue-600', emoji: '🏭', descricao: 'Parceiro de fornecimento' },
  { value: 'parceiro', label: 'Parceiro', icon: Handshake, color: 'bg-purple-500', gradiente: 'from-purple-400 to-purple-600', emoji: '🤝', descricao: 'Parceiro estratégico' },
];

const ESTAGIOS_JORNADA = [
  { value: 'descoberta', label: 'Descoberta', color: 'bg-slate-400', emoji: '🔍', proxima_acao: 'Apresentar a empresa e entender necessidades' },
  { value: 'consideracao', label: 'Consideração', color: 'bg-blue-400', emoji: '🤔', proxima_acao: 'Enviar proposta ou demonstração' },
  { value: 'decisao', label: 'Decisão', color: 'bg-amber-500', emoji: '⚖️', proxima_acao: 'Negociar e fechar negócio' },
  { value: 'pos_venda', label: 'Pós-Venda', color: 'bg-green-500', emoji: '✅', proxima_acao: 'Garantir satisfação e onboarding' },
  { value: 'fidelizacao', label: 'Fidelização', color: 'bg-purple-500', emoji: '💜', proxima_acao: 'Manter relacionamento e upsell' },
  { value: 'reativacao', label: 'Reativação', color: 'bg-red-400', emoji: '🔄', proxima_acao: 'Reconquistar cliente inativo' },
];

const NIVEIS_TEMPERATURA = [
  { min: 0, max: 20, nivel: 'frio', label: 'Frio', icon: Snowflake, cor: 'bg-blue-400', gradiente: 'from-blue-400 to-blue-600', emoji: '❄️', sugestao: 'Iniciar abordagem com conteúdo de valor' },
  { min: 21, max: 40, nivel: 'morno', label: 'Morno', icon: Sun, cor: 'bg-yellow-400', gradiente: 'from-yellow-400 to-orange-400', emoji: '🌤️', sugestao: 'Nutrir com informações relevantes' },
  { min: 41, max: 60, nivel: 'quente', label: 'Quente', icon: Flame, cor: 'bg-orange-500', gradiente: 'from-orange-400 to-red-500', emoji: '🔥', sugestao: 'Apresentar proposta comercial' },
  { min: 61, max: 80, nivel: 'muito_quente', label: 'Muito Quente', icon: Zap, cor: 'bg-red-500', gradiente: 'from-red-500 to-pink-600', emoji: '⚡', sugestao: 'Fechar negócio - alta probabilidade!' },
  { min: 81, max: 100, nivel: 'vip', label: 'VIP', icon: Crown, cor: 'bg-purple-600', gradiente: 'from-purple-500 to-pink-500', emoji: '👑', sugestao: 'Tratamento premium e exclusivo' },
];

const ACOES_SUGERIDAS = [
  { id: 'mensagem', label: 'Enviar Mensagem', icon: MessageSquare, cor: 'bg-blue-500', descricao: 'Iniciar ou continuar conversa' },
  { id: 'ligar', label: 'Ligar', icon: Phone, cor: 'bg-green-500', descricao: 'Contato telefônico direto' },
  { id: 'agendar', label: 'Agendar Reunião', icon: Calendar, cor: 'bg-purple-500', descricao: 'Marcar compromisso' },
  { id: 'proposta', label: 'Enviar Proposta', icon: Send, cor: 'bg-amber-500', descricao: 'Apresentar orçamento' },
  { id: 'presente', label: 'Enviar Mimo', icon: Gift, cor: 'bg-pink-500', descricao: 'Surpreender cliente VIP' },
];

// ============================================================================
// FUNÇÕES DE CÁLCULO
// ============================================================================

function calcularScoreContato(contato) {
  if (!contato) return 0;
  
  let score = 25; // Base
  
  const tags = contato.tags || [];
  if (tags.includes('vip')) score += 45;
  if (tags.includes('prioridade')) score += 30;
  if (tags.includes('fidelizado')) score += 25;
  if (tags.includes('potencial')) score += 20;
  if (tags.includes('urgente')) score += 15;
  
  if (contato.tipo_contato === 'cliente') score += 20;
  if (contato.tipo_contato === 'parceiro') score += 15;
  
  if (contato.estagio_ciclo_vida === 'decisao') score += 25;
  if (contato.estagio_ciclo_vida === 'fidelizacao') score += 20;
  if (contato.estagio_ciclo_vida === 'consideracao') score += 15;
  
  if (contato.score_engajamento) score += Math.floor(contato.score_engajamento * 0.25);
  if (contato.cliente_score) score += Math.floor(contato.cliente_score * 0.35);
  
  if (contato.ultima_interacao) {
    const diasSemInteracao = Math.floor((new Date() - new Date(contato.ultima_interacao)) / (1000 * 60 * 60 * 24));
    if (diasSemInteracao < 1) score += 15;
    else if (diasSemInteracao < 3) score += 10;
    else if (diasSemInteracao < 7) score += 5;
    else if (diasSemInteracao > 30) score -= 15;
    else if (diasSemInteracao > 14) score -= 5;
  }
  
  if (contato.atendente_fidelizado_vendas || contato.is_cliente_fidelizado) score += 15;
  
  return Math.min(100, Math.max(0, score));
}

function getNivelTemperatura(score) {
  return NIVEIS_TEMPERATURA.find(n => score >= n.min && score <= n.max) || NIVEIS_TEMPERATURA[0];
}

function getProximaAcaoSugerida(contato) {
  if (!contato) return ACOES_SUGERIDAS[0];
  
  const score = calcularScoreContato(contato);
  const nivel = getNivelTemperatura(score);
  const estagio = contato.estagio_ciclo_vida;
  const tags = contato.tags || [];
  
  // VIP = tratamento especial
  if (tags.includes('vip') || nivel.nivel === 'vip') {
    return ACOES_SUGERIDAS.find(a => a.id === 'presente') || ACOES_SUGERIDAS[0];
  }
  
  // Em decisão ou muito quente = proposta
  if (estagio === 'decisao' || nivel.nivel === 'muito_quente') {
    return ACOES_SUGERIDAS.find(a => a.id === 'proposta') || ACOES_SUGERIDAS[0];
  }
  
  // Consideração ou quente = agendar reunião
  if (estagio === 'consideracao' || nivel.nivel === 'quente') {
    return ACOES_SUGERIDAS.find(a => a.id === 'agendar') || ACOES_SUGERIDAS[0];
  }
  
  // Urgente = ligar
  if (tags.includes('urgente') || tags.includes('prioridade')) {
    return ACOES_SUGERIDAS.find(a => a.id === 'ligar') || ACOES_SUGERIDAS[0];
  }
  
  // Default = mensagem
  return ACOES_SUGERIDAS[0];
}

function getClassificacaoStatus(contato) {
  const problemas = [];
  
  if (!contato?.tipo_contato) problemas.push('Tipo não definido');
  if (!contato?.estagio_ciclo_vida) problemas.push('Estágio não definido');
  if (!contato?.tags || contato.tags.length === 0) problemas.push('Sem etiquetas');
  if (!contato?.atendente_fidelizado_vendas && contato?.tipo_contato === 'cliente') {
    problemas.push('Sem atendente fixo');
  }
  
  if (problemas.length === 0) return { status: 'completo', cor: 'text-green-600', icon: CheckCircle2 };
  if (problemas.length <= 2) return { status: 'parcial', cor: 'text-amber-600', icon: AlertTriangle, problemas };
  return { status: 'incompleto', cor: 'text-red-600', icon: XCircle, problemas };
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function CentralInteligenciaContato({ 
  contato, 
  onUpdate, 
  variant = 'full', // 'full', 'compact', 'mini'
  showSugestoes = true 
}) {
  const [salvando, setSalvando] = useState(false);
  const [mostrarDetalhes, setMostrarDetalhes] = useState(false);
  const queryClient = useQueryClient();

  const { data: atendentes = [] } = useQuery({
    queryKey: ['atendentes-whatsapp'],
    queryFn: () => base44.entities.User.filter({ is_whatsapp_attendant: true }, 'full_name'),
    staleTime: 5 * 60 * 1000
  });

  const { data: etiquetasDB = [] } = useQuery({
    queryKey: ['etiquetas-contato'],
    queryFn: () => base44.entities.EtiquetaContato.filter({ ativa: true }, 'nome'),
    staleTime: 5 * 60 * 1000
  });

  const todasEtiquetas = [...ETIQUETAS_FIXAS_CONTATO, ...etiquetasDB.map(etq => ({
    nome: etq.nome,
    label: etq.label,
    emoji: etq.emoji || '🏷️',
    cor: etq.cor || 'bg-slate-400',
    destaque: etq.destaque || false
  }))];

  const score = calcularScoreContato(contato);
  const nivel = getNivelTemperatura(score);
  const tipoAtual = TIPOS_CONTATO.find(t => t.value === contato?.tipo_contato);
  const estagioAtual = ESTAGIOS_JORNADA.find(e => e.value === contato?.estagio_ciclo_vida);
  const proximaAcao = getProximaAcaoSugerida(contato);
  const classificacaoStatus = getClassificacaoStatus(contato);
  const Icon = nivel.icon;

  const atualizarContato = async (campo, valor) => {
    if (salvando || !contato) return;
    setSalvando(true);
    try {
      await base44.entities.Contact.update(contato.id, { [campo]: valor });
      toast.success('✅ Atualizado!');
      queryClient.invalidateQueries({ queryKey: ['contatos'] });
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('[CentralInteligencia] Erro:', error);
      toast.error('Erro ao atualizar');
    } finally {
      setSalvando(false);
    }
  };

  const toggleEtiqueta = async (valor) => {
    if (salvando || !contato) return;
    const tags = contato.tags || [];
    const novasTags = tags.includes(valor) 
      ? tags.filter(t => t !== valor)
      : [...tags, valor];
    await atualizarContato('tags', novasTags);
  };

  // ============================================================================
  // VARIANTE MINI - Apenas ícone com tooltip
  // ============================================================================
  if (variant === 'mini') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div 
              className={`relative w-6 h-6 rounded-full bg-gradient-to-br ${nivel.gradiente} flex items-center justify-center shadow-md cursor-pointer hover:scale-110 transition-transform`}
              onClick={() => setMostrarDetalhes(!mostrarDetalhes)}
            >
              <Icon className="w-3.5 h-3.5 text-white" />
              {classificacaoStatus.status !== 'completo' && (
                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border border-white animate-pulse" />
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="p-3 max-w-xs">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${nivel.gradiente} flex items-center justify-center`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="font-bold">{nivel.emoji} {nivel.label}</p>
                  <p className="text-xs text-slate-500">{score} pontos</p>
                </div>
              </div>
              
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full bg-gradient-to-r ${nivel.gradiente}`}
                  style={{ width: `${score}%` }}
                />
              </div>
              
              {showSugestoes && (
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-[10px] text-slate-400 font-medium">PRÓXIMA AÇÃO:</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className={`w-5 h-5 rounded ${proximaAcao.cor} flex items-center justify-center`}>
                      <proximaAcao.icon className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-xs font-medium">{proximaAcao.label}</span>
                  </div>
                </div>
              )}
              
              {classificacaoStatus.status !== 'completo' && (
                <div className="flex items-center gap-1.5 p-2 bg-amber-50 border border-amber-200 rounded">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-[10px] text-amber-700 font-medium">
                    Classificar contato!
                  </span>
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // ============================================================================
  // VARIANTE COMPACT - Linha compacta
  // ============================================================================
  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2">
        {/* Termômetro */}
        <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${nivel.gradiente} flex items-center justify-center shadow-md relative`}>
          <Icon className="w-4 h-4 text-white" />
          {classificacaoStatus.status !== 'completo' && (
            <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full border border-white animate-pulse" />
          )}
        </div>
        
        {/* Tipo */}
        {tipoAtual ? (
          <Badge className={`${tipoAtual.color} text-white text-[10px] py-0`}>
            {tipoAtual.emoji}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] py-0 border-dashed text-slate-400">
            ?
          </Badge>
        )}
        
        {/* Estágio */}
        {estagioAtual && (
          <Badge className={`${estagioAtual.color} text-white text-[10px] py-0`}>
            {estagioAtual.emoji}
          </Badge>
        )}
        
        {/* Etiquetas importantes */}
        {(contato?.tags || []).filter(t => ['vip', 'prioridade', 'urgente'].includes(t)).slice(0, 1).map(tag => {
          const cfg = todasEtiquetas.find(e => e.nome === tag);
          return (
            <span key={tag} className="text-sm animate-pulse" title={cfg?.label}>
              {cfg?.emoji}
            </span>
          );
        })}
        
        {/* Próxima Ação */}
        {showSugestoes && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={`w-5 h-5 rounded ${proximaAcao.cor} flex items-center justify-center cursor-help`}>
                  <proximaAcao.icon className="w-3 h-3 text-white" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs font-medium">{proximaAcao.label}</p>
                <p className="text-[10px] text-slate-400">{proximaAcao.descricao}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    );
  }

  // ============================================================================
  // VARIANTE FULL - Card completo interativo
  // ============================================================================
  return (
    <Card className="p-4 border-2 border-slate-100 hover:border-slate-200 transition-all bg-gradient-to-br from-white to-slate-50">
      {/* Header com Termômetro */}
      <div className="flex items-start gap-4 mb-4">
        <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${nivel.gradiente} flex items-center justify-center shadow-xl relative`}>
          <Icon className="w-8 h-8 text-white" />
          {classificacaoStatus.status !== 'completo' && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center border-2 border-white animate-bounce">
              <AlertTriangle className="w-3 h-3 text-white" />
            </div>
          )}
        </div>
        
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{nivel.emoji}</span>
            <h3 className="font-bold text-lg text-slate-800">{nivel.label}</h3>
            <Badge variant="outline" className="text-xs">
              {score} pts
            </Badge>
          </div>
          
          {/* Barra de Temperatura */}
          <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden mb-2">
            <motion.div 
              className={`h-full bg-gradient-to-r ${nivel.gradiente}`}
              initial={{ width: 0 }}
              animate={{ width: `${score}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
          
          <p className="text-sm text-slate-600">{nivel.sugestao}</p>
        </div>
      </div>

      {/* Status da Classificação */}
      <div className={`flex items-center gap-2 p-2 rounded-lg mb-4 ${
        classificacaoStatus.status === 'completo' ? 'bg-green-50 border border-green-200' :
        classificacaoStatus.status === 'parcial' ? 'bg-amber-50 border border-amber-200' :
        'bg-red-50 border border-red-200'
      }`}>
        <classificacaoStatus.icon className={`w-5 h-5 ${classificacaoStatus.cor}`} />
        <div className="flex-1">
          <p className={`text-sm font-medium ${classificacaoStatus.cor}`}>
            {classificacaoStatus.status === 'completo' ? '✅ Classificação Completa' :
             classificacaoStatus.status === 'parcial' ? '⚠️ Classificação Parcial' :
             '❌ Classificação Incompleta'}
          </p>
          {classificacaoStatus.problemas && (
            <p className="text-[10px] text-slate-500">
              Falta: {classificacaoStatus.problemas.join(', ')}
            </p>
          )}
        </div>
      </div>

      {/* Grid de Classificação Rápida */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Tipo */}
        <div>
          <p className="text-[10px] text-slate-500 font-medium mb-1.5 uppercase">Tipo de Contato</p>
          <div className="flex flex-wrap gap-1">
            {TIPOS_CONTATO.map(tipo => (
              <button
                key={tipo.value}
                onClick={() => atualizarContato('tipo_contato', tipo.value)}
                disabled={salvando}
                className={`px-2 py-1 rounded-lg text-xs font-medium transition-all ${
                  contato?.tipo_contato === tipo.value
                    ? `bg-gradient-to-r ${tipo.gradiente} text-white shadow-md scale-105`
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tipo.emoji} {tipo.label}
              </button>
            ))}
          </div>
        </div>

        {/* Estágio */}
        <div>
          <p className="text-[10px] text-slate-500 font-medium mb-1.5 uppercase">Estágio da Jornada</p>
          <div className="flex flex-wrap gap-1">
            {ESTAGIOS_JORNADA.map(estagio => (
              <button
                key={estagio.value}
                onClick={() => atualizarContato('estagio_ciclo_vida', estagio.value)}
                disabled={salvando}
                className={`px-2 py-1 rounded-lg text-xs font-medium transition-all ${
                  contato?.estagio_ciclo_vida === estagio.value
                    ? `${estagio.color} text-white shadow-md scale-105`
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {estagio.emoji}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Etiquetas Rápidas */}
      <div className="mb-4">
        <p className="text-[10px] text-slate-500 font-medium mb-1.5 uppercase flex items-center gap-1">
          <Star className="w-3 h-3" />
          Etiquetas Importantes
        </p>
        <div className="flex flex-wrap gap-1">
          {todasEtiquetas
            .filter(e => e.destaque || ['vip', 'prioridade', 'fidelizado', 'potencial', 'urgente'].includes(e.nome))
            .map(etq => {
              const ativa = (contato?.tags || []).includes(etq.nome);
              return (
                <button
                  key={etq.nome}
                  onClick={() => toggleEtiqueta(etq.nome)}
                  disabled={salvando}
                  className={`px-2 py-1 rounded-full text-xs font-medium transition-all ${
                    ativa
                      ? `${etq.cor} text-white shadow-md scale-105`
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-dashed border-slate-300'
                  }`}
                >
                  {etq.emoji} {etq.label}
                </button>
              );
            })}
        </div>
      </div>

      {/* Próxima Ação Sugerida */}
      {showSugestoes && (
        <div className="p-3 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="w-4 h-4 text-indigo-600" />
            <p className="text-xs font-bold text-indigo-800 uppercase">Próxima Ação Sugerida</p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl ${proximaAcao.cor} flex items-center justify-center shadow-lg`}>
              <proximaAcao.icon className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-slate-800">{proximaAcao.label}</p>
              <p className="text-xs text-slate-600">{proximaAcao.descricao}</p>
            </div>
            <Button size="sm" className={`${proximaAcao.cor} text-white shadow-md`}>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
          
          {estagioAtual && (
            <p className="text-[10px] text-indigo-600 mt-2 italic">
              💡 {estagioAtual.proxima_acao}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================
export { 
  TIPOS_CONTATO, 
  ESTAGIOS_JORNADA, 
  NIVEIS_TEMPERATURA, 
  ACOES_SUGERIDAS,
  calcularScoreContato, 
  getNivelTemperatura, 
  getProximaAcaoSugerida,
  getClassificacaoStatus
};
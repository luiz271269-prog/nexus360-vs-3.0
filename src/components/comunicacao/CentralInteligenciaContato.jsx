import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Flame, 
  Thermometer, 
  Snowflake, 
  Sun,
  Zap,
  Target,
  Building2,
  Truck,
  Handshake,
  Star,
  Phone,
  MessageSquare,
  Calendar,
  Gift,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  Heart,
  Crown,
  Loader2,
  ChevronDown,
  User,
  UserCheck,
  Columns,
  Tag
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 FONTE ÚNICA DE VERDADE - CLASSIFICAÇÃO DE CONTATOS
// ═══════════════════════════════════════════════════════════════════════════════

// 📌 TIPOS DE CONTATO (Importado do Motor de Roteamento)
// 1-Novo (s/ definição), 2-Lead, 3-Cliente, 4-Fornecedor, 5-Parceiro
export const TIPOS_CONTATO = [
  { value: 'novo', label: 'Contato s/ Definição', icon: User, color: 'bg-slate-400', emoji: '❓', prioridade: 0, descricao: 'Contato ainda não classificado - precisa de pré-atendimento' },
  { value: 'lead', label: 'Lead', icon: Target, color: 'bg-amber-500', emoji: '🎯', prioridade: 1, descricao: 'Potencial cliente em prospecção' },
  { value: 'cliente', label: 'Cliente', icon: Building2, color: 'bg-emerald-500', emoji: '💎', prioridade: 3, descricao: 'Cliente ativo com histórico de compras' },
  { value: 'fornecedor', label: 'Fornecedor', icon: Truck, color: 'bg-blue-500', emoji: '🏭', prioridade: 2, descricao: 'Fornecedor de produtos/serviços' },
  { value: 'parceiro', label: 'Parceiro', icon: Handshake, color: 'bg-purple-500', emoji: '🤝', prioridade: 2, descricao: 'Parceiro comercial ou de negócios' },
];

// 📌 FILAS/SETORES DE ATENDIMENTO
// Cada setor tem tipos de contato aceitos e campo de fidelização específico
export const FILAS_ATENDIMENTO = [
  { value: 'vendas', label: 'Vendas', emoji: '💰', color: 'bg-green-500', descricao: 'Atendimento comercial e orçamentos', tipos_aceitos: ['lead', 'cliente', 'parceiro', 'novo'], campo_fidelizacao: 'atendente_fidelizado_vendas' },
  { value: 'assistencia', label: 'Assistência', emoji: '🔧', color: 'bg-orange-500', descricao: 'Suporte técnico e assistência', tipos_aceitos: ['cliente'], campo_fidelizacao: 'atendente_fidelizado_assistencia' },
  { value: 'financeiro', label: 'Financeiro', emoji: '💳', color: 'bg-amber-500', descricao: 'Pagamentos, boletos e notas', tipos_aceitos: ['cliente'], campo_fidelizacao: 'atendente_fidelizado_financeiro' },
  { value: 'fornecedor', label: 'Fornecedor/Compras', emoji: '📦', color: 'bg-blue-500', descricao: 'Cotações e ofertas de fornecedores', tipos_aceitos: ['fornecedor'], campo_fidelizacao: 'atendente_fidelizado_fornecedor' },
  { value: 'geral', label: 'Geral', emoji: '📋', color: 'bg-slate-500', descricao: 'Atendimento geral', tipos_aceitos: ['novo', 'lead', 'cliente', 'fornecedor', 'parceiro'], campo_fidelizacao: null },
];

// 📌 ESTÁGIOS DO KANBAN/JORNADA
export const ESTAGIOS_KANBAN = [
  { value: 'descoberta', label: 'Descoberta', color: 'bg-slate-400', emoji: '🔍', ordem: 1 },
  { value: 'consideracao', label: 'Consideração', color: 'bg-blue-400', emoji: '🤔', ordem: 2 },
  { value: 'decisao', label: 'Decisão', color: 'bg-amber-400', emoji: '⚖️', ordem: 3 },
  { value: 'pos_venda', label: 'Pós-Venda', color: 'bg-green-400', emoji: '✅', ordem: 4 },
  { value: 'fidelizacao', label: 'Fidelização', color: 'bg-purple-400', emoji: '💜', ordem: 5 },
  { value: 'reativacao', label: 'Reativação', color: 'bg-red-400', emoji: '🔄', ordem: 6 },
];

// 📌 ETIQUETAS FIXAS DE CONTATO
export const ETIQUETAS_CONTATO = [
  { nome: 'vip', label: 'VIP', emoji: '👑', cor: 'bg-amber-500', destaque: true },
  { nome: 'prioridade', label: 'Prioridade', emoji: '⚡', cor: 'bg-red-500', destaque: true },
  { nome: 'fidelizado', label: 'Fidelizado', emoji: '💎', cor: 'bg-emerald-500', destaque: true },
  { nome: 'potencial', label: 'Alto Potencial', emoji: '🚀', cor: 'bg-purple-500', destaque: true },
  { nome: 'atencao', label: 'Requer Atenção', emoji: '⚠️', cor: 'bg-orange-500', destaque: false },
  { nome: 'novo', label: 'Novo', emoji: '🆕', cor: 'bg-blue-500', destaque: false },
  { nome: 'recorrente', label: 'Recorrente', emoji: '🔄', cor: 'bg-teal-500', destaque: false },
  { nome: 'indicacao', label: 'Indicação', emoji: '🤝', cor: 'bg-pink-500', destaque: false },
];

// 📌 NÍVEIS DE TEMPERATURA (IMPORTÂNCIA)
export const NIVEIS_TEMPERATURA = [
  { 
    min: 0, max: 20, 
    label: 'Frio', 
    emoji: '❄️', 
    icon: Snowflake, 
    cor: 'text-blue-500',
    corFundo: 'bg-blue-100',
    gradiente: 'from-blue-400 to-blue-600',
    descricao: 'Contato novo ou sem engajamento recente'
  },
  { 
    min: 21, max: 40, 
    label: 'Esfriando', 
    emoji: '🌤️', 
    icon: Sun, 
    cor: 'text-cyan-500',
    corFundo: 'bg-cyan-100',
    gradiente: 'from-cyan-400 to-cyan-600',
    descricao: 'Engajamento baixo, precisa de atenção'
  },
  { 
    min: 41, max: 60, 
    label: 'Morno', 
    emoji: '☀️', 
    icon: Thermometer, 
    cor: 'text-amber-500',
    corFundo: 'bg-amber-100',
    gradiente: 'from-amber-400 to-amber-600',
    descricao: 'Engajamento moderado, oportunidade'
  },
  { 
    min: 61, max: 80, 
    label: 'Quente', 
    emoji: '🔥', 
    icon: Flame, 
    cor: 'text-orange-500',
    corFundo: 'bg-orange-100',
    gradiente: 'from-orange-400 to-orange-600',
    descricao: 'Alto engajamento, priorizar!'
  },
  { 
    min: 81, max: 100, 
    label: 'Em Chamas!', 
    emoji: '💥', 
    icon: Zap, 
    cor: 'text-red-500',
    corFundo: 'bg-red-100',
    gradiente: 'from-red-500 to-red-700',
    descricao: 'URGENTE! Cliente muito engajado'
  },
];

// 📌 AÇÕES SUGERIDAS
export const ACOES_SUGERIDAS = [
  { id: 'ligar', label: 'Ligar agora', emoji: '📞', icon: Phone, cor: 'bg-green-500', prioridade: 1 },
  { id: 'whatsapp', label: 'Enviar WhatsApp', emoji: '💬', icon: MessageSquare, cor: 'bg-emerald-500', prioridade: 2 },
  { id: 'agendar', label: 'Agendar contato', emoji: '📅', icon: Calendar, cor: 'bg-blue-500', prioridade: 3 },
  { id: 'oferta', label: 'Enviar oferta', emoji: '🎁', icon: Gift, cor: 'bg-purple-500', prioridade: 4 },
  { id: 'acompanhar', label: 'Acompanhar', emoji: '👁️', icon: TrendingUp, cor: 'bg-amber-500', prioridade: 5 },
  { id: 'fidelizar', label: 'Programa fidelidade', emoji: '💎', icon: Crown, cor: 'bg-pink-500', prioridade: 6 },
];

// ═══════════════════════════════════════════════════════════════════════════════
// 🧮 FUNÇÕES DE CÁLCULO - LÓGICA CENTRALIZADA
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calcula o score de importância do contato (0-100)
 * Quanto maior, mais "quente" e prioritário
 */
export function calcularScoreContato(contato) {
  if (!contato) return 0;
  
  let score = 0;
  
  // 1. TIPO DE CONTATO (até 25 pontos)
  const tipo = TIPOS_CONTATO.find(t => t.value === contato.tipo_contato);
  if (tipo) {
    score += tipo.prioridade * 8; // cliente=24, lead=8, fornecedor/parceiro=16
  }
  
  // 2. ETIQUETAS DE DESTAQUE (até 25 pontos)
  const tags = contato.tags || [];
  const tagsDestaque = ['vip', 'prioridade', 'fidelizado', 'potencial'];
  const temDestaque = tags.filter(t => tagsDestaque.includes(t)).length;
  score += temDestaque * 8;
  
  // 3. ESTÁGIO NA JORNADA (até 20 pontos)
  const estagiosQuentes = ['decisao', 'pos_venda', 'fidelizacao'];
  if (estagiosQuentes.includes(contato.estagio_ciclo_vida)) {
    score += 20;
  } else if (contato.estagio_ciclo_vida === 'consideracao') {
    score += 12;
  } else if (contato.estagio_ciclo_vida) {
    score += 5;
  }
  
  // 4. ENGAJAMENTO E SCORE EXISTENTE (até 15 pontos)
  if (contato.score_engajamento > 70) score += 15;
  else if (contato.score_engajamento > 40) score += 10;
  else if (contato.score_engajamento > 0) score += 5;
  
  if (contato.cliente_score > 70) score += 10;
  else if (contato.cliente_score > 40) score += 5;
  
  // 5. INTERAÇÃO RECENTE (até 15 pontos)
  if (contato.ultima_interacao) {
    const diasSemContato = Math.floor((new Date() - new Date(contato.ultima_interacao)) / (1000 * 60 * 60 * 24));
    if (diasSemContato <= 1) score += 15;
    else if (diasSemContato <= 7) score += 10;
    else if (diasSemContato <= 30) score += 5;
  }
  
  // 6. FIDELIZAÇÃO (até 10 pontos bonus)
  if (contato.is_cliente_fidelizado) score += 10;
  if (contato.atendente_fidelizado_vendas || contato.atendente_fidelizado_assistencia) score += 5;
  
  return Math.min(100, Math.max(0, score));
}

/**
 * Retorna o nível de temperatura baseado no score
 */
export function getNivelTemperatura(score) {
  return NIVEIS_TEMPERATURA.find(n => score >= n.min && score <= n.max) || NIVEIS_TEMPERATURA[0];
}

/**
 * Sugere a próxima ação baseada no contato
 */
export function getProximaAcaoSugerida(contato) {
  if (!contato) return ACOES_SUGERIDAS[4]; // acompanhar como padrão
  
  const score = calcularScoreContato(contato);
  const tags = contato.tags || [];
  
  // VIP ou Prioridade = Ligar
  if (tags.includes('vip') || tags.includes('prioridade') || score >= 80) {
    return ACOES_SUGERIDAS[0]; // ligar
  }
  
  // Em decisão = Enviar oferta
  if (contato.estagio_ciclo_vida === 'decisao') {
    return ACOES_SUGERIDAS[3]; // oferta
  }
  
  // Cliente fidelizado = Programa fidelidade
  if (contato.is_cliente_fidelizado || contato.tipo_contato === 'cliente') {
    return ACOES_SUGERIDAS[5]; // fidelizar
  }
  
  // Score quente = WhatsApp
  if (score >= 60) {
    return ACOES_SUGERIDAS[1]; // whatsapp
  }
  
  // Score morno = Agendar
  if (score >= 40) {
    return ACOES_SUGERIDAS[2]; // agendar
  }
  
  // Padrão = Acompanhar
  return ACOES_SUGERIDAS[4];
}

/**
 * Verifica o status da classificação do contato
 */
export function getClassificacaoStatus(contato) {
  if (!contato) return { status: 'incompleto', problemas: ['Contato não encontrado'], icon: AlertTriangle, cor: 'text-red-500' };
  
  const problemas = [];
  
  if (!contato.tipo_contato) problemas.push('Tipo');
  if (!contato.estagio_ciclo_vida) problemas.push('Estágio');
  if (!contato.tags || contato.tags.length === 0) problemas.push('Etiquetas');
  
  if (problemas.length === 0) {
    return { status: 'completo', icon: CheckCircle, cor: 'text-green-500' };
  } else if (problemas.length <= 1) {
    return { status: 'parcial', problemas, icon: Clock, cor: 'text-amber-500' };
  } else {
    return { status: 'incompleto', problemas, icon: AlertTriangle, cor: 'text-red-500' };
  }
}

/**
 * Busca config de etiqueta (fixa ou dinâmica)
 */
export function getEtiquetaConfig(nome, etiquetasDB = []) {
  const fixa = ETIQUETAS_CONTATO.find(e => e.nome === nome);
  if (fixa) return fixa;
  
  const dinamica = etiquetasDB.find(e => e.nome === nome);
  if (dinamica) return {
    nome: dinamica.nome,
    label: dinamica.label,
    emoji: dinamica.emoji || '🏷️',
    cor: dinamica.cor || 'bg-slate-400',
    destaque: dinamica.destaque || false,
    tipos_contato_aplicaveis: dinamica.tipos_contato_aplicaveis || [],
    filas_aplicaveis: dinamica.filas_aplicaveis || []
  };
  
  return { nome, label: nome, emoji: '🏷️', cor: 'bg-slate-400', destaque: false };
}

/**
 * Filtra etiquetas aplicáveis ao tipo de contato e fila
 */
export function filtrarEtiquetasAplicaveis(etiquetas, tipoContato, filaAtual) {
  return etiquetas.filter(etq => {
    // Etiquetas fixas sempre são aplicáveis
    if (ETIQUETAS_CONTATO.some(e => e.nome === etq.nome)) return true;
    
    // Se não tem restrição de tipo, é aplicável a todos
    const tiposAplicaveis = etq.tipos_contato_aplicaveis || [];
    const filasAplicaveis = etq.filas_aplicaveis || [];
    
    const tipoOk = tiposAplicaveis.length === 0 || tiposAplicaveis.includes(tipoContato);
    const filaOk = filasAplicaveis.length === 0 || filasAplicaveis.includes(filaAtual);
    
    return tipoOk && filaOk;
  });
}

/**
 * Retorna o pré-atendimento recomendado baseado no tipo de contato e fila
 */
export function getPreAtendimentoRecomendado(tipoContato, filaAtual) {
  const configs = {
    // Novo contato - precisa coletar dados para qualificar
    'novo': {
      acao: 'qualificar',
      mensagem: 'Olá! Seja bem-vindo. Para melhor atendê-lo, poderia me informar:',
      dadosNecessarios: ['nome', 'empresa', 'interesse'],
      fluxo: 'pre_atendimento_qualificacao'
    },
    // Lead em vendas - foco em conversão
    'lead_vendas': {
      acao: 'converter',
      mensagem: 'Olá! Que bom ter você de volta. Como posso ajudar com sua cotação?',
      dadosNecessarios: [],
      fluxo: 'pre_atendimento_lead_vendas'
    },
    // Cliente em vendas - prioridade alta
    'cliente_vendas': {
      acao: 'atender_prioritario',
      mensagem: 'Olá! É sempre um prazer atendê-lo. Em que posso ajudar?',
      dadosNecessarios: [],
      fluxo: 'pre_atendimento_cliente_vip'
    },
    // Cliente em assistência
    'cliente_assistencia': {
      acao: 'suporte',
      mensagem: 'Olá! Nosso suporte técnico está pronto para ajudá-lo.',
      dadosNecessarios: ['numero_pedido', 'problema'],
      fluxo: 'pre_atendimento_suporte'
    },
    // Fornecedor - cotações e ofertas
    'fornecedor_fornecedor': {
      acao: 'cotacao',
      mensagem: 'Olá! Agradecemos seu contato. Por favor, envie sua proposta/cotação.',
      dadosNecessarios: ['produto', 'preco', 'prazo'],
      fluxo: 'pre_atendimento_fornecedor'
    },
    // Parceiro
    'parceiro_geral': {
      acao: 'parceria',
      mensagem: 'Olá! Seja bem-vindo. Como podemos colaborar?',
      dadosNecessarios: [],
      fluxo: 'pre_atendimento_parceiro'
    }
  };
  
  // Buscar config específica ou genérica
  const chaveEspecifica = `${tipoContato}_${filaAtual}`;
  const chaveGenerica = tipoContato;
  
  return configs[chaveEspecifica] || configs[chaveGenerica] || configs['novo'];
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 COMPONENTE PRINCIPAL - CENTRAL DE INTELIGÊNCIA DO CONTATO
// ═══════════════════════════════════════════════════════════════════════════════

export default function CentralInteligenciaContato({ 
  contato, 
  variant = 'mini', // 'mini' | 'compact' | 'full'
  onUpdate,
  showSugestoes = true 
}) {
  const [salvando, setSalvando] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const queryClient = useQueryClient();

  // Buscar atendentes
  const { data: atendentes = [] } = useQuery({
    queryKey: ['atendentes-central'],
    queryFn: () => base44.entities.User.filter({ is_whatsapp_attendant: true }, 'full_name'),
    staleTime: 5 * 60 * 1000
  });

  // Buscar etiquetas dinâmicas
  const { data: etiquetasDB = [] } = useQuery({
    queryKey: ['etiquetas-central'],
    queryFn: () => base44.entities.EtiquetaContato.filter({ ativa: true }, 'nome'),
    staleTime: 5 * 60 * 1000
  });

  // Combinar etiquetas fixas + dinâmicas
  const todasEtiquetasBase = [
    ...ETIQUETAS_CONTATO,
    ...etiquetasDB.map(etq => ({
      nome: etq.nome,
      label: etq.label,
      emoji: etq.emoji || '🏷️',
      cor: etq.cor || 'bg-slate-400',
      destaque: etq.destaque || false,
      tipos_contato_aplicaveis: etq.tipos_contato_aplicaveis || [],
      filas_aplicaveis: etq.filas_aplicaveis || []
    }))
  ];
  
  // Filtrar etiquetas aplicáveis ao contexto do contato
  const tipoContatoAtual = contato?.tipo_contato || 'novo';
  const todasEtiquetas = filtrarEtiquetasAplicaveis(todasEtiquetasBase, tipoContatoAtual, null);

  // Calcular dados do contato
  const score = calcularScoreContato(contato);
  const nivel = getNivelTemperatura(score);
  const proxAcao = getProximaAcaoSugerida(contato);
  const statusClass = getClassificacaoStatus(contato);
  const Icon = nivel.icon;
  
  // Dados atuais
  const tipoAtual = TIPOS_CONTATO.find(t => t.value === contato?.tipo_contato);
  const estagioAtual = ESTAGIOS_KANBAN.find(e => e.value === contato?.estagio_ciclo_vida);
  const etiquetasContato = contato?.tags || [];
  const atendenteAtual = contato?.atendente_fidelizado_vendas;

  // Handler para atualizar contato
  const atualizarContato = async (campo, valor) => {
    if (salvando || !contato) return;
    setSalvando(true);
    try {
      await base44.entities.Contact.update(contato.id, { [campo]: valor });
      toast.success('✅ Atualizado!');
      queryClient.invalidateQueries({ queryKey: ['contatos'] });
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('[Central] Erro:', error);
      toast.error('Erro ao atualizar');
    } finally {
      setSalvando(false);
    }
  };

  // Toggle etiqueta
  const toggleEtiqueta = async (nome) => {
    if (salvando || !contato) return;
    setSalvando(true);
    try {
      const novas = etiquetasContato.includes(nome)
        ? etiquetasContato.filter(e => e !== nome)
        : [...etiquetasContato, nome];
      
      await base44.entities.Contact.update(contato.id, { tags: novas });
      const config = getEtiquetaConfig(nome, etiquetasDB);
      toast.success(`${config.emoji} ${novas.includes(nome) ? 'Adicionada' : 'Removida'}`);
      queryClient.invalidateQueries({ queryKey: ['contatos'] });
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error('Erro ao atualizar');
    } finally {
      setSalvando(false);
    }
  };

  const handleClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 🔥 VARIANT: MINI - Apenas ícone de temperatura clicável
  // ═══════════════════════════════════════════════════════════════════════════
  if (variant === 'mini') {
    return (
      <DropdownMenu open={menuAberto} onOpenChange={setMenuAberto}>
        <DropdownMenuTrigger asChild onClick={handleClick}>
          <button
            className={`w-7 h-7 rounded-full bg-gradient-to-br ${nivel.gradiente} flex items-center justify-center shadow-lg border-2 border-white cursor-pointer hover:scale-110 transition-transform`}
            title={`${nivel.emoji} ${nivel.label} (${score}%) - Clique para classificar`}
            disabled={salvando}
          >
            {salvando ? (
              <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
            ) : (
              <Icon className="w-3.5 h-3.5 text-white" />
            )}
          </button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent align="start" className="w-80" onClick={handleClick}>
          {/* Header com Score Visual */}
          <div className={`p-3 ${nivel.corFundo} rounded-t-md border-b`}>
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${nivel.gradiente} flex items-center justify-center shadow-lg`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <p className={`font-bold ${nivel.cor}`}>{nivel.emoji} {nivel.label}</p>
                <p className="text-xs text-slate-600">{nivel.descricao}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-2 bg-white/50 rounded-full overflow-hidden">
                    <div 
                      className={`h-full bg-gradient-to-r ${nivel.gradiente}`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold">{score}%</span>
                </div>
              </div>
            </div>
            
            {/* Sugestão de Ação */}
            {showSugestoes && (
              <div className="mt-3 p-2 bg-white rounded-lg border border-slate-200 flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full ${proxAcao.cor} flex items-center justify-center`}>
                  <proxAcao.icon className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-slate-700">💡 Sugestão:</p>
                  <p className="text-sm font-medium">{proxAcao.emoji} {proxAcao.label}</p>
                </div>
              </div>
            )}
          </div>

          {/* Menu de Classificação */}
          <div className="p-2">
            {/* TIPO */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="cursor-pointer">
                <div className="flex items-center gap-2">
                  {tipoAtual ? (
                    <div className={`w-5 h-5 rounded ${tipoAtual.color} flex items-center justify-center`}>
                      <tipoAtual.icon className="w-3 h-3 text-white" />
                    </div>
                  ) : (
                    <User className="w-5 h-5 text-slate-400" />
                  )}
                  <span>Tipo: <strong>{tipoAtual?.label || 'Definir'}</strong></span>
                </div>
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  {TIPOS_CONTATO.map(tipo => (
                    <DropdownMenuItem
                      key={tipo.value}
                      onClick={(e) => { e.stopPropagation(); atualizarContato('tipo_contato', tipo.value); }}
                      className="cursor-pointer"
                    >
                      <div className={`w-5 h-5 rounded ${tipo.color} flex items-center justify-center mr-2`}>
                        <tipo.icon className="w-3 h-3 text-white" />
                      </div>
                      <span>{tipo.emoji} {tipo.label}</span>
                      {contato?.tipo_contato === tipo.value && <span className="ml-auto text-green-500">✓</span>}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>

            {/* ESTÁGIO */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="cursor-pointer">
                <div className="flex items-center gap-2">
                  <Columns className="w-5 h-5 text-slate-500" />
                  <span>Estágio: <strong>{estagioAtual?.label || 'Definir'}</strong></span>
                </div>
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  {ESTAGIOS_KANBAN.map(estagio => (
                    <DropdownMenuItem
                      key={estagio.value}
                      onClick={(e) => { e.stopPropagation(); atualizarContato('estagio_ciclo_vida', estagio.value); }}
                      className="cursor-pointer"
                    >
                      <div className={`w-4 h-4 rounded ${estagio.color} mr-2`} />
                      <span>{estagio.emoji} {estagio.label}</span>
                      {contato?.estagio_ciclo_vida === estagio.value && <span className="ml-auto text-green-500">✓</span>}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>

            {/* ATENDENTE */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="cursor-pointer">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-slate-500" />
                  <span>Atendente: <strong>{atendenteAtual || 'Nenhum'}</strong></span>
                </div>
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  <DropdownMenuItem
                    onClick={(e) => { e.stopPropagation(); atualizarContato('atendente_fidelizado_vendas', ''); }}
                    className="cursor-pointer"
                  >
                    <User className="w-4 h-4 mr-2 text-slate-400" />
                    <span className="text-slate-500">Nenhum</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {atendentes.map(atend => (
                    <DropdownMenuItem
                      key={atend.id}
                      onClick={(e) => { e.stopPropagation(); atualizarContato('atendente_fidelizado_vendas', atend.full_name); }}
                      className="cursor-pointer"
                    >
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center mr-2">
                        <span className="text-white text-xs font-bold">{atend.full_name?.charAt(0)}</span>
                      </div>
                      <span>{atend.full_name}</span>
                      {atendenteAtual === atend.full_name && <span className="ml-auto text-green-500">✓</span>}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>

            <DropdownMenuSeparator />

            {/* ETIQUETAS RÁPIDAS */}
            <DropdownMenuLabel className="text-xs text-slate-500 flex items-center gap-1">
              <Star className="w-3 h-3" /> Etiquetas Destaque
            </DropdownMenuLabel>
            <div className="px-2 py-1 flex flex-wrap gap-1">
              {todasEtiquetas.filter(e => e.destaque).map(etq => {
                const ativa = etiquetasContato.includes(etq.nome);
                return (
                  <Badge
                    key={etq.nome}
                    className={`cursor-pointer transition-all text-xs ${
                      ativa ? `${etq.cor} text-white shadow-md` : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                    onClick={(e) => { e.stopPropagation(); toggleEtiqueta(etq.nome); }}
                  >
                    {etq.emoji} {etq.label}
                  </Badge>
                );
              })}
            </div>

            {/* TODAS ETIQUETAS */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="cursor-pointer">
                <div className="flex items-center gap-2">
                  <Tag className="w-5 h-5 text-slate-500" />
                  <span>Todas Etiquetas</span>
                  {etiquetasContato.length > 0 && (
                    <Badge variant="secondary" className="text-xs ml-auto">{etiquetasContato.length}</Badge>
                  )}
                </div>
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
                  {todasEtiquetas.map(etq => (
                    <DropdownMenuCheckboxItem
                      key={etq.nome}
                      checked={etiquetasContato.includes(etq.nome)}
                      onCheckedChange={() => toggleEtiqueta(etq.nome)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${etq.cor}`} />
                        <span>{etq.emoji} {etq.label}</span>
                      </div>
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
          </div>

          {/* Status da Classificação */}
          {statusClass.status !== 'completo' && (
            <div className={`mx-2 mb-2 p-2 rounded-lg border ${
              statusClass.status === 'parcial' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center gap-2">
                <statusClass.icon className={`w-4 h-4 ${statusClass.cor}`} />
                <span className={`text-xs font-bold ${statusClass.cor}`}>
                  {statusClass.status === 'parcial' ? '⚠️ Quase completo' : '❌ Classificar!'}
                </span>
              </div>
              {statusClass.problemas && (
                <p className="text-[10px] text-slate-500 mt-1">Falta: {statusClass.problemas.join(', ')}</p>
              )}
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 📦 VARIANT: COMPACT - Badge compacto com dropdown
  // ═══════════════════════════════════════════════════════════════════════════
  if (variant === 'compact') {
    return (
      <DropdownMenu open={menuAberto} onOpenChange={setMenuAberto}>
        <DropdownMenuTrigger asChild onClick={handleClick}>
          <button
            className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${nivel.corFundo} border border-slate-200 hover:shadow-md transition-all cursor-pointer`}
            disabled={salvando}
          >
            {salvando ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            ) : (
              <>
                <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${nivel.gradiente} flex items-center justify-center`}>
                  <Icon className="w-3 h-3 text-white" />
                </div>
                <span className={`text-xs font-bold ${nivel.cor}`}>{score}%</span>
                {tipoAtual && <span className="text-xs">{tipoAtual.emoji}</span>}
                {etiquetasContato.slice(0, 2).map(etq => {
                  const config = getEtiquetaConfig(etq, etiquetasDB);
                  return <span key={etq} className="text-xs">{config.emoji}</span>;
                })}
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </>
            )}
          </button>
        </DropdownMenuTrigger>
        
        {/* Mesmo conteúdo do menu mini */}
        <DropdownMenuContent align="end" className="w-80" onClick={handleClick}>
          <div className={`p-3 ${nivel.corFundo} rounded-t-md border-b`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${nivel.gradiente} flex items-center justify-center shadow-lg`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className={`font-bold ${nivel.cor}`}>{nivel.emoji} {nivel.label}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1.5 bg-white/50 rounded-full overflow-hidden">
                    <div className={`h-full bg-gradient-to-r ${nivel.gradiente}`} style={{ width: `${score}%` }} />
                  </div>
                  <span className="text-xs font-bold">{score}%</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="p-2 space-y-1">
            {/* Resumo rápido */}
            <div className="flex flex-wrap gap-1 p-2 bg-slate-50 rounded-lg">
              {tipoAtual && (
                <Badge className={`${tipoAtual.color} text-white text-[10px]`}>{tipoAtual.emoji} {tipoAtual.label}</Badge>
              )}
              {estagioAtual && (
                <Badge className={`${estagioAtual.color} text-white text-[10px]`}>{estagioAtual.emoji} {estagioAtual.label}</Badge>
              )}
              {etiquetasContato.slice(0, 3).map(etq => {
                const config = getEtiquetaConfig(etq, etiquetasDB);
                return (
                  <Badge key={etq} className={`${config.cor} text-white text-[10px]`}>{config.emoji}</Badge>
                );
              })}
            </div>
            
            {/* Ações rápidas de classificação */}
            <div className="grid grid-cols-2 gap-1">
              {TIPOS_CONTATO.map(tipo => (
                <Button
                  key={tipo.value}
                  variant={contato?.tipo_contato === tipo.value ? "default" : "outline"}
                  size="sm"
                  className="h-8 text-xs justify-start"
                  onClick={(e) => { e.stopPropagation(); atualizarContato('tipo_contato', tipo.value); }}
                >
                  {tipo.emoji} {tipo.label}
                </Button>
              ))}
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 📊 VARIANT: FULL - Painel completo
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="p-4 bg-white rounded-xl border shadow-sm space-y-4">
      {/* Header com Termômetro */}
      <div className={`p-4 rounded-lg ${nivel.corFundo}`}>
        <div className="flex items-center gap-4">
          <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${nivel.gradiente} flex items-center justify-center shadow-xl`}>
            <Icon className="w-8 h-8 text-white" />
          </div>
          <div className="flex-1">
            <h3 className={`text-xl font-bold ${nivel.cor}`}>{nivel.emoji} {nivel.label}</h3>
            <p className="text-sm text-slate-600">{nivel.descricao}</p>
            <div className="flex items-center gap-3 mt-2">
              <div className="flex-1 h-3 bg-white/50 rounded-full overflow-hidden">
                <div 
                  className={`h-full bg-gradient-to-r ${nivel.gradiente} transition-all duration-700`}
                  style={{ width: `${score}%` }}
                />
              </div>
              <span className="text-lg font-bold">{score}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sugestão de Ação */}
      {showSugestoes && (
        <div className="p-3 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full ${proxAcao.cor} flex items-center justify-center shadow-lg`}>
              <proxAcao.icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-xs font-medium text-purple-600">💡 PRÓXIMA AÇÃO SUGERIDA</p>
              <p className="text-lg font-bold text-slate-800">{proxAcao.emoji} {proxAcao.label}</p>
            </div>
          </div>
        </div>
      )}

      {/* Classificação Atual */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 bg-slate-50 rounded-lg text-center">
          <p className="text-xs text-slate-500 mb-1">Tipo</p>
          {tipoAtual ? (
            <Badge className={`${tipoAtual.color} text-white`}>{tipoAtual.emoji} {tipoAtual.label}</Badge>
          ) : (
            <Badge variant="outline" className="text-slate-400">Não definido</Badge>
          )}
        </div>
        <div className="p-3 bg-slate-50 rounded-lg text-center">
          <p className="text-xs text-slate-500 mb-1">Estágio</p>
          {estagioAtual ? (
            <Badge className={`${estagioAtual.color} text-white`}>{estagioAtual.emoji} {estagioAtual.label}</Badge>
          ) : (
            <Badge variant="outline" className="text-slate-400">Não definido</Badge>
          )}
        </div>
        <div className="p-3 bg-slate-50 rounded-lg text-center">
          <p className="text-xs text-slate-500 mb-1">Atendente</p>
          {atendenteAtual ? (
            <Badge variant="secondary">{atendenteAtual}</Badge>
          ) : (
            <Badge variant="outline" className="text-slate-400">Nenhum</Badge>
          )}
        </div>
      </div>

      {/* Etiquetas */}
      <div>
        <p className="text-xs font-medium text-slate-500 mb-2">Etiquetas</p>
        <div className="flex flex-wrap gap-1">
          {etiquetasContato.length > 0 ? (
            etiquetasContato.map(etq => {
              const config = getEtiquetaConfig(etq, etiquetasDB);
              return (
                <Badge key={etq} className={`${config.cor} text-white`}>{config.emoji} {config.label}</Badge>
              );
            })
          ) : (
            <Badge variant="outline" className="text-slate-400">Nenhuma etiqueta</Badge>
          )}
        </div>
      </div>

      {/* Status */}
      {statusClass.status !== 'completo' && (
        <div className={`p-3 rounded-lg border ${
          statusClass.status === 'parcial' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200 animate-pulse'
        }`}>
          <div className="flex items-center gap-2">
            <statusClass.icon className={`w-5 h-5 ${statusClass.cor}`} />
            <span className={`font-bold ${statusClass.cor}`}>
              {statusClass.status === 'parcial' ? '⚠️ Classificação Parcial' : '❌ Complete a Classificação!'}
            </span>
          </div>
          {statusClass.problemas && (
            <p className="text-sm text-slate-600 mt-1">Falta definir: {statusClass.problemas.join(', ')}</p>
          )}
        </div>
      )}
    </div>
  );
}
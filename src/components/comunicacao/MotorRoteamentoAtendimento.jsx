import React from "react";
import { 
  Phone, 
  Building2, 
  Target, 
  Truck, 
  Handshake, 
  User,
  MessageSquare,
  Wrench,
  DollarSign,
  Package,
  HelpCircle,
  UserCheck,
  Zap,
  AlertTriangle
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 MOTOR DE ROTEAMENTO INTELIGENTE - FONTE ÚNICA DE VERDADE
// ═══════════════════════════════════════════════════════════════════════════════
// LÓGICA: 1-Conexão → 2-Setor → 3-Tipo Contato → 4-Hierarquia Usuário → 5-Fidelização

// ═══════════════════════════════════════════════════════════════════════════════
// 📌 1. TIPOS DE CONTATO (Classificação do Contato)
// ═══════════════════════════════════════════════════════════════════════════════
export const TIPOS_CONTATO = [
  { 
    value: 'novo', 
    label: 'Contato s/ Definição', 
    icon: User, 
    color: 'bg-slate-400', 
    emoji: '❓', 
    prioridade: 0, 
    descricao: 'Contato ainda não classificado - precisa de pré-atendimento',
    requer_pre_atendimento: true,
    pode_ser_fidelizado: false
  },
  { 
    value: 'lead', 
    label: 'Lead', 
    icon: Target, 
    color: 'bg-amber-500', 
    emoji: '🎯', 
    prioridade: 1, 
    descricao: 'Potencial cliente em prospecção',
    requer_pre_atendimento: false,
    pode_ser_fidelizado: true,
    setores_aplicaveis: ['vendas', 'geral']
  },
  { 
    value: 'cliente', 
    label: 'Cliente', 
    icon: Building2, 
    color: 'bg-emerald-500', 
    emoji: '💎', 
    prioridade: 3, 
    descricao: 'Cliente ativo com histórico de compras',
    requer_pre_atendimento: false,
    pode_ser_fidelizado: true,
    setores_aplicaveis: ['vendas', 'assistencia', 'financeiro', 'geral']
  },
  { 
    value: 'fornecedor', 
    label: 'Fornecedor', 
    icon: Truck, 
    color: 'bg-blue-500', 
    emoji: '🏭', 
    prioridade: 2, 
    descricao: 'Fornecedor de produtos/serviços',
    requer_pre_atendimento: false,
    pode_ser_fidelizado: true,
    setores_aplicaveis: ['fornecedor', 'compras', 'geral']
  },
  { 
    value: 'parceiro', 
    label: 'Parceiro', 
    icon: Handshake, 
    color: 'bg-purple-500', 
    emoji: '🤝', 
    prioridade: 2, 
    descricao: 'Parceiro comercial ou de negócios',
    requer_pre_atendimento: false,
    pode_ser_fidelizado: true,
    setores_aplicaveis: ['vendas', 'geral']
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// 📌 2. SETORES/FILAS DE ATENDIMENTO
// ═══════════════════════════════════════════════════════════════════════════════
export const SETORES_ATENDIMENTO = [
  { 
    value: 'vendas', 
    label: 'Vendas', 
    emoji: '💰', 
    icon: DollarSign,
    color: 'bg-green-500',
    descricao: 'Atendimento comercial, orçamentos e vendas',
    tipos_contato_aceitos: ['lead', 'cliente', 'parceiro', 'novo'],
    campo_fidelizacao: 'atendente_fidelizado_vendas'
  },
  { 
    value: 'assistencia', 
    label: 'Assistência Técnica', 
    emoji: '🔧', 
    icon: Wrench,
    color: 'bg-orange-500',
    descricao: 'Suporte técnico, garantia e assistência',
    tipos_contato_aceitos: ['cliente'],
    campo_fidelizacao: 'atendente_fidelizado_assistencia'
  },
  { 
    value: 'financeiro', 
    label: 'Financeiro', 
    emoji: '💳', 
    icon: DollarSign,
    color: 'bg-amber-500',
    descricao: 'Pagamentos, boletos, notas fiscais',
    tipos_contato_aceitos: ['cliente'],
    campo_fidelizacao: 'atendente_fidelizado_financeiro'
  },
  { 
    value: 'fornecedor', 
    label: 'Fornecedor/Compras', 
    emoji: '📦', 
    icon: Package,
    color: 'bg-blue-500',
    descricao: 'Cotações e ofertas de fornecedores',
    tipos_contato_aceitos: ['fornecedor'],
    campo_fidelizacao: 'atendente_fidelizado_fornecedor'
  },
  { 
    value: 'geral', 
    label: 'Atendimento Geral', 
    emoji: '📋', 
    icon: HelpCircle,
    color: 'bg-slate-500',
    descricao: 'Informações gerais e triagem',
    tipos_contato_aceitos: ['novo', 'lead', 'cliente', 'fornecedor', 'parceiro'],
    campo_fidelizacao: null
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// 📌 3. HIERARQUIA DE USUÁRIOS (Função → Nível de Acesso)
// ═══════════════════════════════════════════════════════════════════════════════
export const FUNCOES_USUARIO = [
  { value: 'gerente', label: 'Gerente', emoji: '👔', nivel: 1, pode_ver_todos: true, pode_transferir: true, pode_configurar: true },
  { value: 'coordenador', label: 'Coordenador', emoji: '📋', nivel: 2, pode_ver_todos: true, pode_transferir: true, pode_configurar: false },
  { value: 'supervisor', label: 'Supervisor', emoji: '👁️', nivel: 3, pode_ver_todos: true, pode_transferir: true, pode_configurar: false },
  { value: 'senior', label: 'Sênior', emoji: '⭐', nivel: 4, pode_ver_todos: false, pode_transferir: true, pode_configurar: false },
  { value: 'pleno', label: 'Pleno', emoji: '🔹', nivel: 5, pode_ver_todos: false, pode_transferir: true, pode_configurar: false },
  { value: 'junior', label: 'Júnior', emoji: '🔸', nivel: 6, pode_ver_todos: false, pode_transferir: false, pode_configurar: false },
];

// ═══════════════════════════════════════════════════════════════════════════════
// 📌 4. REGRAS DE PRÉ-ATENDIMENTO
// ═══════════════════════════════════════════════════════════════════════════════
export const REGRAS_PRE_ATENDIMENTO = {
  // Quando o contato é NOVO (sem definição)
  novo: {
    acao: 'COLETAR_SETOR',
    mensagem_saudacao: 'Olá! Seja bem-vindo. Para melhor atendê-lo, por favor escolha o setor:',
    opcoes_setor: ['vendas', 'assistencia', 'financeiro', 'fornecedor'],
    depois_setor: 'QUALIFICAR_TIPO',
    timeout_minutos: 30
  },
  // Quando o contato é LEAD
  lead: {
    acao: 'VERIFICAR_FIDELIZACAO',
    setor_padrao: 'vendas',
    mensagem_boas_vindas: 'Olá! Que bom ter você de volta. Como posso ajudar?',
    prioridade: 'normal'
  },
  // Quando o contato é CLIENTE
  cliente: {
    acao: 'VERIFICAR_FIDELIZACAO_POR_SETOR',
    mensagem_boas_vindas: 'Olá! É sempre um prazer atendê-lo. Em que posso ajudar?',
    prioridade: 'alta',
    perguntar_setor_se_nao_fidelizado: true
  },
  // Quando o contato é FORNECEDOR
  fornecedor: {
    acao: 'DIRECIONAR_COMPRAS',
    setor_padrao: 'fornecedor',
    mensagem_boas_vindas: 'Olá! Agradecemos seu contato. Por favor, envie sua proposta/cotação.',
    prioridade: 'normal'
  },
  // Quando o contato é PARCEIRO
  parceiro: {
    acao: 'VERIFICAR_FIDELIZACAO',
    setor_padrao: 'vendas',
    mensagem_boas_vindas: 'Olá! Seja bem-vindo, parceiro. Como podemos colaborar?',
    prioridade: 'normal'
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🧮 FUNÇÕES DE ROTEAMENTO - LÓGICA CENTRALIZADA
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Determina o fluxo de roteamento baseado no contexto completo
 * @param {Object} params - Parâmetros do roteamento
 * @param {Object} params.contato - Dados do Contact
 * @param {Object} params.thread - Dados da MessageThread
 * @param {Object} params.integracao - Dados da WhatsAppIntegration (conexão)
 * @param {Object} params.usuarioLogado - Dados do User logado (opcional, para filtros de UI)
 * @returns {Object} Decisão de roteamento
 */
export function calcularRoteamento({ contato, thread, integracao, usuarioLogado = null }) {
  const resultado = {
    acao: null,
    setor_destino: null,
    atendente_destino: null,
    motivo: '',
    requer_pre_atendimento: false,
    mensagem_automatica: null,
    prioridade: 'normal',
    etiquetas_sugeridas: [],
    categorias_sugeridas: []
  };

  // 1️⃣ IDENTIFICAR TIPO DO CONTATO
  const tipoContato = contato?.tipo_contato || 'novo';
  const configTipo = TIPOS_CONTATO.find(t => t.value === tipoContato);
  const regrasPreAtend = REGRAS_PRE_ATENDIMENTO[tipoContato];

  // 2️⃣ VERIFICAR SE REQUER PRÉ-ATENDIMENTO
  if (configTipo?.requer_pre_atendimento) {
    resultado.acao = 'PRE_ATENDIMENTO';
    resultado.requer_pre_atendimento = true;
    resultado.mensagem_automatica = regrasPreAtend?.mensagem_saudacao;
    resultado.motivo = 'Contato sem definição - precisa escolher setor';
    return resultado;
  }

  // 3️⃣ VERIFICAR SETOR DA THREAD OU DEFINIR PADRÃO
  let setorDestino = thread?.sector_id || regrasPreAtend?.setor_padrao || 'geral';
  const configSetor = SETORES_ATENDIMENTO.find(s => s.value === setorDestino);

  // Validar se o tipo de contato é aceito neste setor
  if (configSetor && !configSetor.tipos_contato_aceitos.includes(tipoContato)) {
    // Redirecionar para setor compatível
    const setorCompativel = SETORES_ATENDIMENTO.find(s => 
      s.tipos_contato_aceitos.includes(tipoContato) && s.value !== 'geral'
    );
    if (setorCompativel) {
      setorDestino = setorCompativel.value;
    }
  }

  resultado.setor_destino = setorDestino;

  // 4️⃣ VERIFICAR FIDELIZAÇÃO
  const campoFidelizacao = configSetor?.campo_fidelizacao;
  if (campoFidelizacao && contato?.[campoFidelizacao]) {
    resultado.acao = 'ATRIBUIR_FIDELIZADO';
    resultado.atendente_destino = contato[campoFidelizacao];
    resultado.motivo = `Atendente fidelizado: ${contato[campoFidelizacao]}`;
    resultado.prioridade = tipoContato === 'cliente' ? 'alta' : 'normal';
    resultado.mensagem_automatica = regrasPreAtend?.mensagem_boas_vindas;
    return resultado;
  }

  // 5️⃣ SEM FIDELIZAÇÃO - VERIFICAR SE PRECISA PERGUNTAR SETOR
  if (tipoContato === 'cliente' && regrasPreAtend?.perguntar_setor_se_nao_fidelizado && !thread?.sector_id) {
    resultado.acao = 'SOLICITAR_SETOR';
    resultado.requer_pre_atendimento = true;
    resultado.mensagem_automatica = 'Olá! Para melhor atendê-lo, por favor escolha o setor:';
    resultado.motivo = 'Cliente sem setor definido';
    return resultado;
  }

  // 6️⃣ ROTEAR PARA FILA DO SETOR
  resultado.acao = 'ROTEAR_FILA';
  resultado.motivo = `Encaminhar para fila ${configSetor?.label || setorDestino}`;
  resultado.prioridade = regrasPreAtend?.prioridade || 'normal';
  resultado.mensagem_automatica = regrasPreAtend?.mensagem_boas_vindas;

  return resultado;
}

/**
 * Obtém o atendente fidelizado para um contato em um setor específico
 */
export function getAtendenteFidelizado(contato, setor) {
  if (!contato || !setor) return null;
  
  const configSetor = SETORES_ATENDIMENTO.find(s => s.value === setor);
  if (!configSetor?.campo_fidelizacao) return null;
  
  return contato[configSetor.campo_fidelizacao] || null;
}

/**
 * Verifica se um usuário pode atender um tipo de contato em um setor
 */
export function podeAtenderContato(usuario, tipoContato, setor) {
  if (!usuario) return false;
  
  // Admin pode tudo
  if (usuario.role === 'admin') return true;
  
  // Verificar se o setor do usuário é compatível
  const setorUsuario = usuario.attendant_sector;
  if (setorUsuario !== setor && setorUsuario !== 'geral') return false;
  
  // Verificar se o tipo de contato é aceito no setor
  const configSetor = SETORES_ATENDIMENTO.find(s => s.value === setor);
  if (configSetor && !configSetor.tipos_contato_aceitos.includes(tipoContato)) return false;
  
  return true;
}

/**
 * Filtra etiquetas/categorias baseado no contexto de atendimento
 */
export function filtrarPorContextoAtendimento(items, { tipoContato, setor, funcaoUsuario }) {
  return items.filter(item => {
    // Se não tem restrições, disponível para todos
    const tiposAplicaveis = item.tipos_contato_aplicaveis || [];
    const filasAplicaveis = item.filas_aplicaveis || [];
    
    const tipoOk = tiposAplicaveis.length === 0 || tiposAplicaveis.includes(tipoContato);
    const filaOk = filasAplicaveis.length === 0 || filasAplicaveis.includes(setor);
    
    return tipoOk && filaOk;
  });
}

/**
 * Retorna as opções de setor disponíveis para um tipo de contato
 */
export function getSetoresParaTipoContato(tipoContato) {
  return SETORES_ATENDIMENTO.filter(setor => 
    setor.tipos_contato_aceitos.includes(tipoContato)
  );
}

/**
 * Retorna a configuração completa para exibição na UI
 */
export function getConfigCompleta(tipoContato, setor) {
  const configTipo = TIPOS_CONTATO.find(t => t.value === tipoContato);
  const configSetor = SETORES_ATENDIMENTO.find(s => s.value === setor);
  const regras = REGRAS_PRE_ATENDIMENTO[tipoContato];
  
  return {
    tipo: configTipo,
    setor: configSetor,
    regras,
    campo_fidelizacao: configSetor?.campo_fidelizacao,
    requer_pre_atendimento: configTipo?.requer_pre_atendimento || false
  };
}

/**
 * Verifica permissões do usuário para ações específicas
 */
export function verificarPermissaoUsuario(usuario, acao) {
  if (!usuario) return false;
  if (usuario.role === 'admin') return true;
  
  const funcao = FUNCOES_USUARIO.find(f => f.value === usuario.attendant_role);
  if (!funcao) return false;
  
  switch (acao) {
    case 'ver_todos':
      return funcao.pode_ver_todos;
    case 'transferir':
      return funcao.pode_transferir;
    case 'configurar':
      return funcao.pode_configurar;
    default:
      return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 COMPONENTE DE EXIBIÇÃO DO ROTEAMENTO
// ═══════════════════════════════════════════════════════════════════════════════

export function BadgeRoteamento({ contato, thread, size = 'sm' }) {
  const tipoContato = contato?.tipo_contato || 'novo';
  const configTipo = TIPOS_CONTATO.find(t => t.value === tipoContato);
  const setor = thread?.sector_id;
  const configSetor = setor ? SETORES_ATENDIMENTO.find(s => s.value === setor) : null;
  const atendenteFidelizado = setor ? getAtendenteFidelizado(contato, setor) : null;
  
  const Icon = configTipo?.icon || User;
  
  if (size === 'mini') {
    return (
      <div className="flex items-center gap-1">
        <div className={`w-5 h-5 rounded-full ${configTipo?.color || 'bg-slate-400'} flex items-center justify-center`}>
          <Icon className="w-3 h-3 text-white" />
        </div>
        {configSetor && (
          <span className="text-[10px] text-slate-500">{configSetor.emoji}</span>
        )}
        {atendenteFidelizado && (
          <UserCheck className="w-3 h-3 text-green-500" />
        )}
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
      <div className={`w-8 h-8 rounded-full ${configTipo?.color || 'bg-slate-400'} flex items-center justify-center`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1">
        <p className="text-xs font-medium">{configTipo?.emoji} {configTipo?.label}</p>
        {configSetor && (
          <p className="text-[10px] text-slate-500">{configSetor.emoji} {configSetor.label}</p>
        )}
      </div>
      {atendenteFidelizado && (
        <div className="flex items-center gap-1 px-2 py-0.5 bg-green-100 rounded-full">
          <UserCheck className="w-3 h-3 text-green-600" />
          <span className="text-[10px] text-green-700 font-medium">{atendenteFidelizado}</span>
        </div>
      )}
    </div>
  );
}

export default {
  TIPOS_CONTATO,
  SETORES_ATENDIMENTO,
  FUNCOES_USUARIO,
  REGRAS_PRE_ATENDIMENTO,
  calcularRoteamento,
  getAtendenteFidelizado,
  podeAtenderContato,
  filtrarPorContextoAtendimento,
  getSetoresParaTipoContato,
  getConfigCompleta,
  verificarPermissaoUsuario,
  BadgeRoteamento
};
import React, { useState } from 'react';
import { CheckCircle2, XCircle, Clock, AlertCircle, Sparkles, Brain, Zap, MessageSquare, ThumbsUp, Database, Variable, RefreshCw } from 'lucide-react';

const STATUS = {
  implementado: { label: 'Implementado ✅', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2, dot: 'bg-green-500' },
  parcial: { label: 'Parcial ⚠️', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: AlertCircle, dot: 'bg-yellow-500' },
  nao_implementado: { label: 'Não Implementado ❌', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle, dot: 'bg-red-400' },
  planejado: { label: 'Planejado 🔵', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Clock, dot: 'bg-blue-500' },
};

const ROWS = [
  // ── GERAÇÃO DE SUGESTÕES ──
  {
    categoria: 'Geração de Sugestões',
    funcionalidade: 'Sugestões rápidas de resposta (3 opções)',
    debatido: 'Gerar 3 sugestões contextuais baseadas no histórico',
    implementado: 'AIResponseAssistant → gerarSugestoes() com InvokeLLM, retorna 3 opções',
    status: 'implementado',
    detalhe: 'Plenamente funcional. Aba "Sugestões Rápidas" no painel flutuante.',
  },
  {
    categoria: 'Geração de Sugestões',
    funcionalidade: 'Geração de Rascunho completo editável',
    debatido: 'Rascunho completo que o atendente pode editar antes de enviar',
    implementado: 'Aba "Gerar Rascunho" com textarea editável e auto-resize',
    status: 'implementado',
    detalhe: 'Textarea cresce com o conteúdo. Atendente edita e clica "Usar Rascunho".',
  },
  {
    categoria: 'Geração de Sugestões',
    funcionalidade: 'Trigger automático ao abrir painel com msg do cliente',
    debatido: 'IA gera sugestões automaticamente quando há mensagem pendente',
    implementado: 'useEffect monitora ultimaMensagemCliente?.id + thread?.id. Gera ao abrir.',
    status: 'implementado',
    detalhe: 'Evita regerar para a mesma mensagem com chave thread+msg_id.',
  },

  // ── ANÁLISE DE CONTEXTO ──
  {
    categoria: 'Análise de Contexto',
    funcionalidade: 'Contexto das últimas N mensagens',
    debatido: 'Análise das últimas 50-100 mensagens para contexto rico',
    implementado: 'buildContext() usa mensagens.slice(-20). Limitado a 20.',
    status: 'parcial',
    detalhe: 'Debate sugeriu 50-100 msgs. Implementado usa apenas 20. Aumentar para ~40 sem impacto grande.',
  },
  {
    categoria: 'Análise de Contexto',
    funcionalidade: 'Detecção automática do estilo/tom do cliente',
    debatido: 'Adaptar automaticamente o tom baseado no comportamento do cliente',
    implementado: 'detectarEstiloContato() analisa emoji, gírias, pontuação formal → retorna amigavel/formal/direto',
    status: 'implementado',
    detalhe: 'Regex simples mas eficaz. Usado quando tom = "auto".',
  },
  {
    categoria: 'Análise de Contexto',
    funcionalidade: 'Cache do perfil de tom do cliente',
    debatido: 'Armazenar temporariamente o "perfil de tom" para não reanalisar a cada interação',
    implementado: 'Não implementado. Reanálise completa a cada chamada.',
    status: 'nao_implementado',
    detalhe: 'Solução: localStorage com chave contact_id + TTL de 30min. Simples de implementar.',
  },

  // ── SELEÇÃO DE TOM ──
  {
    categoria: 'Seleção de Tom',
    funcionalidade: 'Seletor manual de tom (5 opções)',
    debatido: 'Atendente escolhe entre Automático, Formal, Amigável, Direto, Empático',
    implementado: 'TONS array com 5 opções. Dropdown no header do painel.',
    status: 'implementado',
    detalhe: 'Ao trocar o tom, limpa sugestões/rascunho para forçar nova geração.',
  },

  // ── FEEDBACK LOOP ──
  {
    categoria: 'Feedback Loop',
    funcionalidade: '👍/👎 nas sugestões para treinar preferências',
    debatido: 'Botões de joinha para o time indicar quais respostas prefere → IA aprende',
    implementado: 'Não existe. Clicar numa sugestão a coloca no input, mas não registra feedback.',
    status: 'nao_implementado',
    detalhe: 'Implementar: salvar em AprendizadoIA {sugestao_original, foi_usada, foi_editada, contexto_tom}.',
  },
  {
    categoria: 'Feedback Loop',
    funcionalidade: 'Comparação rascunho original vs editado',
    debatido: 'Detectar quando atendente edita o rascunho = feedback implícito de correção',
    implementado: 'rascunhoEditado é separado do rascunho original. Mas diff não é salvo.',
    status: 'parcial',
    detalhe: 'Infraestrutura existe (dois estados separados). Falta salvar o diff em AprendizadoIA.',
  },
  {
    categoria: 'Feedback Loop',
    funcionalidade: 'Uso de histórico de feedbacks para melhorar próximos prompts',
    debatido: 'IA usa exemplos passados aprovados como few-shot no próximo prompt',
    implementado: 'Não implementado. Entidade AprendizadoIA existe mas não é consultada aqui.',
    status: 'nao_implementado',
    detalhe: 'Entidade AprendizadoIA já existe no sistema! Falta integrar consulta no buildContext.',
  },

  // ── VARIÁVEIS DINÂMICAS ──
  {
    categoria: 'Variáveis Dinâmicas',
    funcionalidade: 'Preenchimento automático de {nome_cliente}',
    debatido: 'IA já preenche {nome_do_cliente} extraído do banco',
    implementado: 'nomeContato é passado ao prompt como "NOME DO CLIENTE". IA usa diretamente.',
    status: 'implementado',
    detalhe: 'Instrução explícita: "Não use placeholders como [nome], use o que está no contexto".',
  },
  {
    categoria: 'Variáveis Dinâmicas',
    funcionalidade: 'Preenchimento de {protocolo}, {vendedor}, {empresa}',
    debatido: 'Extrair campos do banco para enriquecer o prompt',
    implementado: 'Apenas nome do cliente é passado. Protocolo, empresa, vendedor não são injetados.',
    status: 'parcial',
    detalhe: 'Fácil de adicionar: thread.id (protocolo), contact.empresa, thread.assigned_user_id → nome.',
  },
  {
    categoria: 'Variáveis Dinâmicas',
    funcionalidade: 'Palavras-chave manuais para guiar o rascunho',
    debatido: 'Campo de input para o atendente passar contexto extra ao rascunho',
    implementado: 'Campo "palavrasChave" na aba Rascunho. Passado ao prompt como PALAVRAS-CHAVE/TEMA.',
    status: 'implementado',
    detalhe: 'Funcional. Aceita Enter para disparar geração.',
  },

  // ── UX / INTERFACE ──
  {
    categoria: 'UX / Interface',
    funcionalidade: 'Painel flutuante acima do input',
    debatido: 'Painel posicionado como bolha de chat acima do campo de digitação',
    implementado: 'absolute bottom-full right-0. Cresce com conteúdo. Sem altura máxima fixa.',
    status: 'implementado',
    detalhe: 'Largura 380px no desktop, full-width no mobile.',
  },
  {
    categoria: 'UX / Interface',
    funcionalidade: 'Indicador pulsante quando há msg do cliente pendente',
    debatido: 'Sinalizar visualmente que há sugestão disponível',
    implementado: 'Botão IA pisca (animate-pulse) + ponto vermelho pulsando quando ultimaMensagemCliente existe.',
    status: 'implementado',
    detalhe: 'Dois sinalizadores: pulse no botão e badge vermelho no canto.',
  },
  {
    categoria: 'UX / Interface',
    funcionalidade: 'Textarea do rascunho com auto-resize',
    debatido: 'Altura da bolha ajustar ao tamanho do rascunho gerado',
    implementado: 'ref callback + onChange com scrollHeight. Sem altura fixa.',
    status: 'implementado',
    detalhe: 'Corrigido recentemente. Cresce com o conteúdo sem scroll interno.',
  },
  {
    categoria: 'UX / Interface',
    funcionalidade: 'Regenerar sugestões com um clique',
    debatido: 'Botão para gerar novas opções sem fechar o painel',
    implementado: 'Botão "Gerar novas sugestões" com RefreshCw. Botão "Refazer" no rascunho.',
    status: 'implementado',
    detalhe: 'Ambas as abas têm opção de regenerar.',
  },

  // ── INTEGRAÇÃO COM SISTEMA ──
  {
    categoria: 'Integração com Sistema',
    funcionalidade: 'Injetar sugestão diretamente no campo de texto',
    debatido: 'Clicar na sugestão já coloca o texto no input para o atendente',
    implementado: 'onSugestaoSelecionada → setMensagemTexto(texto) no MessageInput.',
    status: 'implementado',
    detalhe: 'Fecha o painel automaticamente após seleção.',
  },
  {
    categoria: 'Integração com Sistema',
    funcionalidade: 'Passagem de contexto de mensagens ao assistente',
    debatido: 'Assistente recebe histórico completo da conversa',
    implementado: 'mensagensContexto prop passada do ChatWindow → MessageInput → AIResponseAssistant.',
    status: 'implementado',
    detalhe: 'Paralelo ao carregamento do contato para evitar bloqueio de UI.',
  },
  {
    categoria: 'Integração com Sistema',
    funcionalidade: 'Consulta a BaseConhecimento/RAG nos prompts',
    debatido: 'IA consulta base de conhecimento da empresa antes de sugerir',
    implementado: 'Não integrado aqui. MotorRAG existe no sistema mas não é chamado pelo AIResponseAssistant.',
    status: 'nao_implementado',
    detalhe: 'Potencial alto: buscar top-3 docs relevantes e injetar no prompt como CONTEXTO_EMPRESA.',
  },
];

const categorias = [...new Set(ROWS.map(r => r.categoria))];

const RESUMO = {
  implementado: ROWS.filter(r => r.status === 'implementado').length,
  parcial: ROWS.filter(r => r.status === 'parcial').length,
  nao_implementado: ROWS.filter(r => r.status === 'nao_implementado').length,
  planejado: ROWS.filter(r => r.status === 'planejado').length,
};

export default function AnaliseAssistenteIA() {
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroCategoria, setFiltroCategoria] = useState('todas');
  const [expandido, setExpandido] = useState(null);

  const rowsFiltradas = ROWS.filter(r => {
    if (filtroStatus !== 'todos' && r.status !== filtroStatus) return false;
    if (filtroCategoria !== 'todas' && r.categoria !== filtroCategoria) return false;
    return true;
  });

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Análise: Assistente IA de Respostas</h1>
            <p className="text-sm text-slate-500">Debate vs. Implementação Atual — Central de Comunicação</p>
          </div>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { key: 'implementado', label: 'Implementado', icon: CheckCircle2, color: 'from-green-500 to-emerald-600' },
          { key: 'parcial', label: 'Parcial', icon: AlertCircle, color: 'from-yellow-500 to-amber-600' },
          { key: 'nao_implementado', label: 'Não Implementado', icon: XCircle, color: 'from-red-500 to-rose-600' },
          { key: 'planejado', label: 'Planejado', icon: Clock, color: 'from-blue-500 to-indigo-600' },
        ].map(({ key, label, icon: Icon, color }) => (
          <button
            key={key}
            onClick={() => setFiltroStatus(filtroStatus === key ? 'todos' : key)}
            className={`p-3 rounded-xl bg-gradient-to-br ${color} text-white shadow-md transition-all hover:scale-105 ${filtroStatus === key ? 'ring-2 ring-white/50 scale-105' : ''}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon className="w-4 h-4" />
              <span className="text-2xl font-bold">{RESUMO[key]}</span>
            </div>
            <p className="text-xs text-white/80">{label}</p>
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={filtroCategoria}
          onChange={e => setFiltroCategoria(e.target.value)}
          className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-400"
        >
          <option value="todas">Todas as Categorias</option>
          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          onClick={() => { setFiltroStatus('todos'); setFiltroCategoria('todas'); }}
          className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-500 hover:bg-slate-50"
        >
          Limpar filtros
        </button>
        <span className="text-xs text-slate-400 self-center ml-auto">
          {rowsFiltradas.length} de {ROWS.length} itens
        </span>
      </div>

      {/* Tabela */}
      <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm bg-white">
        {/* Header da tabela */}
        <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
          <div className="col-span-2">Categoria</div>
          <div className="col-span-2">Funcionalidade</div>
          <div className="col-span-3">O que foi debatido</div>
          <div className="col-span-3">O que está implementado</div>
          <div className="col-span-2">Status</div>
        </div>

        {/* Rows agrupadas por categoria */}
        {categorias.filter(cat => filtroCategoria === 'todas' || filtroCategoria === cat).map(cat => {
          const rows = rowsFiltradas.filter(r => r.categoria === cat);
          if (!rows.length) return null;
          return (
            <div key={cat}>
              <div className="px-4 py-2 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-100">
                <span className="text-xs font-bold text-purple-700 uppercase tracking-wide">{cat}</span>
              </div>
              {rows.map((row, i) => {
                const st = STATUS[row.status];
                const isExp = expandido === `${cat}-${i}`;
                return (
                  <div
                    key={i}
                    className={`border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50 transition-colors ${isExp ? 'bg-slate-50' : ''}`}
                    onClick={() => setExpandido(isExp ? null : `${cat}-${i}`)}
                  >
                    <div className="md:grid grid-cols-12 gap-2 px-4 py-3 items-start">
                      {/* Mobile: stacked */}
                      <div className="col-span-2 hidden md:block">
                        <span className="text-xs text-slate-400">{row.categoria}</span>
                      </div>
                      <div className="col-span-2">
                        <p className="text-sm font-medium text-slate-700">{row.funcionalidade}</p>
                      </div>
                      <div className="col-span-3 hidden md:block">
                        <p className="text-xs text-slate-500 leading-relaxed">{row.debatido}</p>
                      </div>
                      <div className="col-span-3 hidden md:block">
                        <p className="text-xs text-slate-600 leading-relaxed font-mono bg-slate-50 rounded px-2 py-1">{row.implementado}</p>
                      </div>
                      <div className="col-span-2 mt-1 md:mt-0">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${st.color}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                          {st.label}
                        </span>
                      </div>
                    </div>

                    {/* Detalhe expandido */}
                    {isExp && (
                      <div className="px-4 pb-3 md:pl-20">
                        <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                          <p className="text-xs font-semibold text-blue-700 mb-0.5">💡 Análise técnica:</p>
                          <p className="text-xs text-blue-600">{row.detalhe}</p>
                        </div>
                        {/* Mobile: mostrar campos ocultos */}
                        <div className="md:hidden mt-2 space-y-2">
                          <div>
                            <p className="text-[11px] font-semibold text-slate-500 mb-0.5">Debate sugeria:</p>
                            <p className="text-xs text-slate-600">{row.debatido}</p>
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold text-slate-500 mb-0.5">Implementado:</p>
                            <p className="text-xs text-slate-600 font-mono bg-slate-100 rounded px-2 py-1">{row.implementado}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Recomendações prioritárias */}
      <div className="mt-6 grid md:grid-cols-3 gap-4">
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-red-600" />
            <p className="text-sm font-bold text-red-700">Alta prioridade</p>
          </div>
          <ul className="space-y-1">
            <li className="text-xs text-red-600">• Cache do tom do cliente (localStorage + TTL)</li>
            <li className="text-xs text-red-600">• Salvar feedback implícito (rascunho editado vs enviado)</li>
            <li className="text-xs text-red-600">• Injetar {'{protocolo}'} e {'{empresa}'} no prompt</li>
          </ul>
        </div>
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <RefreshCw className="w-4 h-4 text-yellow-600" />
            <p className="text-sm font-bold text-yellow-700">Melhorias rápidas</p>
          </div>
          <ul className="space-y-1">
            <li className="text-xs text-yellow-600">• Aumentar contexto de 20 → 40 mensagens</li>
            <li className="text-xs text-yellow-600">• 👍/👎 nas sugestões → salvar em AprendizadoIA</li>
          </ul>
        </div>
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <Database className="w-4 h-4 text-blue-600" />
            <p className="text-sm font-bold text-blue-700">Longo prazo</p>
          </div>
          <ul className="space-y-1">
            <li className="text-xs text-blue-600">• Integrar MotorRAG/BaseConhecimento no prompt</li>
            <li className="text-xs text-blue-600">• Few-shot com exemplos aprovados pela equipe</li>
            <li className="text-xs text-blue-600">• Score de confiança por sugestão gerada</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
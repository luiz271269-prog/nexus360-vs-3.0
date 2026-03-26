import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  ShoppingCart, Plus, Search, Filter, RefreshCw,
  Package, Clock, CheckCircle, XCircle, AlertTriangle, TrendingUp
} from 'lucide-react';
import { toast } from 'sonner';
import NovaCotacaoModal from '../components/compras/NovaCotacaoModal';

const STATUS_CONFIG = {
  rascunho:           { label: 'Rascunho',          color: 'bg-slate-100 text-slate-600',   icon: '📝' },
  solicitada:         { label: 'Solicitada',         color: 'bg-blue-100 text-blue-700',     icon: '📤' },
  aguardando_resposta:{ label: 'Aguard. Resposta',   color: 'bg-yellow-100 text-yellow-700', icon: '⏳' },
  recebida:           { label: 'Recebida',           color: 'bg-cyan-100 text-cyan-700',     icon: '📥' },
  em_analise:         { label: 'Em Análise',         color: 'bg-purple-100 text-purple-700', icon: '🔍' },
  aprovada:           { label: 'Aprovada',           color: 'bg-green-100 text-green-700',   icon: '✅' },
  rejeitada:          { label: 'Rejeitada',          color: 'bg-red-100 text-red-700',       icon: '❌' },
  vencida:            { label: 'Vencida',            color: 'bg-orange-100 text-orange-700', icon: '⚠️' },
  pedido_gerado:      { label: 'Pedido Gerado',      color: 'bg-emerald-100 text-emerald-700', icon: '🎉' },
};

const PRIORIDADE_CONFIG = {
  baixa:   { label: 'Baixa',   color: 'bg-slate-100 text-slate-500' },
  normal:  { label: 'Normal',  color: 'bg-blue-100 text-blue-600' },
  alta:    { label: 'Alta',    color: 'bg-orange-100 text-orange-600' },
  urgente: { label: 'Urgente', color: 'bg-red-100 text-red-600' },
};

function KpiCard({ icon: Icon, label, value, color }) {
  return (
    <div className={`rounded-xl p-4 border ${color}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

export default function Compras() {
  const [cotacoes, setCotacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroPrioridade, setFiltroPrioridade] = useState('todos');
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [usuario, setUsuario] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUsuario).catch(() => {});
    carregar();
  }, []);

  async function carregar() {
    setLoading(true);
    try {
      const data = await base44.entities.CotacaoCompra.list('-created_date', 200);
      setCotacoes(data || []);
    } catch (e) {
      toast.error('Erro ao carregar cotações');
    } finally {
      setLoading(false);
    }
  }

  async function handleSalvar(dados) {
    try {
      if (editando) {
        await base44.entities.CotacaoCompra.update(editando.id, dados);
        toast.success('Cotação atualizada!');
      } else {
        // Gerar número automático
        const num = `CC-${new Date().getFullYear()}-${String(cotacoes.length + 1).padStart(3, '0')}`;
        await base44.entities.CotacaoCompra.create({
          ...dados,
          numero_cotacao: num,
          comprador_id: usuario?.id || '',
          comprador_nome: usuario?.full_name || '',
          data_cotacao: new Date().toISOString().substring(0, 10),
        });
        toast.success('Cotação criada!');
      }
      setShowModal(false);
      setEditando(null);
      carregar();
    } catch (e) {
      toast.error('Erro ao salvar cotação');
    }
  }

  async function handleAlterarStatus(cotacao, novoStatus) {
    await base44.entities.CotacaoCompra.update(cotacao.id, { status: novoStatus });
    toast.success(`Status → ${STATUS_CONFIG[novoStatus]?.label}`);
    carregar();
  }

  const filtradas = cotacoes.filter(c => {
    if (filtroStatus !== 'todos' && c.status !== filtroStatus) return false;
    if (filtroPrioridade !== 'todos' && c.prioridade !== filtroPrioridade) return false;
    if (busca) {
      const b = busca.toLowerCase();
      if (!c.fornecedor_nome?.toLowerCase().includes(b) &&
          !c.numero_cotacao?.toLowerCase().includes(b) &&
          !c.comprador_nome?.toLowerCase().includes(b) &&
          !c.orcamento_numero?.toLowerCase().includes(b)) return false;
    }
    return true;
  });

  // KPIs
  const total = cotacoes.length;
  const pendentes = cotacoes.filter(c => ['solicitada','aguardando_resposta','em_analise'].includes(c.status)).length;
  const aprovadas = cotacoes.filter(c => c.status === 'aprovada' || c.status === 'pedido_gerado').length;
  const urgentes = cotacoes.filter(c => c.prioridade === 'urgente').length;
  const valorTotal = cotacoes.reduce((s, c) => s + (c.valor_total || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-4 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Gestão de Compras</h1>
              <p className="text-blue-100 text-xs">Cotações de compra e vínculos com orçamentos de venda</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={carregar} size="sm" variant="outline"
              className="bg-white/10 border-white/30 text-white hover:bg-white/20 h-8">
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
            <Button onClick={() => { setEditando(null); setShowModal(true); }} size="sm"
              className="bg-white text-blue-700 hover:bg-blue-50 font-semibold h-8 gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Nova Cotação
            </Button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard icon={Package} label="Total Cotações" value={total} color="bg-white border-slate-200 text-slate-700" />
        <KpiCard icon={Clock} label="Em Andamento" value={pendentes} color="bg-yellow-50 border-yellow-200 text-yellow-700" />
        <KpiCard icon={CheckCircle} label="Aprovadas" value={aprovadas} color="bg-green-50 border-green-200 text-green-700" />
        <KpiCard icon={AlertTriangle} label="Urgentes" value={urgentes} color="bg-red-50 border-red-200 text-red-700" />
        <KpiCard icon={TrendingUp} label="Valor Total" value={`R$ ${(valorTotal/1000).toFixed(0)}k`} color="bg-blue-50 border-blue-200 text-blue-700" />
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input placeholder="Buscar fornecedor, número, comprador..."
            value={busca} onChange={e => setBusca(e.target.value)}
            className="pl-7 h-8 text-xs" />
        </div>
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
          className="h-8 px-2 text-xs border border-slate-200 rounded-md bg-white">
          <option value="todos">Todos os Status</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.icon} {v.label}</option>
          ))}
        </select>
        <select value={filtroPrioridade} onChange={e => setFiltroPrioridade(e.target.value)}
          className="h-8 px-2 text-xs border border-slate-200 rounded-md bg-white">
          <option value="todos">Todas as Prioridades</option>
          {Object.entries(PRIORIDADE_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <span className="text-xs text-slate-400 ml-auto">{filtradas.length} cotação(ões)</span>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-16">
          <RefreshCw className="w-7 h-7 animate-spin text-blue-400" />
        </div>
      ) : filtradas.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
          <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhuma cotação encontrada</p>
          <p className="text-xs mt-1">Crie uma nova cotação para começar</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtradas.map(c => {
            const st = STATUS_CONFIG[c.status] || STATUS_CONFIG.rascunho;
            const pr = PRIORIDADE_CONFIG[c.prioridade] || PRIORIDADE_CONFIG.normal;
            return (
              <div key={c.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-800 text-sm">{c.numero_cotacao || '—'}</span>
                      <Badge className={`text-[10px] px-1.5 ${st.color}`}>{st.icon} {st.label}</Badge>
                      <Badge className={`text-[10px] px-1.5 ${pr.color}`}>{pr.label}</Badge>
                      {c.orcamento_numero && (
                        <Badge variant="outline" className="text-[10px] px-1.5 text-indigo-600 border-indigo-300">
                          📋 {c.orcamento_numero}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
                      <span>🏭 <b className="text-slate-700">{c.fornecedor_nome}</b></span>
                      {c.comprador_nome && <span>👤 {c.comprador_nome}</span>}
                      {c.prazo_entrega_dias && <span>🚚 {c.prazo_entrega_dias}d</span>}
                      {c.data_validade && <span>📅 Validade: {c.data_validade}</span>}
                    </div>
                    {c.itens?.length > 0 && (
                      <div className="mt-1.5 text-[11px] text-slate-400">
                        {c.itens.length} item(ns): {c.itens.slice(0, 3).map(i => i.nome_produto).join(', ')}{c.itens.length > 3 ? '...' : ''}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-bold text-slate-800">
                      {c.valor_total > 0 ? `R$ ${c.valor_total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}` : '—'}
                    </div>
                    <div className="flex gap-1 mt-2 justify-end flex-wrap">
                      <Button size="sm" variant="outline" className="h-6 text-[10px] px-2"
                        onClick={() => { setEditando(c); setShowModal(true); }}>
                        Editar
                      </Button>
                      {/* Ações rápidas de status */}
                      {c.status === 'rascunho' && (
                        <Button size="sm" className="h-6 text-[10px] px-2 bg-blue-500 hover:bg-blue-600"
                          onClick={() => handleAlterarStatus(c, 'solicitada')}>
                          Solicitar
                        </Button>
                      )}
                      {c.status === 'recebida' && (
                        <Button size="sm" className="h-6 text-[10px] px-2 bg-purple-500 hover:bg-purple-600"
                          onClick={() => handleAlterarStatus(c, 'em_analise')}>
                          Analisar
                        </Button>
                      )}
                      {c.status === 'em_analise' && (
                        <>
                          <Button size="sm" className="h-6 text-[10px] px-2 bg-green-500 hover:bg-green-600"
                            onClick={() => handleAlterarStatus(c, 'aprovada')}>
                            Aprovar
                          </Button>
                          <Button size="sm" variant="destructive" className="h-6 text-[10px] px-2"
                            onClick={() => handleAlterarStatus(c, 'rejeitada')}>
                            Rejeitar
                          </Button>
                        </>
                      )}
                      {c.status === 'aprovada' && (
                        <Button size="sm" className="h-6 text-[10px] px-2 bg-emerald-500 hover:bg-emerald-600"
                          onClick={() => handleAlterarStatus(c, 'pedido_gerado')}>
                          Gerar Pedido
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <NovaCotacaoModal
          cotacao={editando}
          onSave={handleSalvar}
          onClose={() => { setShowModal(false); setEditando(null); }}
        />
      )}
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  History, RefreshCw, CheckCircle2, XCircle, AlertTriangle,
  Clock, Send, Ban, ChevronDown, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

const TRIGGER_LABELS = {
  inbound_6h: { label: 'Inbound 6h', color: 'bg-blue-100 text-blue-700', icon: '⚡' },
  batch_36h: { label: 'Batch 36h', color: 'bg-purple-100 text-purple-700', icon: '📅' },
  fila_agendada: { label: 'Fila Agendada', color: 'bg-amber-100 text-amber-700', icon: '⏰' },
  massa_manual: { label: 'Massa Manual', color: 'bg-pink-100 text-pink-700', icon: '📢' },
  manual_individual: { label: 'Manual', color: 'bg-slate-100 text-slate-700', icon: '👤' },
  api_externa: { label: 'API', color: 'bg-emerald-100 text-emerald-700', icon: '🔌' }
};

const MOTIVO_LABELS = {
  cooldown_universal_12h: '⏱️ Em cooldown 12h',
  cooldown_eventual_48h: '⏱️ Cooldown eventual 48h',
  janela_24h_meta_expirada: '🚪 Janela Meta 24h fechou',
  human_active: '👤 Humano atendendo',
  no_eligible_promo: '🎯 Sem promo elegível',
  blocked_supplier_type: '🚫 Fornecedor',
  opt_out: '🔕 Opt-out',
  opt_out_tag: '🔕 Tag opt_out',
  contact_blocked: '⛔ Contato bloqueado',
  integracao_pausada: '⏸️ Integração pausada',
  no_contact_or_phone: '📵 Sem telefone',
  no_integration: '🔌 Sem integração'
};

function formatRelativeTime(iso) {
  if (!iso) return '-';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

export default function HistoricoPromocoes() {
  const [loading, setLoading] = useState(true);
  const [campanhas, setCampanhas] = useState([]);
  const [resumo, setResumo] = useState({ total: 0, enviadas: 0, bloqueadas: 0, erros: 0, taxa_sucesso: 0 });
  const [dias, setDias] = useState(7);
  const [filtroTrigger, setFiltroTrigger] = useState('all');
  const [expandidos, setExpandidos] = useState(new Set());

  const carregar = async () => {
    setLoading(true);
    try {
      const resp = await base44.functions.invoke('getPromotionDispatchHistory', {
        dias,
        trigger: filtroTrigger === 'all' ? null : filtroTrigger
      });
      if (resp?.data?.success) {
        setCampanhas(resp.data.campanhas || []);
        setResumo(resp.data.resumo || { total: 0, enviadas: 0, bloqueadas: 0, erros: 0, taxa_sucesso: 0 });
      } else {
        toast.error('Erro ao carregar histórico');
      }
    } catch (e) {
      console.error('[HistoricoPromocoes]', e);
      toast.error('Erro ao carregar histórico');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, [dias, filtroTrigger]);

  // Auto-refresh a cada 30s se houver campanhas em andamento
  useEffect(() => {
    const temEmAndamento = campanhas.some(c => c.status_geral === 'em_andamento');
    if (!temEmAndamento) return;
    const id = setInterval(carregar, 30000);
    return () => clearInterval(id);
  }, [campanhas]);

  const toggleExpand = (key) => {
    setExpandidos(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const renderStatusBadge = (status) => {
    if (status === 'em_andamento') return <Badge className="bg-amber-100 text-amber-700 border-amber-200"><Clock className="w-3 h-3 mr-1 animate-pulse" />Em andamento</Badge>;
    if (status === 'concluida') return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle2 className="w-3 h-3 mr-1" />Concluída</Badge>;
    if (status === 'falhou') return <Badge className="bg-red-100 text-red-700 border-red-200"><XCircle className="w-3 h-3 mr-1" />Falhou</Badge>;
    return <Badge variant="outline" className="text-slate-600">Sem envios</Badge>;
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-purple-600" />
          <h2 className="text-lg font-bold">Histórico de Disparos</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={String(dias)} onValueChange={(v) => setDias(Number(v))}>
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Últimas 24h</SelectItem>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroTrigger} onValueChange={setFiltroTrigger}>
            <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos canais</SelectItem>
              {Object.entries(TRIGGER_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.icon} {v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={carregar} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-3">
            <Send className="w-4 h-4 text-blue-600 mb-1" />
            <p className="text-xl font-bold text-blue-700">{resumo.total}</p>
            <p className="text-[10px] text-blue-700 font-semibold">Tentativas totais</p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="p-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 mb-1" />
            <p className="text-xl font-bold text-emerald-700">{resumo.enviadas}</p>
            <p className="text-[10px] text-emerald-700 font-semibold">Enviadas ({resumo.taxa_sucesso.toFixed(1)}%)</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-3">
            <Ban className="w-4 h-4 text-amber-600 mb-1" />
            <p className="text-xl font-bold text-amber-700">{resumo.bloqueadas}</p>
            <p className="text-[10px] text-amber-700 font-semibold">Bloqueadas (regras)</p>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-3">
            <AlertTriangle className="w-4 h-4 text-red-600 mb-1" />
            <p className="text-xl font-bold text-red-700">{resumo.erros}</p>
            <p className="text-[10px] text-red-700 font-semibold">Erros técnicos</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de campanhas */}
      {loading && campanhas.length === 0 ? (
        <Card><CardContent className="p-8 text-center">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-slate-400" />
          <p className="text-sm text-slate-500 mt-2">Carregando histórico...</p>
        </CardContent></Card>
      ) : campanhas.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-slate-500 text-sm">
          Nenhum disparo registrado nos últimos {dias} dias.
          <p className="text-xs mt-2 text-slate-400">
            O histórico começa a ser populado a partir de agora — ele consome a entity <code>PromotionDispatchLog</code>.
          </p>
        </CardContent></Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{campanhas.length} disparo(s) encontrado(s)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {campanhas.map((c) => {
              const expanded = expandidos.has(c.group_key);
              const triggerInfo = TRIGGER_LABELS[c.trigger] || { label: c.trigger, color: 'bg-slate-100', icon: '•' };
              return (
                <div key={c.group_key} className="border border-slate-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleExpand(c.group_key)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 text-left"
                  >
                    {expanded ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                    <Badge className={`${triggerInfo.color} text-[10px] flex-shrink-0`}>
                      {triggerInfo.icon} {triggerInfo.label}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.promotion_titulo}</p>
                      <p className="text-[10px] text-slate-500">
                        {formatRelativeTime(c.ultimo_envio)} • por {c.initiated_by || 'sistema'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-bold text-emerald-600">{c.enviadas}/{c.total}</p>
                        <p className="text-[9px] text-slate-500">{c.taxa_sucesso.toFixed(0)}% sucesso</p>
                      </div>
                      {renderStatusBadge(c.status_geral)}
                    </div>
                  </button>

                  {expanded && (
                    <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 space-y-2">
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                        <div className="bg-white p-2 rounded border">
                          <p className="text-[10px] text-slate-500">Total</p>
                          <p className="font-bold">{c.total}</p>
                        </div>
                        <div className="bg-emerald-50 p-2 rounded border border-emerald-100">
                          <p className="text-[10px] text-emerald-600">Enviadas</p>
                          <p className="font-bold text-emerald-700">{c.enviadas}</p>
                        </div>
                        <div className="bg-amber-50 p-2 rounded border border-amber-100">
                          <p className="text-[10px] text-amber-600">Bloqueadas</p>
                          <p className="font-bold text-amber-700">{c.bloqueadas}</p>
                        </div>
                        <div className="bg-blue-50 p-2 rounded border border-blue-100">
                          <p className="text-[10px] text-blue-600">Na fila</p>
                          <p className="font-bold text-blue-700">{c.enfileiradas}</p>
                        </div>
                        <div className="bg-red-50 p-2 rounded border border-red-100">
                          <p className="text-[10px] text-red-600">Erros</p>
                          <p className="font-bold text-red-700">{c.erros}</p>
                        </div>
                      </div>

                      {Object.keys(c.motivos_bloqueio || {}).length > 0 && (
                        <div className="bg-white p-2 rounded border border-slate-200">
                          <p className="text-[10px] text-slate-500 font-semibold mb-1">Motivos de bloqueio:</p>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(c.motivos_bloqueio).map(([motivo, qtd]) => (
                              <Badge key={motivo} variant="outline" className="text-[10px]">
                                {MOTIVO_LABELS[motivo] || motivo}: {qtd}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="text-[10px] text-slate-500 flex items-center gap-3">
                        <span>📅 {new Date(c.primeiro_envio).toLocaleString('pt-BR')}</span>
                        {c.campaign_id && <span>🔖 {c.campaign_id}</span>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <p className="text-[10px] text-slate-400 text-center">
        💡 Histórico baseado em <code>PromotionDispatchLog</code> — atualiza a cada 30s quando há campanhas em andamento.
      </p>
    </div>
  );
}
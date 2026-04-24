import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, TrendingUp, Ban, MessageSquare, RefreshCw, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { toast } from 'sonner';

const DIAS_ANALISE = 30;

export default function AnalyticsBroadcast() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEnviado: 0,
    totalRespondidas: 0,
    totalOptOut: 0,
    taxaResposta: 0,
    taxaOptOut: 0
  });
  const [porDia, setPorDia] = useState([]);
  const [porHora, setPorHora] = useState([]);
  const [rankingPromos, setRankingPromos] = useState([]);

  const carregar = async () => {
    setLoading(true);
    try {
      const desde = new Date(Date.now() - DIAS_ANALISE * 86400000).toISOString();

      // 1. Mensagens de broadcast enviadas
      const enviadas = await base44.entities.Message.filter({
        channel: 'whatsapp',
        sender_type: 'user',
        sent_at: { $gte: desde }
      }, '-sent_at', 2000);

      const broadcastsEnviados = enviadas.filter(m =>
        m.metadata?.origem_campanha === 'broadcast_massa' ||
        m.metadata?.origem_campanha === 'promocao_saudacao'
      );

      // 2. Mensagens de clientes que responderam (inbound recente após broadcast)
      const threadIds = [...new Set(broadcastsEnviados.map(m => m.thread_id).filter(Boolean))];
      let respondidas = 0;
      if (threadIds.length > 0) {
        // Pega resposta inbound que veio DEPOIS do broadcast na mesma thread
        const threadsComResposta = await Promise.all(
          threadIds.slice(0, 100).map(async tid => {
            try {
              const broadcastDaThread = broadcastsEnviados.find(m => m.thread_id === tid);
              if (!broadcastDaThread) return false;
              const respostas = await base44.entities.Message.filter({
                thread_id: tid,
                sender_type: 'contact',
                sent_at: { $gte: broadcastDaThread.sent_at }
              }, '-sent_at', 1);
              return respostas.length > 0;
            } catch { return false; }
          })
        );
        respondidas = threadsComResposta.filter(Boolean).length;
      }

      // 3. Contatos que fizeram opt-out no período
      const logs = await base44.entities.AutomationLog.filter({
        acao: 'outro',
        timestamp: { $gte: desde }
      }, '-timestamp', 500);
      const optOutCount = logs.filter(l =>
        l.detalhes?.mensagem?.toLowerCase().includes('opt-out')
      ).length;

      // 4. Agrupar por dia (últimos 30 dias)
      const mapaPorDia = {};
      for (let i = 0; i < DIAS_ANALISE; i++) {
        const d = new Date(Date.now() - i * 86400000);
        const key = d.toISOString().slice(0, 10);
        mapaPorDia[key] = { dia: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), enviadas: 0, respostas: 0 };
      }
      broadcastsEnviados.forEach(m => {
        const key = m.sent_at?.slice(0, 10);
        if (mapaPorDia[key]) mapaPorDia[key].enviadas++;
      });
      const dadosPorDia = Object.entries(mapaPorDia)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, v]) => v);

      // 5. Agrupar por hora do dia (heatmap simples)
      const mapaPorHora = {};
      for (let h = 0; h < 24; h++) mapaPorHora[h] = { hora: `${h}h`, total: 0 };
      broadcastsEnviados.forEach(m => {
        if (!m.sent_at) return;
        // Converter UTC → BRT
        const d = new Date(new Date(m.sent_at).getTime() - 3 * 3600000);
        const h = d.getUTCHours();
        if (mapaPorHora[h]) mapaPorHora[h].total++;
      });
      const dadosPorHora = Object.values(mapaPorHora);

      const totalEnviado = broadcastsEnviados.length;
      setStats({
        totalEnviado,
        totalRespondidas: respondidas,
        totalOptOut: optOutCount,
        taxaResposta: totalEnviado > 0 ? (respondidas / totalEnviado) * 100 : 0,
        taxaOptOut: totalEnviado > 0 ? (optOutCount / totalEnviado) * 100 : 0
      });
      setPorDia(dadosPorDia);
      setPorHora(dadosPorHora);

      // 6. Ranking de promoções (Nível 3)
      try {
        const promos = await base44.entities.Promotion.list('-contador_envios', 10);
        const ranking = promos
          .filter(p => (p.contador_envios || 0) > 0)
          .map(p => ({
            id: p.id,
            titulo: p.titulo || 'Sem título',
            categoria: p.categoria || 'geral',
            enviados: p.contador_envios || 0,
            respostas: p.contador_respostas || 0,
            taxa: p.contador_envios > 0 ? ((p.contador_respostas || 0) / p.contador_envios * 100) : 0,
            ativo: p.ativo !== false
          }))
          .sort((a, b) => b.taxa - a.taxa);
        setRankingPromos(ranking);
      } catch (_) {}
    } catch (e) {
      console.error('[AnalyticsBroadcast]', e);
      toast.error('Erro ao carregar analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  if (loading && stats.totalEnviado === 0) {
    return (
      <div className="p-8 text-center">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-slate-400" />
        <p className="text-sm text-slate-500 mt-2">Analisando últimos {DIAS_ANALISE} dias...</p>
      </div>
    );
  }

  const melhorHora = [...porHora].sort((a, b) => b.total - a.total)[0];

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-purple-600" />
          <h2 className="text-lg font-bold">Analytics de Broadcast — últimos {DIAS_ANALISE} dias</h2>
        </div>
        <Button size="sm" variant="outline" onClick={carregar} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <MessageSquare className="w-4 h-4 text-blue-600 mb-1" />
            <p className="text-2xl font-bold text-blue-700">{stats.totalEnviado}</p>
            <p className="text-[10px] text-blue-700 font-semibold">Broadcasts enviados</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
          <CardContent className="p-4">
            <TrendingUp className="w-4 h-4 text-emerald-600 mb-1" />
            <p className="text-2xl font-bold text-emerald-700">{stats.taxaResposta.toFixed(1)}%</p>
            <p className="text-[10px] text-emerald-700 font-semibold">Taxa de resposta ({stats.totalRespondidas})</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <CardContent className="p-4">
            <Ban className="w-4 h-4 text-red-600 mb-1" />
            <p className="text-2xl font-bold text-red-700">{stats.taxaOptOut.toFixed(2)}%</p>
            <p className="text-[10px] text-red-700 font-semibold">Taxa de opt-out ({stats.totalOptOut})</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="p-4">
            <Clock className="w-4 h-4 text-amber-600 mb-1" />
            <p className="text-2xl font-bold text-amber-700">{melhorHora?.hora || '-'}</p>
            <p className="text-[10px] text-amber-700 font-semibold">Melhor horário ({melhorHora?.total || 0} envios)</p>
          </CardContent>
        </Card>
      </div>

      {/* ENVIOS POR DIA */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Envios nos últimos {DIAS_ANALISE} dias</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={porDia}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="dia" stroke="#64748b" fontSize={10} />
              <YAxis stroke="#64748b" fontSize={10} />
              <Tooltip />
              <Line type="monotone" dataKey="enviadas" stroke="#6366f1" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* RANKING DE PROMOÇÕES (Nível 3) */}
      {rankingPromos.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">🏆 Ranking de Promoções (por taxa de resposta)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {rankingPromos.slice(0, 8).map((p, idx) => (
                <div key={p.id} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border border-slate-100">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    idx === 0 ? 'bg-yellow-100 text-yellow-800' :
                    idx === 1 ? 'bg-slate-200 text-slate-700' :
                    idx === 2 ? 'bg-amber-100 text-amber-800' :
                    'bg-slate-100 text-slate-500'
                  }`}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.titulo}</p>
                    <p className="text-[10px] text-slate-500">
                      {p.enviados} envios • {p.respostas} respostas • {p.categoria}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className={`text-sm font-bold ${
                      p.taxa >= 20 ? 'text-emerald-600' :
                      p.taxa >= 10 ? 'text-blue-600' :
                      p.taxa >= 5 ? 'text-amber-600' :
                      'text-slate-500'
                    }`}>
                      {p.taxa.toFixed(1)}%
                    </p>
                    <p className="text-[9px] text-slate-500">taxa</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 mt-3">
              💡 Dica: promoções com taxa &lt; 5% têm baixa conversão — considere desativar ou reescrever.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ENVIOS POR HORA DO DIA */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Distribuição por hora do dia (BRT)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={porHora}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="hora" stroke="#64748b" fontSize={10} />
              <YAxis stroke="#64748b" fontSize={10} />
              <Tooltip />
              <Bar dataKey="total" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-slate-500 mt-2">
            Horário de maior envio: <strong>{melhorHora?.hora}</strong>. Avalie se esse é o melhor horário para taxa de resposta.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Activity, AlertTriangle, CheckCircle2, Clock, Pause, Play,
  RefreshCw, Shield, TrendingUp, Zap
} from 'lucide-react';
import { toast } from 'sonner';

// Tiers idênticos ao enviarCampanhaLote (para exibir na UI)
function calcularTier(integ) {
  const idadeDias = (Date.now() - new Date(integ.created_date).getTime()) / (1000 * 60 * 60 * 24);
  const totalEnviado = integ.estatisticas?.total_mensagens_enviadas || 0;
  if (idadeDias < 7 || totalEnviado < 100) return { tier: 'novo', maxDia: 30, cor: 'bg-blue-500', janela: '4h' };
  if (idadeDias < 30 || totalEnviado < 1000) return { tier: 'aquecendo', maxDia: 80, cor: 'bg-amber-500', janela: '3h' };
  return { tier: 'maduro', maxDia: 150, cor: 'bg-emerald-500', janela: '2h' };
}

export default function PainelSaudeBroadcast() {
  const [loading, setLoading] = useState(true);
  const [integracoes, setIntegracoes] = useState([]);
  const [fila, setFila] = useState({ pendentes: 0, processando: 0, erro: 0, processados_hoje: 0 });
  const [enviosPorIntegracao, setEnviosPorIntegracao] = useState({});

  const carregar = async () => {
    setLoading(true);
    try {
      // Carregar integrações conectadas
      const integs = await base44.entities.WhatsAppIntegration.filter({ status: 'conectado' });
      setIntegracoes(integs);

      // Contar fila (WorkQueueItems de broadcast)
      const [pend, proc, err] = await Promise.all([
        base44.entities.WorkQueueItem.filter({ tipo: 'enviar_broadcast_avulso', status: 'pendente' }, null, 500),
        base44.entities.WorkQueueItem.filter({ tipo: 'enviar_broadcast_avulso', status: 'processando' }, null, 100),
        base44.entities.WorkQueueItem.filter({ tipo: 'enviar_broadcast_avulso', status: 'erro' }, null, 100)
      ]);

      // Contar mensagens enviadas hoje por integração
      const inicioHoje = new Date();
      inicioHoje.setHours(0, 0, 0, 0);
      const msgsHoje = await base44.entities.Message.filter({
        channel: 'whatsapp',
        status: 'enviada',
        sent_at: { $gte: inicioHoje.toISOString() }
      }, '-sent_at', 1000);

      const contadorPorInteg = {};
      msgsHoje.forEach(m => {
        const id = m.metadata?.whatsapp_integration_id;
        if (id) contadorPorInteg[id] = (contadorPorInteg[id] || 0) + 1;
      });
      setEnviosPorIntegracao(contadorPorInteg);

      setFila({
        pendentes: pend.length,
        processando: proc.length,
        erro: err.length,
        processados_hoje: msgsHoje.filter(m => m.metadata?.origem_campanha === 'broadcast_massa').length
      });
    } catch (e) {
      console.error('[PainelSaudeBroadcast] erro:', e);
      toast.error('Erro ao carregar painel');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
    const iv = setInterval(carregar, 60_000); // atualiza a cada 60s
    return () => clearInterval(iv);
  }, []);

  const despausarIntegracao = async (integ) => {
    try {
      await base44.entities.WhatsAppIntegration.update(integ.id, {
        configuracoes_avancadas: {
          ...integ.configuracoes_avancadas,
          pausada_ate: null,
          motivo_pausa: null
        }
      });
      toast.success(`✅ Integração ${integ.nome_instancia} reativada`);
      carregar();
    } catch (e) {
      toast.error(`Erro: ${e.message}`);
    }
  };

  if (loading && integracoes.length === 0) {
    return (
      <div className="p-6 text-center">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-slate-400" />
        <p className="text-sm text-slate-500 mt-2">Carregando saúde do sistema...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-bold">Saúde de Broadcast & Promoções</h2>
        </div>
        <Button size="sm" variant="outline" onClick={carregar} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* CARDS DE FILA */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Clock className="w-5 h-5 text-blue-600" />
              <span className="text-2xl font-bold text-blue-700">{fila.pendentes}</span>
            </div>
            <p className="text-xs text-blue-700 font-semibold mt-1">Na fila</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Zap className="w-5 h-5 text-amber-600" />
              <span className="text-2xl font-bold text-amber-700">{fila.processando}</span>
            </div>
            <p className="text-xs text-amber-700 font-semibold mt-1">Processando</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span className="text-2xl font-bold text-emerald-700">{fila.processados_hoje}</span>
            </div>
            <p className="text-xs text-emerald-700 font-semibold mt-1">Enviados hoje</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <span className="text-2xl font-bold text-red-700">{fila.erro}</span>
            </div>
            <p className="text-xs text-red-700 font-semibold mt-1">Com erro</p>
          </CardContent>
        </Card>
      </div>

      {/* STATUS POR INTEGRAÇÃO */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="w-4 h-4 text-slate-600" />
            Status por Integração WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {integracoes.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">Nenhuma integração conectada</p>
          ) : (
            integracoes.map(integ => {
              const tier = calcularTier(integ);
              const enviosHoje = enviosPorIntegracao[integ.id] || 0;
              const percentUso = Math.min(100, (enviosHoje / tier.maxDia) * 100);
              const pausadaAte = integ.configuracoes_avancadas?.pausada_ate;
              const estaPausada = pausadaAte && new Date(pausadaAte).getTime() > Date.now();
              const motivoPausa = integ.configuracoes_avancadas?.motivo_pausa;

              return (
                <div key={integ.id} className={`border rounded-lg p-3 ${estaPausada ? 'bg-red-50 border-red-300' : 'bg-white border-slate-200'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="font-semibold text-sm truncate">{integ.nome_instancia}</span>
                      <Badge className={`${tier.cor} text-white text-[10px] uppercase flex-shrink-0`}>
                        {tier.tier}
                      </Badge>
                      {estaPausada && (
                        <Badge className="bg-red-600 text-white text-[10px] flex items-center gap-1 flex-shrink-0">
                          <Pause className="w-3 h-3" /> PAUSADA
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 flex-shrink-0 ml-2">{integ.numero_telefone}</span>
                  </div>

                  {estaPausada ? (
                    <div className="flex items-center justify-between gap-2 bg-red-100 rounded p-2">
                      <div className="text-xs text-red-800">
                        <p className="font-semibold">⚠️ {motivoPausa === 'rate_limit' ? 'Rate-limit da Meta (429)' : motivoPausa === 'bloqueio' ? 'Bloqueio (403)' : motivoPausa}</p>
                        <p className="text-[10px] opacity-80">Liberada em: {new Date(pausadaAte).toLocaleString('pt-BR')}</p>
                      </div>
                      <Button size="sm" variant="outline" className="h-7 text-xs border-red-400 text-red-700 hover:bg-red-200" onClick={() => despausarIntegracao(integ)}>
                        <Play className="w-3 h-3 mr-1" /> Reativar
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-600">Uso diário</span>
                        <span className={`font-bold ${percentUso > 80 ? 'text-red-600' : percentUso > 50 ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {enviosHoje} / {tier.maxDia} ({percentUso.toFixed(0)}%)
                        </span>
                      </div>
                      <Progress value={percentUso} className="h-2" />
                      <p className="text-[10px] text-slate-500 mt-1">
                        Janela de spread: {tier.janela} | Criada há {Math.floor((Date.now() - new Date(integ.created_date).getTime()) / (86400000))}d
                      </p>
                    </>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* DICA */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600">
        <p className="flex items-start gap-2">
          <TrendingUp className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
          <span>
            Atualização automática a cada 60s. Tiers: <strong>novo</strong> (&lt;7d ou &lt;100 msgs) = 30/dia • <strong>aquecendo</strong> (&lt;30d) = 80/dia • <strong>maduro</strong> = 150/dia.
          </span>
        </p>
      </div>
    </div>
  );
}
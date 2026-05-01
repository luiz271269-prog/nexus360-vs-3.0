import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { RefreshCw, Megaphone, ShieldCheck, AlertCircle } from 'lucide-react';

import StatusCronsPromocao from '@/components/promocoes/StatusCronsPromocao';
import ResumoEnviosPromocao from '@/components/promocoes/ResumoEnviosPromocao';
import TabelaCampanhasPromocao from '@/components/promocoes/TabelaCampanhasPromocao';
import MotivosBloqueio from '@/components/promocoes/MotivosBloqueio';

export default function MonitorPromocoes() {
  const { toast } = useToast();
  const [usuario, setUsuario] = useState(null);
  const [dias, setDias] = useState(7);
  const [historico, setHistorico] = useState(null);
  const [loadingHist, setLoadingHist] = useState(false);
  const [automacoes, setAutomacoes] = useState([]);
  const [loadingAuto, setLoadingAuto] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUsuario).catch(() => setUsuario(null));
  }, []);

  const carregarHistorico = useCallback(async () => {
    setLoadingHist(true);
    try {
      const resp = await base44.functions.invoke('getPromotionDispatchHistory', { dias });
      setHistorico(resp.data || resp);
    } catch (error) {
      console.error('[MonitorPromocoes] erro histórico:', error);
      toast({ title: 'Erro ao carregar histórico', description: error.message, variant: 'destructive' });
    } finally {
      setLoadingHist(false);
    }
  }, [dias, toast]);

  const carregarAutomacoes = useCallback(async () => {
    setLoadingAuto(true);
    try {
      // Lista TODAS as automations e filtra as relacionadas a promoção no client
      const todas = await base44.entities.Automation?.list?.('-created_date', 100).catch(() => null);

      // Fallback via fetch direto na API se a entidade Automation não estiver exposta
      let lista = todas;
      if (!lista) {
        // Tenta via SDK genérico
        try {
          lista = await base44.asServiceRole?.entities?.Automation?.list?.('-created_date', 100);
        } catch (_) {
          lista = [];
        }
      }
      lista = lista || [];

      const alvo = ['runPromotionInboundTick', 'runPromotionBatchTick', 'processarFilaPromocoes', 'processarFilaBroadcast'];
      const filtradas = lista.filter(a => alvo.includes(a.function_name));
      setAutomacoes(filtradas);
    } catch (error) {
      console.error('[MonitorPromocoes] erro automações:', error);
    } finally {
      setLoadingAuto(false);
    }
  }, []);

  useEffect(() => { carregarHistorico(); }, [carregarHistorico]);
  useEffect(() => { carregarAutomacoes(); }, [carregarAutomacoes]);

  const handleToggle = async (auto) => {
    if (usuario?.role !== 'admin') {
      toast({ title: 'Apenas admin pode pausar/ativar', variant: 'destructive' });
      return;
    }
    setTogglingId(auto.id);
    try {
      // Toggle via API de automations do Base44
      const novoStatus = !auto.is_active;
      await base44.entities.Automation.update(auto.id, { is_active: novoStatus }).catch(async () => {
        // Fallback via fetch direto
        await fetch(`/api/automations/${auto.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: novoStatus })
        });
      });
      toast({
        title: novoStatus ? 'Automação ativada' : 'Automação pausada',
        description: auto.name
      });
      await carregarAutomacoes();
    } catch (error) {
      console.error('[MonitorPromocoes] erro toggle:', error);
      toast({ title: 'Erro ao alterar status', description: error.message, variant: 'destructive' });
    } finally {
      setTogglingId(null);
    }
  };

  const isAdmin = usuario?.role === 'admin';

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-orange-500" />
            Monitor de Promoções
          </h1>
          <p className="text-sm text-slate-500">
            Auditoria em tempo real de todos os disparos automáticos e manuais
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(dias)} onValueChange={(v) => setDias(Number(v))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Últimas 24h</SelectItem>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { carregarHistorico(); carregarAutomacoes(); }}
            disabled={loadingHist}
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${loadingHist ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {!isAdmin && (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-3 flex items-center gap-2 text-sm text-amber-800">
            <AlertCircle className="w-4 h-4" />
            Você está visualizando em modo somente-leitura. Apenas administradores podem pausar/ativar automações.
          </CardContent>
        </Card>
      )}

      {/* Status dos crons */}
      <StatusCronsPromocao
        automacoes={automacoes}
        onToggle={handleToggle}
        togglingId={togglingId}
      />

      {/* Resumo */}
      <ResumoEnviosPromocao resumo={historico?.resumo} />

      {/* Grid: Tabela + Bloqueios */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <TabelaCampanhasPromocao campanhas={historico?.campanhas} loading={loadingHist} />
        </div>
        <div>
          <MotivosBloqueio campanhas={historico?.campanhas} />
        </div>
      </div>

      <Card className="bg-slate-50 border-slate-200">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2 text-slate-700">
            <ShieldCheck className="w-4 h-4 text-green-600" />
            Como funciona o motor único
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-slate-600 space-y-1">
          <p>• Todo envio de promoção (inbound, batch, fila, massa, manual, agente) passa por <code className="bg-white px-1 rounded">enviarPromocao</code></p>
          <p>• O motor valida cooldown 12h, opt-out, janela 24h Meta, eligibilidade por setor e tipo de contato</p>
          <p>• Cada disparo gera 1 registro em <code className="bg-white px-1 rounded">PromotionDispatchLog</code> (success ou bloqueado com motivo)</p>
          <p>• Crons de gatilho rodam a cada 5min e respeitam horário comercial 8-20h</p>
        </CardContent>
      </Card>
    </div>
  );
}
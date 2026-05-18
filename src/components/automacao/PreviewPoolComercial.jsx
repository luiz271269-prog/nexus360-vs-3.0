import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertTriangle, XCircle, Zap, Info } from "lucide-react";
import { poolComercialHealth } from "@/functions/poolComercialHealth";

function TierBadge({ tier }) {
  const config = {
    novo: { label: "🌱 Novo", className: "bg-amber-100 text-amber-800 border-amber-300" },
    aquecendo: { label: "🔥 Aquecendo", className: "bg-orange-100 text-orange-800 border-orange-300" },
    maduro: { label: "✅ Maduro", className: "bg-emerald-100 text-emerald-800 border-emerald-300" }
  };
  const c = config[tier] || config.novo;
  return <Badge className={`${c.className} border text-xs`}>{c.label}</Badge>;
}

function InstanceRow({ instance }) {
  const icon = instance.healthy
    ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
    : <AlertTriangle className="w-4 h-4 text-amber-600" />;

  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${instance.healthy ? 'bg-white border-slate-200' : 'bg-amber-50/50 border-amber-200'}`}>
      <div className="flex items-center gap-3 min-w-0">
        {icon}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-slate-800 text-sm truncate">{instance.nome_instancia}</span>
            <TierBadge tier={instance.tier} />
          </div>
          <div className="text-xs text-slate-500 truncate">
            {instance.numero_telefone} • {instance.api_provider} • {instance.age_days}d de uso
          </div>
        </div>
      </div>
      <div className="text-right ml-3 shrink-0">
        {instance.healthy ? (
          <>
            <div className="text-sm font-semibold text-slate-800">{instance.capacity_remaining}</div>
            <div className="text-xs text-slate-500">de {instance.max_dia}/dia</div>
          </>
        ) : (
          <div className="text-xs text-amber-700 font-medium">
            {instance.status !== 'conectado' ? 'Desconectada' : 'Sem atividade recente'}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PreviewPoolComercial({ onCapacityChange }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    poolComercialHealth({})
      .then(res => {
        if (!alive) return;
        const payload = res?.data || res;
        setData(payload);
        setErro(null);
        if (onCapacityChange) onCapacityChange(payload?.total_capacity_today || 0);
      })
      .catch(e => {
        if (!alive) return;
        setErro(e.message || 'Erro ao carregar pool comercial');
        setData(null);
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  if (loading) {
    return (
      <Card className="border-blue-200 bg-blue-50/30">
        <CardContent className="p-4 flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          <span className="text-sm text-slate-700">Analisando saúde do pool comercial...</span>
        </CardContent>
      </Card>
    );
  }

  if (erro) {
    return (
      <Card className="border-red-200 bg-red-50/40">
        <CardContent className="p-4 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-red-800">Falha ao carregar pool</div>
            <div className="text-xs text-red-700 mt-1">{erro}</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const pool = data?.pool || [];
  const healthy = pool.filter(p => p.healthy);
  const stale = pool.filter(p => !p.healthy);

  if (pool.length === 0) {
    return (
      <Card className="border-amber-200 bg-amber-50/40">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-900">
            <div className="font-semibold mb-1">Nenhuma integração configurada para o setor comercial</div>
            <div className="text-xs">
              {data?.warning || 'Para usar a distribuição automática, marque "vendas" em setores_atendidos das integrações WhatsApp que devem participar do envio em massa.'}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-blue-200 bg-gradient-to-br from-blue-50/40 to-indigo-50/40">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm font-semibold text-slate-800">
          <span className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-blue-600" />
            Pool do Setor Comercial
          </span>
          <span className="text-xs font-normal text-slate-600">
            {healthy.length} ativas{stale.length > 0 ? ` • ${stale.length} ignoradas` : ''}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {pool.map(p => (
          <InstanceRow key={p.integration_id} instance={p} />
        ))}

        <div className="mt-3 pt-3 border-t border-blue-200 flex items-center justify-between">
          <span className="text-xs text-slate-600">Capacidade disponível hoje:</span>
          <span className="text-lg font-bold text-blue-700">
            {data.total_capacity_today} envios
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
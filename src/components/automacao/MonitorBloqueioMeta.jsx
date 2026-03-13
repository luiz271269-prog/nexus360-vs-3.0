import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, AlertTriangle, Activity, Zap } from 'lucide-react';
import { toast } from 'sonner';

export default function MonitorBloqueioMeta() {
  const [diagnostico, setDiagnostico] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [autoAtualizar, setAutoAtualizar] = useState(true);

  const verificarRiscos = async () => {
    try {
      setCarregando(true);
      const resp = await fetch('/api/functions/ControladorRateLimitMeta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await resp.json();
      setDiagnostico(data);

      if (data.saude_geral === '🔴 CRÍTICO') {
        toast.error('⚠️ Risco crítico detectado!');
      }
    } catch (error) {
      toast.error('Erro ao verificar riscos: ' + error.message);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    verificarRiscos();
    const interval = autoAtualizar ? setInterval(verificarRiscos, 30000) : null;
    return () => clearInterval(interval);
  }, [autoAtualizar]);

  if (!diagnostico) {
    return <div className="p-4 text-center">Carregando diagnóstico...</div>;
  }

  const getRiscoIcon = (nivel) => {
    if (nivel === 'CRITICO') return <AlertCircle className="w-5 h-5 text-red-600" />;
    if (nivel === 'AVISO') return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
    return <CheckCircle2 className="w-5 h-5 text-green-600" />;
  };

  const getSaudeBg = () => {
    if (diagnostico.saude_geral === '🟢 SAUDÁVEL') return 'bg-green-50 border-green-300';
    if (diagnostico.saude_geral === '🔴 CRÍTICO') return 'bg-red-50 border-red-300';
    return 'bg-yellow-50 border-yellow-300';
  };

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      {/* Status Geral */}
      <Card className={`border-2 ${getSaudeBg()}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-6 h-6" />
              Monitor de Bloqueio de Meta
            </CardTitle>
            <Badge className={diagnostico.saude_geral === '🟢 SAUDÁVEL' ? 'bg-green-600' : 'bg-red-600'}>
              {diagnostico.saude_geral}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg border">
              <span className="text-xs text-slate-600 block">Taxa/min</span>
              <p className="text-2xl font-bold">{diagnostico.metricas.taxa_envio_minuto}</p>
              <span className="text-xs text-slate-500">limite: 50</span>
            </div>
            <div className="bg-white p-4 rounded-lg border">
              <span className="text-xs text-slate-600 block">Threads Órfãs</span>
              <p className="text-2xl font-bold">{diagnostico.metricas.threads_orfas}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border">
              <span className="text-xs text-slate-600 block">Taxa Falha</span>
              <p className="text-2xl font-bold">{diagnostico.metricas.falhas_percentual}%</p>
              <span className="text-xs text-slate-500">limite: 20%</span>
            </div>
            <div className="bg-white p-4 rounded-lg border">
              <span className="text-xs text-slate-600 block">Integrações Risco</span>
              <p className="text-2xl font-bold">{diagnostico.metricas.integracoes_risco}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Riscos */}
      {diagnostico.riscos.CRITICO.length > 0 && (
        <Card className="border-red-300 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-700 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              🚨 Riscos Críticos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {diagnostico.riscos.CRITICO.map((risco, idx) => (
              <div key={idx} className="bg-white p-4 rounded-lg border-l-4 border-red-600">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-red-700">{risco.tipo}</p>
                    <p className="text-sm text-slate-600 mt-1">{risco.valor}</p>
                    {risco.limite && <p className="text-xs text-slate-500">Limite: {risco.limite}</p>}
                  </div>
                  <Badge className="bg-red-600 ml-2">{risco.acao}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {diagnostico.riscos.AVISO.length > 0 && (
        <Card className="border-yellow-300 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-yellow-700 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              ⚠️ Avisos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {diagnostico.riscos.AVISO.map((aviso, idx) => (
              <div key={idx} className="bg-white p-4 rounded-lg border-l-4 border-yellow-600">
                <p className="font-bold text-yellow-700">{aviso.tipo}</p>
                {aviso.integracao && <p className="text-sm">🔗 {aviso.integracao}</p>}
                <p className="text-sm text-slate-600">{aviso.valor}</p>
                <Badge className="bg-yellow-600 mt-2">{aviso.acao}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {Array.isArray(diagnostico.riscos.OK) && diagnostico.riscos.OK.length > 0 && (
        <Card className="border-green-300 bg-green-50">
          <CardContent className="pt-6">
            <p className="text-green-700 font-semibold">✅ {diagnostico.riscos.OK[0]}</p>
          </CardContent>
        </Card>
      )}

      {/* Recomendações */}
      {diagnostico.recomendacoes && diagnostico.recomendacoes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Ações Recomendadas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {diagnostico.recomendacoes.map((rec, idx) => (
              <div key={idx} className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <p className="font-bold text-blue-900">{rec.acao}</p>
                <p className="text-sm text-slate-600 mt-1">{rec.motivo}</p>
                {rec.duracao_segundos && (
                  <p className="text-xs text-blue-700 mt-2">
                    ⏱️ Duração: {rec.duracao_segundos}s
                  </p>
                )}
                {rec.threads_afetadas && (
                  <p className="text-xs text-blue-700 mt-2">
                    🔧 Threads afetadas: {rec.threads_afetadas}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Controles */}
      <div className="flex gap-3 justify-center pt-4">
        <Button
          onClick={verificarRiscos}
          disabled={carregando}
          className="bg-blue-600 hover:bg-blue-700">
          {carregando ? '🔄 Verificando...' : '🔍 Verificar Agora'}
        </Button>
        <Button
          onClick={() => setAutoAtualizar(!autoAtualizar)}
          variant={autoAtualizar ? 'default' : 'outline'}>
          {autoAtualizar ? '✅ Auto-atualizar ON' : '⭕ Auto-atualizar OFF'}
        </Button>
      </div>
    </div>
  );
}
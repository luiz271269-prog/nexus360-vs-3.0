import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  Activity, 
  Clock,
  Zap,
  Users,
  Target,
  AlertCircle,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { format } from 'date-fns';

export default function MetricasSuperAgente({ execucoes, kpisURA }) {
  // Calcular métricas gerais
  const totalExecucoes = execucoes.length;
  const totalSucesso = execucoes.filter(e => e.success).length;
  const taxaSucessoGeral = totalExecucoes > 0 ? 
    (totalSucesso / totalExecucoes * 100).toFixed(1) : 0;

  // Top erros
  const errosMap = {};
  execucoes
    .filter(e => !e.success && e.error_message)
    .forEach(e => {
      const erro = e.error_message.slice(0, 50);
      errosMap[erro] = (errosMap[erro] || 0) + 1;
    });
  const topErros = Object.entries(errosMap)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);

  return (
    <div className="h-full overflow-y-auto space-y-4 pl-2">
      {/* KPIs Gerais */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-600" />
            Métricas Gerais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-600">Total Execuções:</span>
            <span className="text-lg font-bold text-indigo-600">{totalExecucoes}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-600">Taxa Sucesso:</span>
            <span className="text-lg font-bold text-green-600">{taxaSucessoGeral}%</span>
          </div>
        </CardContent>
      </Card>

      {/* KPIs da URA */}
      {kpisURA && kpisURA.total > 0 && (
        <Card className="border-purple-200">
          <CardHeader className="pb-3 bg-purple-50">
            <CardTitle className="text-sm flex items-center gap-2 text-purple-900">
              <Zap className="w-4 h-4" />
              KPIs do Pré-Atendimento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-4">
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Fast-track:</span>
              <span className={`font-semibold ${
                parseFloat(kpisURA.taxa_fast_track) >= 60 ? 'text-green-600' : 'text-yellow-600'
              }`}>
                {kpisURA.taxa_fast_track}%
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Abandono:</span>
              <span className={`font-semibold ${
                parseFloat(kpisURA.taxa_abandono) < 5 ? 'text-green-600' : 'text-red-600'
              }`}>
                {kpisURA.taxa_abandono}%
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Tempo Médio:</span>
              <span className="font-semibold text-blue-600">
                {(kpisURA.tempo_medio_ms / 1000).toFixed(1)}s
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Menu Exibido:</span>
              <span className="font-semibold text-slate-600">
                {kpisURA.taxa_menu}%
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Sticky Ativado:</span>
              <span className="font-semibold text-purple-600">
                {kpisURA.taxa_sticky}%
              </span>
            </div>
            <div className="text-[10px] text-slate-500 text-center pt-2 border-t border-purple-100">
              {kpisURA.total} execuções analisadas
            </div>
          </CardContent>
        </Card>
      )}

      {/* Últimas Execuções */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Últimas Execuções
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {execucoes.slice(0, 8).map((exec) => (
            <div
              key={exec.id}
              className={`p-2 rounded-lg border text-xs ${
                exec.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold truncate flex-1">{exec.skill_name}</span>
                {exec.success ? (
                  <CheckCircle2 className="w-3 h-3 text-green-600 flex-shrink-0" />
                ) : (
                  <XCircle className="w-3 h-3 text-red-600 flex-shrink-0" />
                )}
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-600">
                <span>{exec.execution_mode}</span>
                <span>{exec.duration_ms}ms</span>
              </div>
              {exec.created_date && (
                <p className="text-[10px] text-slate-500 mt-1">
                  {format(new Date(exec.created_date), 'dd/MM HH:mm')}
                </p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Top Erros */}
      {topErros.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-red-700">
              <AlertCircle className="w-4 h-4" />
              Top Erros
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topErros.map(([erro, count], idx) => (
              <div key={idx} className="text-xs">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-slate-700 flex-1 line-clamp-2">{erro}</p>
                  <Badge variant="outline" className="text-[10px] flex-shrink-0">
                    {count}x
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
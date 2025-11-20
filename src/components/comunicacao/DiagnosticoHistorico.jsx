import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, TrendingUp, TrendingDown, Eye } from 'lucide-react';

export default function DiagnosticoHistorico({ historico, onVerDetalhes }) {
  const getCorScore = (score) => {
    if (score === 100) return 'bg-green-600 text-white';
    if (score >= 75) return 'bg-yellow-600 text-white';
    if (score >= 50) return 'bg-orange-600 text-white';
    return 'bg-red-600 text-white';
  };

  if (!historico || historico.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-slate-500">
          <Clock className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p>Nenhum diagnóstico executado ainda</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="w-5 h-5 text-slate-600" />
          Histórico de Diagnósticos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {historico.map((exec) => (
            <div
              key={exec.id}
              className="border border-slate-200 rounded-lg p-3 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={getCorScore(exec.score_total)}>
                      {exec.score_total}%
                    </Badge>
                    <span className="text-sm text-slate-700">
                      {format(new Date(exec.data_execucao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>{exec.tempo_total_ms}ms</span>
                    <span>•</span>
                    <span>{exec.etapas?.length || 0} etapas</span>
                    
                    {exec.comparacao_execucao_anterior && (
                      <>
                        <span>•</span>
                        <div className="flex items-center gap-1">
                          {exec.comparacao_execucao_anterior.melhorou ? (
                            <TrendingUp className="w-3 h-3 text-green-600" />
                          ) : (
                            <TrendingDown className="w-3 h-3 text-red-600" />
                          )}
                          <span className={exec.comparacao_execucao_anterior.melhorou ? 'text-green-600' : 'text-red-600'}>
                            {exec.comparacao_execucao_anterior.diferenca > 0 ? '+' : ''}
                            {exec.comparacao_execucao_anterior.diferenca}%
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onVerDetalhes(exec)}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Ver
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
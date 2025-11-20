import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Lock,
  ChevronDown,
  ChevronUp,
  Loader2
} from 'lucide-react';
import DiagnosticoTeste from './DiagnosticoTeste';

export default function DiagnosticoEtapa({ etapa, expandido, onToggle }) {
  const getIconeStatus = () => {
    if (etapa.status === 'pendente') {
      return <Lock className="w-6 h-6 text-gray-400" />;
    }
    if (etapa.status === 'executando') {
      return <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />;
    }
    if (etapa.status === 'sucesso') {
      return <CheckCircle className="w-6 h-6 text-green-600" />;
    }
    if (etapa.status === 'erro') {
      return <XCircle className="w-6 h-6 text-red-600" />;
    }
    return <AlertTriangle className="w-6 h-6 text-yellow-600" />;
  };

  const getCorCard = () => {
    switch (etapa.status) {
      case 'sucesso':
        return 'border-green-300 bg-green-50';
      case 'erro':
        return 'border-red-300 bg-red-50';
      case 'aviso':
        return 'border-yellow-300 bg-yellow-50';
      case 'executando':
        return 'border-blue-300 bg-blue-50';
      default:
        return 'border-gray-300 bg-gray-50';
    }
  };

  const getCorBadge = () => {
    if (etapa.score === 100) return 'bg-green-600 text-white';
    if (etapa.score >= 75) return 'bg-yellow-600 text-white';
    if (etapa.score >= 50) return 'bg-orange-600 text-white';
    return 'bg-red-600 text-white';
  };

  const getCorProgress = () => {
    if (etapa.score === 100) return 'bg-green-600';
    if (etapa.score >= 75) return 'bg-yellow-600';
    if (etapa.score >= 50) return 'bg-orange-600';
    return 'bg-red-600';
  };

  return (
    <Card className={`border-2 ${getCorCard()} transition-all`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getIconeStatus()}
            <div>
              <CardTitle className="text-base">
                Etapa {etapa.numero}: {etapa.nome}
              </CardTitle>
              {etapa.tempo_ms !== undefined && (
                <p className="text-xs text-slate-500 mt-1">
                  Tempo: {etapa.tempo_ms}ms
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {etapa.score !== undefined && (
              <Badge className={`${getCorBadge()} text-sm px-3 py-1`}>
                {etapa.score}%
              </Badge>
            )}
            
            {etapa.testes && etapa.testes.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggle}
              >
                {expandido ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {etapa.score !== undefined && (
        <div className="px-6 pb-3">
          <Progress value={etapa.score} className="h-2" indicatorClassName={getCorProgress()} />
        </div>
      )}

      {expandido && etapa.testes && (
        <CardContent className="space-y-2 pt-0">
          {etapa.testes.map((teste, idx) => (
            <DiagnosticoTeste key={idx} teste={teste} />
          ))}
        </CardContent>
      )}
    </Card>
  );
}
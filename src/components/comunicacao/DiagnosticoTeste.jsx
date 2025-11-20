import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronUp,
  Info,
  Zap
} from 'lucide-react';

export default function DiagnosticoTeste({ teste }) {
  const [expandido, setExpandido] = useState(false);

  const getIcone = () => {
    switch (teste.status) {
      case 'sucesso':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'erro':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'aviso':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getCorBg = () => {
    switch (teste.status) {
      case 'sucesso':
        return 'bg-green-50 border-green-200';
      case 'erro':
        return 'bg-red-50 border-red-200';
      case 'aviso':
        return 'bg-yellow-50 border-yellow-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className={`border rounded-lg p-3 ${getCorBg()} transition-all`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          {getIcone()}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm text-slate-900">
                {teste.nome}
              </span>
              {teste.critico && (
                <Badge className="bg-red-600 text-white text-[10px] px-1.5 py-0.5">
                  <Zap className="w-3 h-3 mr-1" />
                  CRÍTICO
                </Badge>
              )}
            </div>
            {teste.tempo_ms !== undefined && (
              <span className="text-xs text-slate-500">
                {teste.tempo_ms}ms
              </span>
            )}
          </div>
        </div>

        {(teste.detalhes || teste.sugestao_correcao) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpandido(!expandido)}
            className="ml-2"
          >
            {expandido ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        )}
      </div>

      {expandido && (
        <div className="mt-3 space-y-2">
          {teste.detalhes && (
            <div className="bg-white rounded-lg p-3 border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-semibold text-slate-700">
                  Detalhes:
                </span>
              </div>
              <pre className="text-xs text-slate-600 overflow-x-auto">
                {JSON.stringify(teste.detalhes, null, 2)}
              </pre>
            </div>
          )}

          {teste.sugestao_correcao && (
            <Alert className="bg-blue-50 border-blue-200">
              <AlertDescription className="text-xs text-blue-900">
                <strong>💡 Sugestão:</strong> {teste.sugestao_correcao}
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}
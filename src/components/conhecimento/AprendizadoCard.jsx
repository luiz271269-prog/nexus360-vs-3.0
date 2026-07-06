import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, X, Brain } from 'lucide-react';
import moment from 'moment';

export default function AprendizadoCard({ item, onAprovar, onDescartar, processando }) {
  return (
    <Card className="p-5 border-l-4 border-l-purple-500">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Brain className="w-4 h-4 text-purple-600 flex-shrink-0" />
            <h3 className="font-semibold text-slate-900">{item.titulo}</h3>
            <Badge variant="secondary">{item.categoria}</Badge>
            <Badge variant="outline">{item.tipo_registro?.replace(/_/g, ' ')}</Badge>
          </div>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{item.conteudo}</p>
          {item.contexto_aplicacao?.quando_usar && (
            <p className="text-xs text-emerald-700 mt-2">✅ Quando usar: {item.contexto_aplicacao.quando_usar}</p>
          )}
          {item.contexto_aplicacao?.quando_nao_usar && (
            <p className="text-xs text-red-600 mt-1">⛔ Quando não usar: {item.contexto_aplicacao.quando_nao_usar}</p>
          )}
          <p className="text-xs text-slate-400 mt-2">
            Sugerido por {item.criado_por || 'IA'} em {moment(item.created_date).format('DD/MM/YYYY HH:mm')}
          </p>
        </div>
        <div className="flex flex-col gap-2 flex-shrink-0">
          <Button size="sm" onClick={() => onAprovar(item)} disabled={processando}
            className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Check className="w-4 h-4 mr-1" /> Aprovar
          </Button>
          <Button size="sm" variant="outline" onClick={() => onDescartar(item)} disabled={processando}
            className="text-red-600 border-red-200 hover:bg-red-50">
            <X className="w-4 h-4 mr-1" /> Descartar
          </Button>
        </div>
      </div>
    </Card>
  );
}
import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, X, Eye } from 'lucide-react';

export default function AlertasClientesEmRisco() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: alertas = [] } = useQuery({
    queryKey: ['alertasClientesEmRisco'],
    queryFn: () => base44.entities.NotificationEvent.filter(
      { tipo: 'cliente_em_risco', lida: false },
      '-created_date',
      10
    ),
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (alertas.length === 0) return null;

  const dispensar = async (alerta) => {
    await base44.entities.NotificationEvent.update(alerta.id, { lida: true, lida_em: new Date().toISOString() });
    queryClient.invalidateQueries({ queryKey: ['alertasClientesEmRisco'] });
  };

  return (
    <Card className="border-2 border-red-200 bg-gradient-to-r from-red-50 to-amber-50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-5 h-5 text-red-600" />
        <h2 className="font-bold text-slate-900">Clientes em Risco</h2>
        <Badge className="bg-red-600 text-white">{alertas.length}</Badge>
      </div>
      <div className="space-y-2">
        {alertas.map((a) => (
          <div key={a.id} className="flex items-start justify-between gap-3 bg-white rounded-lg border border-red-100 px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800">{a.titulo}</p>
              <p className="text-xs text-slate-500 mt-0.5">{a.mensagem}</p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {a.acao_sugerida?.destino && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-red-200 text-red-700 hover:bg-red-50"
                  onClick={() => navigate(a.acao_sugerida.destino)}
                >
                  <Eye className="w-3.5 h-3.5 mr-1" /> Ver cliente
                </Button>
              )}
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600" onClick={() => dispensar(a)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
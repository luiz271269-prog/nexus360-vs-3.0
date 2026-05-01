import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, AlertCircle, CheckCircle2, Clock, Power, PowerOff, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Mostra status dos crons de promoção e permite ativar/pausar.
 * Recebe a lista de automações da página pai.
 */
export default function StatusCronsPromocao({ automacoes, onToggle, togglingId }) {
  const cronsAlvo = [
    {
      function_name: 'runPromotionInboundTick',
      label: 'Promoção Inbound (6h após mensagem)',
      descricao: 'Envia promoção 6h após o cliente parar de responder'
    },
    {
      function_name: 'runPromotionBatchTick',
      label: 'Promoção Batch (36h base ativa)',
      descricao: 'Envia promoção em lote para base com 36h sem mensagem'
    },
    {
      function_name: 'processarFilaPromocoes',
      label: 'Processar Fila de Promoções',
      descricao: 'Despacha WorkQueueItems agendados (enviar_promocao)'
    },
    {
      function_name: 'processarFilaBroadcast',
      label: 'Processar Fila de Broadcast',
      descricao: 'Envia broadcasts em massa enfileirados'
    }
  ];

  const automacaoPorFn = new Map();
  for (const a of (automacoes || [])) {
    if (!a.is_archived) automacaoPorFn.set(a.function_name, a);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="w-4 h-4 text-amber-500" />
          Status dos Gatilhos Automáticos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {cronsAlvo.map((c) => {
          const auto = automacaoPorFn.get(c.function_name);
          const existe = !!auto;
          const ativo = existe && auto.is_active;
          const ultimoRun = auto?.last_run_at ? new Date(auto.last_run_at) : null;
          const isToggling = togglingId === auto?.id;

          return (
            <div
              key={c.function_name}
              className={`flex items-start justify-between gap-3 p-3 rounded-lg border ${
                ativo ? 'bg-green-50 border-green-200'
                  : existe ? 'bg-amber-50 border-amber-200'
                  : 'bg-red-50 border-red-200'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {ativo ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                  ) : existe ? (
                    <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  )}
                  <span className="font-medium text-sm text-slate-800">{c.label}</span>
                  {ativo && <Badge className="bg-green-600 text-white text-[10px]">ATIVO</Badge>}
                  {existe && !ativo && <Badge className="bg-amber-500 text-white text-[10px]">PAUSADO</Badge>}
                  {!existe && <Badge className="bg-red-600 text-white text-[10px]">NÃO AGENDADO</Badge>}
                </div>
                <p className="text-xs text-slate-600 ml-6">{c.descricao}</p>
                {existe && (
                  <div className="text-[11px] text-slate-500 ml-6 mt-1 flex flex-wrap gap-x-3">
                    <span>Total runs: <strong>{auto.total_runs || 0}</strong></span>
                    <span>Sucesso: <strong>{auto.successful_runs || 0}</strong></span>
                    <span>Falhas: <strong className={auto.failed_runs > 0 ? 'text-red-600' : ''}>{auto.failed_runs || 0}</strong></span>
                    {ultimoRun && (
                      <span>Última: <strong>{format(ultimoRun, 'dd/MM HH:mm', { locale: ptBR })}</strong></span>
                    )}
                  </div>
                )}
              </div>

              {existe && (
                <Button
                  size="sm"
                  variant={ativo ? 'outline' : 'default'}
                  className={ativo ? '' : 'bg-green-600 hover:bg-green-700 text-white'}
                  onClick={() => onToggle(auto)}
                  disabled={isToggling}
                >
                  {isToggling ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : ativo ? (
                    <><PowerOff className="w-3.5 h-3.5 mr-1" />Pausar</>
                  ) : (
                    <><Power className="w-3.5 h-3.5 mr-1" />Ativar</>
                  )}
                </Button>
              )}
            </div>
          );
        })}

        <p className="text-[11px] text-slate-500 mt-2">
          ℹ️ Crons de envio rodam a cada 5min. Ao pausar, eles param imediatamente.
        </p>
      </CardContent>
    </Card>
  );
}
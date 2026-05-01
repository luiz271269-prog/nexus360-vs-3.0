import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Inbox } from 'lucide-react';

const TRIGGER_LABEL = {
  inbound_6h: { label: 'Inbound 6h', cor: 'bg-blue-100 text-blue-700' },
  batch_36h: { label: 'Batch 36h', cor: 'bg-purple-100 text-purple-700' },
  fila_agendada: { label: 'Fila', cor: 'bg-cyan-100 text-cyan-700' },
  massa_manual: { label: 'Massa Manual', cor: 'bg-orange-100 text-orange-700' },
  manual_individual: { label: 'Manual', cor: 'bg-slate-100 text-slate-700' },
  api_externa: { label: 'API/Agente', cor: 'bg-pink-100 text-pink-700' }
};

const STATUS_LABEL = {
  em_andamento: { label: 'Em andamento', cor: 'bg-blue-500 text-white' },
  concluida: { label: 'Concluída', cor: 'bg-green-500 text-white' },
  falhou: { label: 'Falhou', cor: 'bg-red-500 text-white' },
  sem_envios: { label: 'Sem envios', cor: 'bg-slate-400 text-white' }
};

export default function TabelaCampanhasPromocao({ campanhas, loading }) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-slate-500">
          Carregando campanhas...
        </CardContent>
      </Card>
    );
  }

  if (!campanhas || campanhas.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Inbox className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-500">Nenhum disparo no período selecionado.</p>
          <p className="text-xs text-slate-400 mt-1">
            Quando promoções forem enviadas, elas aparecerão aqui.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Campanhas / Disparos</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-xs text-slate-600 uppercase">
                <th className="px-3 py-2">Promoção</th>
                <th className="px-3 py-2">Gatilho</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-right">Enviadas</th>
                <th className="px-3 py-2 text-right">Bloq.</th>
                <th className="px-3 py-2 text-right">Erros</th>
                <th className="px-3 py-2 text-right">Sucesso</th>
                <th className="px-3 py-2">Último envio</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {campanhas.map((c) => {
                const trig = TRIGGER_LABEL[c.trigger] || { label: c.trigger, cor: 'bg-slate-100 text-slate-700' };
                const stat = STATUS_LABEL[c.status_geral] || { label: c.status_geral, cor: 'bg-slate-400 text-white' };
                return (
                  <tr key={c.group_key} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-800 truncate max-w-[200px]" title={c.promotion_titulo}>
                        {c.promotion_titulo}
                      </div>
                      {c.initiated_by && (
                        <div className="text-[10px] text-slate-500 truncate max-w-[200px]">{c.initiated_by}</div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Badge className={`${trig.cor} text-[10px] font-normal`}>{trig.label}</Badge>
                    </td>
                    <td className="px-3 py-2 text-right font-medium">{c.total}</td>
                    <td className="px-3 py-2 text-right text-green-600 font-medium">{c.enviadas}</td>
                    <td className="px-3 py-2 text-right text-amber-600">{c.bloqueadas}</td>
                    <td className="px-3 py-2 text-right text-red-600">{c.erros}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={c.taxa_sucesso >= 80 ? 'text-green-600 font-semibold'
                        : c.taxa_sucesso >= 50 ? 'text-amber-600' : 'text-red-600'}>
                        {(c.taxa_sucesso || 0).toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {format(new Date(c.ultimo_envio), 'dd/MM HH:mm', { locale: ptBR })}
                    </td>
                    <td className="px-3 py-2">
                      <Badge className={`${stat.cor} text-[10px]`}>{stat.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
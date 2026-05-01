import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, ShieldAlert, XCircle, Send } from 'lucide-react';

export default function ResumoEnviosPromocao({ resumo }) {
  if (!resumo) return null;

  const cards = [
    { label: 'Total disparos', valor: resumo.total || 0, icon: Send, cor: 'text-slate-600', bg: 'bg-slate-50' },
    { label: 'Enviadas', valor: resumo.enviadas || 0, icon: CheckCircle2, cor: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Bloqueadas', valor: resumo.bloqueadas || 0, icon: ShieldAlert, cor: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Erros', valor: resumo.erros || 0, icon: XCircle, cor: 'text-red-600', bg: 'bg-red-50' }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <Card key={c.label} className={c.bg}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-600 mb-1">{c.label}</div>
                  <div className={`text-2xl font-bold ${c.cor}`}>{c.valor}</div>
                </div>
                <Icon className={`w-8 h-8 ${c.cor} opacity-60`} />
              </div>
            </CardContent>
          </Card>
        );
      })}
      {resumo.total > 0 && (
        <Card className="col-span-2 md:col-span-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-3 flex items-center justify-between">
            <span className="text-sm text-slate-700">Taxa de sucesso geral</span>
            <span className="text-xl font-bold text-blue-700">
              {(resumo.taxa_sucesso || 0).toFixed(1)}%
            </span>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
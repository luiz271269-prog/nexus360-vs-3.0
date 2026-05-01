import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldAlert } from 'lucide-react';

const MOTIVO_LABELS = {
  opt_out: 'Opt-out (cliente pediu pra parar)',
  cooldown_universal_12h: 'Cooldown 12h ativo',
  janela_expirada: 'Janela 24h Meta expirada',
  contato_bloqueado: 'Contato bloqueado',
  contato_nao_encontrado: 'Contato não encontrado',
  promocao_inativa: 'Promoção inativa/expirada',
  promocao_nao_encontrada: 'Promoção não encontrada',
  sem_telefone: 'Contato sem telefone',
  excedente: 'Excedente do tier diário',
  desconhecido: 'Desconhecido'
};

export default function MotivosBloqueio({ campanhas }) {
  // Agrega motivos de bloqueio de todas as campanhas
  const totais = {};
  for (const c of (campanhas || [])) {
    for (const [motivo, qtd] of Object.entries(c.motivos_bloqueio || {})) {
      totais[motivo] = (totais[motivo] || 0) + qtd;
    }
  }

  const lista = Object.entries(totais).sort((a, b) => b[1] - a[1]);

  if (lista.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-500" />
          Motivos de Bloqueio (período)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {lista.map(([motivo, qtd]) => (
            <div key={motivo} className="flex items-center justify-between text-sm">
              <span className="text-slate-700">{MOTIVO_LABELS[motivo] || motivo}</span>
              <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                {qtd}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
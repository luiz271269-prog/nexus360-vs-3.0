import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { XCircle, Loader2, X } from 'lucide-react';

const MOTIVOS = [
  'Preço alto',
  'Prazo de entrega',
  'Fechou com concorrente',
  'Sem verba / orçamento',
  'Sem retorno do cliente',
  'Projeto cancelado',
  'Outro'
];

export default function RejeicaoMotivoModal({ orcamento, onConfirmar, onCancelar }) {
  const [motivo, setMotivo] = useState('');
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);

  const selecionarMotivo = (m) => {
    setMotivo(m);
    // Pré-preenche a observação com o motivo escolhido
    setObservacao((prev) => (prev?.trim() ? prev : m));
  };

  const handleConfirmar = async () => {
    if (!motivo) return;
    setSalvando(true);
    try {
      await onConfirmar({ motivo, observacao: observacao.trim() || motivo });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={onCancelar}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-sm">Motivo da Rejeição</h2>
              <p className="text-xs text-slate-500 truncate max-w-[280px]">{orcamento?.cliente_nome || 'Orçamento'}</p>
            </div>
          </div>
          <button onClick={onCancelar} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-4 space-y-4">
          <div>
            <Label className="text-xs text-slate-600 mb-2 block">Selecione o motivo *</Label>
            <div className="flex flex-wrap gap-2">
              {MOTIVOS.map((m) => (
                <button
                  key={m}
                  onClick={() => selecionarMotivo(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${
                    motivo === m
                      ? 'border-rose-500 bg-rose-50 text-rose-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-rose-300'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs text-slate-600 mb-1 block">Observação</Label>
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Detalhe o motivo da rejeição..."
              className="text-sm h-24 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-4 border-t">
          <Button variant="outline" onClick={onCancelar} disabled={salvando} className="flex-1 h-9 text-sm">
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmar}
            disabled={!motivo || salvando}
            className="flex-1 h-9 text-sm bg-rose-600 hover:bg-rose-700 text-white"
          >
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar Rejeição'}
          </Button>
        </div>
      </div>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send, Trash2, NotebookPen, MessageSquare, Phone, MapPin, Bell } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

const TIPOS = [
  { key: 'nota', label: 'Nota', Icon: NotebookPen, cor: 'bg-amber-500' },
  { key: 'ligacao', label: 'Ligação', Icon: Phone, cor: 'bg-blue-500' },
  { key: 'visita', label: 'Visita', Icon: MapPin, cor: 'bg-emerald-500' },
  { key: 'followup', label: 'Follow-up', Icon: Bell, cor: 'bg-purple-500' },
];

export default function OrcamentoHistoricoPanel({ orcamento, onUpdate }) {
  const [historico, setHistorico] = useState(orcamento?.historico_interno || []);
  const [texto, setTexto] = useState('');
  const [tipo, setTipo] = useState('nota');
  const [saving, setSaving] = useState(false);
  const [usuario, setUsuario] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUsuario).catch(() => setUsuario(null));
  }, []);

  useEffect(() => {
    setHistorico(orcamento?.historico_interno || []);
  }, [orcamento?.id]);

  const handleAdicionar = async () => {
    if (!texto.trim()) {
      toast.error('Digite algo antes de salvar');
      return;
    }
    setSaving(true);
    try {
      const nova = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        autor_id: usuario?.id || '',
        autor_nome: usuario?.full_name || usuario?.email || 'Usuário',
        data: new Date().toISOString(),
        tipo,
        texto: texto.trim(),
      };
      const novoHistorico = [nova, ...historico];
      await base44.entities.Orcamento.update(orcamento.id, {
        historico_interno: novoHistorico,
      });
      setHistorico(novoHistorico);
      setTexto('');
      onUpdate?.({ ...orcamento, historico_interno: novoHistorico });
      toast.success('Histórico adicionado');
    } catch (e) {
      toast.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleRemover = async (id) => {
    if (!confirm('Remover este histórico?')) return;
    try {
      const novoHistorico = historico.filter(h => h.id !== id);
      await base44.entities.Orcamento.update(orcamento.id, {
        historico_interno: novoHistorico,
      });
      setHistorico(novoHistorico);
      onUpdate?.({ ...orcamento, historico_interno: novoHistorico });
      toast.success('Removido');
    } catch {
      toast.error('Erro ao remover');
    }
  };

  const ordenado = [...historico].sort(
    (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
  );

  return (
    <div className="flex flex-col h-full">
      {/* Cabeçalho da coluna */}
      <div className="px-4 py-3 border-b flex items-center gap-2">
        <NotebookPen className="w-4 h-4 text-amber-500" />
        <h3 className="font-bold text-slate-800 text-sm">Históricos</h3>
        <span className="ml-auto text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">
          {historico.length}
        </span>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[200px]">
        {ordenado.length === 0 ? (
          <p className="text-center text-slate-400 text-xs py-6">
            Nenhum histórico registrado ainda.
          </p>
        ) : (
          ordenado.map((h) => {
            const tipoCfg = TIPOS.find(t => t.key === h.tipo) || TIPOS[0];
            const Icon = tipoCfg.Icon;
            return (
              <div
                key={h.id}
                className="border border-slate-200 rounded-lg p-2.5 bg-white hover:border-amber-300 transition-colors group"
              >
                <div className="flex items-start gap-2">
                  <div className={`w-6 h-6 rounded-md ${tipoCfg.cor} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className="text-xs font-semibold text-slate-700 truncate">
                        {h.autor_nome || 'Sistema'}
                      </p>
                      <button
                        onClick={() => handleRemover(h.id)}
                        className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mb-1">
                      {h.data ? format(new Date(h.data), "dd/MM 'às' HH:mm", { locale: ptBR }) : '-'}
                    </p>
                    {h.texto && (
                      <p className="text-xs text-slate-700 whitespace-pre-wrap break-words">
                        {h.texto}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input para nova entrada */}
      <div className="border-t p-3 space-y-2 bg-slate-50">
        <div className="flex gap-1 flex-wrap">
          {TIPOS.map(t => {
            const Icon = t.Icon;
            const ativo = tipo === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTipo(t.key)}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-all ${
                  ativo
                    ? `${t.cor} text-white`
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-3 h-3" />
                {t.label}
              </button>
            );
          })}
        </div>
        <Textarea
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder="Digite uma nota, registro de ligação, visita ou follow-up..."
          className="text-xs h-20 resize-none bg-white"
        />
        <Button
          onClick={handleAdicionar}
          disabled={saving || !texto.trim()}
          size="sm"
          className="w-full h-8 text-xs bg-amber-500 hover:bg-amber-600 text-white"
        >
          {saving ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <>
              <Send className="w-3 h-3 mr-1" />
              Adicionar histórico
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
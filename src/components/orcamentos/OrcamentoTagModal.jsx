import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Star, Flame, Zap, AlertTriangle, CheckCircle, Clock, Trophy, Heart,
  Tag, Plus, X, Trash2, Loader2
} from 'lucide-react';
import { toast } from 'sonner';

const ICONES_DISPONIVEIS = [
  { key: 'Star', Icon: Star, label: 'Estrela' },
  { key: 'Flame', Icon: Flame, label: 'Chama' },
  { key: 'Zap', Icon: Zap, label: 'Raio' },
  { key: 'AlertTriangle', Icon: AlertTriangle, label: 'Alerta' },
  { key: 'CheckCircle', Icon: CheckCircle, label: 'Check' },
  { key: 'Clock', Icon: Clock, label: 'Relógio' },
  { key: 'Trophy', Icon: Trophy, label: 'Troféu' },
  { key: 'Heart', Icon: Heart, label: 'Coração' },
  { key: 'Tag', Icon: Tag, label: 'Tag' },
];

const CORES = [
  { hex: '#f59e0b', name: 'Âmbar' },
  { hex: '#ef4444', name: 'Vermelho' },
  { hex: '#10b981', name: 'Verde' },
  { hex: '#3b82f6', name: 'Azul' },
  { hex: '#8b5cf6', name: 'Roxo' },
  { hex: '#f97316', name: 'Laranja' },
  { hex: '#06b6d4', name: 'Ciano' },
  { hex: '#ec4899', name: 'Rosa' },
  { hex: '#64748b', name: 'Cinza' },
];

function getIconComponent(key) {
  return ICONES_DISPONIVEIS.find(i => i.key === key)?.Icon || Tag;
}

export default function OrcamentoTagModal({ orcamento, onClose, onSave }) {
  const [etiquetas, setEtiquetas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [criando, setCriando] = useState(false);
  const [selecionadas, setSelecionadas] = useState(orcamento?.etiquetas || []);

  // form nova etiqueta
  const [novaEtiqueta, setNovaEtiqueta] = useState({
    nome: '', icone: 'Tag', cor: '#f59e0b', observacao: ''
  });

  useEffect(() => {
    carregarEtiquetas();
  }, []);

  const carregarEtiquetas = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.EtiquetaOrcamento.list();
      setEtiquetas(data || []);
    } catch (e) {
      toast.error('Erro ao carregar etiquetas');
    } finally {
      setLoading(false);
    }
  };

  const toggleEtiqueta = (id) => {
    setSelecionadas(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const handleSalvar = async () => {
    setSaving(true);
    try {
      await base44.entities.Orcamento.update(orcamento.id, { etiquetas: selecionadas });
      toast.success('Etiquetas salvas!');
      onSave?.({ ...orcamento, etiquetas: selecionadas });
      onClose();
    } catch (e) {
      toast.error('Erro ao salvar etiquetas');
    } finally {
      setSaving(false);
    }
  };

  const handleCriarEtiqueta = async () => {
    if (!novaEtiqueta.nome.trim()) { toast.error('Nome obrigatório'); return; }
    setSaving(true);
    try {
      const criada = await base44.entities.EtiquetaOrcamento.create({
        ...novaEtiqueta,
        cor_texto: '#ffffff',
        ativo: true
      });
      setEtiquetas(prev => [...prev, criada]);
      setSelecionadas(prev => [...prev, criada.id]);
      setNovaEtiqueta({ nome: '', icone: 'Tag', cor: '#f59e0b', observacao: '' });
      setCriando(false);
      toast.success('Etiqueta criada!');
    } catch (e) {
      toast.error('Erro ao criar etiqueta');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletarEtiqueta = async (id, e) => {
    e.stopPropagation();
    try {
      await base44.entities.EtiquetaOrcamento.delete(id);
      setEtiquetas(prev => prev.filter(et => et.id !== id));
      setSelecionadas(prev => prev.filter(s => s !== id));
      toast.success('Etiqueta removida');
    } catch {
      toast.error('Erro ao deletar');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-orange-500" />
            <div>
              <h2 className="font-bold text-slate-800 text-sm">Etiquetas</h2>
              <p className="text-xs text-slate-500 truncate max-w-[220px]">{orcamento?.cliente_nome}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Lista de etiquetas */}
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-orange-500" /></div>
          ) : (
            <div className="space-y-2">
              {etiquetas.length === 0 && !criando && (
                <p className="text-center text-slate-400 text-sm py-4">Nenhuma etiqueta criada ainda.</p>
              )}
              {etiquetas.map(et => {
                const IconComp = getIconComponent(et.icone);
                const ativa = selecionadas.includes(et.id);
                return (
                  <div
                    key={et.id}
                    onClick={() => toggleEtiqueta(et.id)}
                    className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer border-2 transition-all ${
                      ativa ? 'border-orange-400 bg-orange-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: et.cor || '#f59e0b' }}>
                      <IconComp className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{et.nome}</p>
                      {et.observacao && <p className="text-xs text-slate-400 truncate">{et.observacao}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      {ativa && <CheckCircle className="w-4 h-4 text-orange-500" />}
                      <button
                        onPointerDown={e => e.stopPropagation()}
                        onClick={e => handleDeletarEtiqueta(et.id, e)}
                        className="text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Formulário nova etiqueta */}
          {criando ? (
            <div className="border-2 border-orange-200 rounded-xl p-3 space-y-3 bg-orange-50">
              <p className="text-xs font-bold text-orange-700 uppercase tracking-wide">Nova Etiqueta</p>
              <div>
                <Label className="text-xs text-slate-600 mb-1 block">Nome *</Label>
                <Input
                  value={novaEtiqueta.nome}
                  onChange={e => setNovaEtiqueta(p => ({ ...p, nome: e.target.value }))}
                  placeholder="Ex: Urgente, Cliente VIP..."
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1 block">Observação</Label>
                <Textarea
                  value={novaEtiqueta.observacao}
                  onChange={e => setNovaEtiqueta(p => ({ ...p, observacao: e.target.value }))}
                  placeholder="Descrição da etiqueta..."
                  className="text-sm h-16 resize-none"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1 block">Ícone</Label>
                <div className="flex flex-wrap gap-1.5">
                  {ICONES_DISPONIVEIS.map(({ key, Icon }) => (
                    <button
                      key={key}
                      onClick={() => setNovaEtiqueta(p => ({ ...p, icone: key }))}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center border-2 transition-all ${
                        novaEtiqueta.icone === key ? 'border-orange-500 bg-orange-100' : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="w-4 h-4 text-slate-700" />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1 block">Cor</Label>
                <div className="flex flex-wrap gap-1.5">
                  {CORES.map(({ hex, name }) => (
                    <button
                      key={hex}
                      title={name}
                      onClick={() => setNovaEtiqueta(p => ({ ...p, cor: hex }))}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${
                        novaEtiqueta.cor === hex ? 'border-slate-800 scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleCriarEtiqueta} disabled={saving}
                  className="bg-orange-500 hover:bg-orange-600 text-white flex-1 h-8 text-xs">
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3 mr-1" />}
                  Criar
                </Button>
                <Button size="sm" variant="outline" onClick={() => setCriando(false)} className="h-8 text-xs">
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setCriando(true)}
              className="w-full flex items-center justify-center gap-2 py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-orange-400 hover:text-orange-500 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" /> Criar tipo de etiqueta
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-4 border-t">
          <Button variant="outline" onClick={onClose} className="flex-1 h-9 text-sm">Cancelar</Button>
          <Button onClick={handleSalvar} disabled={saving}
            className="flex-1 h-9 text-sm bg-orange-500 hover:bg-orange-600 text-white">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
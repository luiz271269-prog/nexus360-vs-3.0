import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Plus, Trash2 } from 'lucide-react';

export default function NovaCotacaoModal({ cotacao, onSave, onClose }) {
  const [form, setForm] = useState({
    fornecedor_nome: '',
    fornecedor_contato: '',
    fornecedor_cnpj: '',
    orcamento_id: '',
    orcamento_numero: '',
    prioridade: 'normal',
    prazo_entrega_dias: '',
    data_validade: '',
    condicao_pagamento: '',
    valor_frete: 0,
    observacoes: '',
    status: 'rascunho',
    itens: [],
  });
  const [orcamentos, setOrcamentos] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    base44.entities.Orcamento.list('-created_date', 100)
      .then(r => setOrcamentos(r || []))
      .catch(() => {});

    if (cotacao) {
      setForm({
        fornecedor_nome: cotacao.fornecedor_nome || '',
        fornecedor_contato: cotacao.fornecedor_contato || '',
        fornecedor_cnpj: cotacao.fornecedor_cnpj || '',
        orcamento_id: cotacao.orcamento_id || '',
        orcamento_numero: cotacao.orcamento_numero || '',
        prioridade: cotacao.prioridade || 'normal',
        prazo_entrega_dias: cotacao.prazo_entrega_dias || '',
        data_validade: cotacao.data_validade || '',
        condicao_pagamento: cotacao.condicao_pagamento || '',
        valor_frete: cotacao.valor_frete || 0,
        observacoes: cotacao.observacoes || '',
        status: cotacao.status || 'rascunho',
        itens: cotacao.itens || [],
      });
    }
  }, [cotacao]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const addItem = () => setForm(p => ({
    ...p,
    itens: [...p.itens, { nome_produto: '', quantidade: 1, valor_unitario: 0, valor_total: 0 }]
  }));

  const removeItem = (i) => setForm(p => ({ ...p, itens: p.itens.filter((_, idx) => idx !== i) }));

  const updateItem = (i, k, v) => setForm(p => {
    const itens = [...p.itens];
    itens[i] = { ...itens[i], [k]: v };
    if (k === 'quantidade' || k === 'valor_unitario') {
      itens[i].valor_total = (itens[i].quantidade || 0) * (itens[i].valor_unitario || 0);
    }
    return { ...p, itens };
  });

  const valorTotalItens = form.itens.reduce((s, i) => s + (i.valor_total || 0), 0) + (form.valor_frete || 0);

  const handleOrcamentoChange = (id) => {
    const orc = orcamentos.find(o => o.id === id);
    set('orcamento_id', id);
    set('orcamento_numero', orc?.numero_orcamento || '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.fornecedor_nome) return;
    setSaving(true);
    await onSave({ ...form, valor_total: valorTotalItens });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-bold text-slate-800">{cotacao ? 'Editar Cotação' : 'Nova Cotação de Compra'}</h2>
          <Button size="icon" variant="ghost" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Fornecedor */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600">Fornecedor *</label>
              <Input value={form.fornecedor_nome} onChange={e => set('fornecedor_nome', e.target.value)}
                placeholder="Nome do fornecedor" className="mt-1 h-8 text-sm" required />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Contato</label>
              <Input value={form.fornecedor_contato} onChange={e => set('fornecedor_contato', e.target.value)}
                placeholder="Tel/email" className="mt-1 h-8 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">CNPJ</label>
              <Input value={form.fornecedor_cnpj} onChange={e => set('fornecedor_cnpj', e.target.value)}
                placeholder="00.000.000/0001-00" className="mt-1 h-8 text-sm" />
            </div>
          </div>

          {/* Vínculo com orçamento + prioridade */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600">Vincular a Orçamento de Venda</label>
              <select value={form.orcamento_id} onChange={e => handleOrcamentoChange(e.target.value)}
                className="mt-1 h-8 w-full px-2 text-sm border border-slate-200 rounded-md bg-white">
                <option value="">— Sem vínculo —</option>
                {orcamentos.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.numero_orcamento || o.id.substring(0,8)} — {o.cliente_nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Prioridade</label>
              <select value={form.prioridade} onChange={e => set('prioridade', e.target.value)}
                className="mt-1 h-8 w-full px-2 text-sm border border-slate-200 rounded-md bg-white">
                <option value="baixa">Baixa</option>
                <option value="normal">Normal</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600">Validade</label>
              <Input type="date" value={form.data_validade} onChange={e => set('data_validade', e.target.value)}
                className="mt-1 h-8 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Prazo Entrega (dias)</label>
              <Input type="number" value={form.prazo_entrega_dias} onChange={e => set('prazo_entrega_dias', Number(e.target.value))}
                className="mt-1 h-8 text-sm" min={0} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Cond. Pagamento</label>
              <Input value={form.condicao_pagamento} onChange={e => set('condicao_pagamento', e.target.value)}
                placeholder="ex: 30/60/90" className="mt-1 h-8 text-sm" />
            </div>
          </div>

          {/* Itens */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700">Itens</label>
              <Button type="button" size="sm" variant="outline" className="h-6 text-xs gap-1" onClick={addItem}>
                <Plus className="w-3 h-3" /> Adicionar Item
              </Button>
            </div>
            {form.itens.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-4 border border-dashed rounded-lg">
                Nenhum item adicionado
              </p>
            )}
            <div className="space-y-2">
              {form.itens.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-1 items-center bg-slate-50 rounded-lg p-2">
                  <div className="col-span-5">
                    <Input value={item.nome_produto} onChange={e => updateItem(i, 'nome_produto', e.target.value)}
                      placeholder="Produto" className="h-7 text-xs" />
                  </div>
                  <div className="col-span-2">
                    <Input type="number" value={item.quantidade} onChange={e => updateItem(i, 'quantidade', Number(e.target.value))}
                      placeholder="Qtd" className="h-7 text-xs" min={1} />
                  </div>
                  <div className="col-span-2">
                    <Input type="number" value={item.valor_unitario} onChange={e => updateItem(i, 'valor_unitario', Number(e.target.value))}
                      placeholder="R$ unit." className="h-7 text-xs" min={0} step={0.01} />
                  </div>
                  <div className="col-span-2 text-xs text-slate-500 text-right pr-1">
                    R$ {(item.valor_total || 0).toFixed(2)}
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeItem(i)}>
                      <Trash2 className="w-3 h-3 text-red-400" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Frete + Total */}
          <div className="flex items-center justify-between border-t pt-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-600">Frete R$</label>
              <Input type="number" value={form.valor_frete} onChange={e => set('valor_frete', Number(e.target.value))}
                className="h-7 w-24 text-xs" min={0} step={0.01} />
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500">Total: </span>
              <span className="text-lg font-bold text-blue-700">
                R$ {valorTotalItens.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Observações</label>
            <textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)}
              rows={2} placeholder="Observações adicionais..."
              className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-blue-400" />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving ? 'Salvando...' : cotacao ? 'Salvar Alterações' : 'Criar Cotação'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
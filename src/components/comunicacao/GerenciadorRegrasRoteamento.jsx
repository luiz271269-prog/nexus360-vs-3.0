import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus, Trash2, Zap, X, ChevronDown, ChevronUp,
  ToggleLeft, ToggleRight, FlaskConical, CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';

const SETORES = [
  { value: 'vendas', label: '💼 Vendas' },
  { value: 'assistencia', label: '🔧 Suporte / Assistência' },
  { value: 'financeiro', label: '💰 Financeiro' },
  { value: 'fornecedor', label: '📦 Fornecedor' },
  { value: 'geral', label: '🌐 Geral' }
];

const MATCH_TYPES = [
  { value: 'any', label: 'Qualquer palavra (OR)' },
  { value: 'all', label: 'Todas as palavras (AND)' },
  { value: 'exact', label: 'Frase exata' }
];

const REGRAS_PADRAO = [
  { nome_regra: 'Suporte Técnico', termos_chave: ['problema', 'suporte', 'erro', 'não funciona', 'defeito', 'quebrou', 'assistência técnica'], setor_alvo: 'assistencia', match_type: 'any', prioridade: 10, ativo: true, case_sensitive: false },
  { nome_regra: 'Vendas / Orçamento', termos_chave: ['orçamento', 'comprar', 'preço', 'valor', 'venda', 'cotação', 'quanto custa'], setor_alvo: 'vendas', match_type: 'any', prioridade: 20, ativo: true, case_sensitive: false },
  { nome_regra: 'Financeiro / Pagamento', termos_chave: ['boleto', 'pagamento', 'fatura', 'nota fiscal', 'cobrança', 'débito'], setor_alvo: 'financeiro', match_type: 'any', prioridade: 30, ativo: true, case_sensitive: false }
];

function TagInput({ value = [], onChange, placeholder }) {
  const [inputValue, setInputValue] = useState('');

  const addTag = () => {
    const tag = inputValue.trim().toLowerCase();
    if (tag && !value.includes(tag)) {
      onChange([...value, tag]);
    }
    setInputValue('');
  };

  const removeTag = (tag) => onChange(value.filter(t => t !== tag));

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
          placeholder={placeholder}
          className="text-sm h-8"
        />
        <Button type="button" size="sm" onClick={addTag} className="h-8 px-2">
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {value.map(tag => (
          <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full text-xs border">
            {tag}
            <button onClick={() => removeTag(tag)} className="text-slate-400 hover:text-red-500">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

function RegraCard({ regra, onSave, onDelete }) {
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState(regra);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.nome_regra || form.termos_chave?.length === 0) {
      toast.error('Nome e pelo menos 1 palavra-chave são obrigatórios');
      return;
    }
    setSaving(true);
    await onSave(form);
    setSaving(false);
    setEditando(false);
  };

  const setor = SETORES.find(s => s.value === regra.setor_alvo);

  return (
    <Card className={`border transition-all ${regra.ativo ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-slate-800">{regra.nome_regra}</span>
              <Badge variant="outline" className="text-xs">{setor?.label || regra.setor_alvo}</Badge>
              <Badge variant="outline" className="text-xs text-slate-500">
                Prioridade {regra.prioridade}
              </Badge>
              {(regra.metricas?.total_ativacoes || 0) > 0 && (
                <Badge className="text-xs bg-green-100 text-green-700 border-0">
                  {regra.metricas.total_ativacoes} ativações
                </Badge>
              )}
            </div>
            {!editando && (
              <div className="flex flex-wrap gap-1 mt-2">
                {(regra.termos_chave || []).map(t => (
                  <span key={t} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs border border-blue-200">{t}</span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => onSave({ ...regra, ativo: !regra.ativo })}
              className="text-slate-400 hover:text-slate-700"
              title={regra.ativo ? 'Desativar' : 'Ativar'}
            >
              {regra.ativo
                ? <ToggleRight className="w-5 h-5 text-green-500" />
                : <ToggleLeft className="w-5 h-5" />}
            </button>
            <button onClick={() => setEditando(!editando)} className="text-slate-400 hover:text-slate-700">
              {editando ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <button onClick={() => onDelete(regra.id)} className="text-slate-400 hover:text-red-500">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {editando && (
          <div className="mt-4 space-y-3 border-t pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-600 mb-1">Nome da regra</Label>
                <Input value={form.nome_regra} onChange={e => setForm(p => ({ ...p, nome_regra: e.target.value }))} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1">Prioridade (menor = maior)</Label>
                <Input type="number" value={form.prioridade} onChange={e => setForm(p => ({ ...p, prioridade: parseInt(e.target.value) || 10 }))} className="h-8 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-600 mb-1">Setor destino</Label>
                <Select value={form.setor_alvo} onValueChange={v => setForm(p => ({ ...p, setor_alvo: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SETORES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1">Tipo de match</Label>
                <Select value={form.match_type || 'any'} onValueChange={v => setForm(p => ({ ...p, match_type: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MATCH_TYPES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-600 mb-1">Palavras-chave (Enter para adicionar)</Label>
              <TagInput
                value={form.termos_chave || []}
                onChange={v => setForm(p => ({ ...p, termos_chave: v }))}
                placeholder="Ex: suporte técnico, problema..."
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => { setEditando(false); setForm(regra); }}>Cancelar</Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="bg-orange-500 hover:bg-orange-600">
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function GerenciadorRegrasRoteamento() {
  const [regras, setRegras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [textoTeste, setTextoTeste] = useState('');
  const [resultadoTeste, setResultadoTeste] = useState(null);
  const [testando, setTestando] = useState(false);

  useEffect(() => { carregar(); }, []);

  const carregar = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.RegrasIntencao.list('prioridade', 50);
      setRegras(data);
    } catch (e) {
      toast.error('Erro ao carregar regras');
    }
    setLoading(false);
  };

  const salvarRegra = async (regra) => {
    try {
      if (regra.id) {
        await base44.entities.RegrasIntencao.update(regra.id, regra);
      } else {
        await base44.entities.RegrasIntencao.create(regra);
      }
      toast.success('Regra salva!');
      await carregar();
    } catch (e) {
      toast.error('Erro ao salvar regra');
    }
  };

  const deletarRegra = async (id) => {
    if (!confirm('Excluir esta regra?')) return;
    try {
      await base44.entities.RegrasIntencao.delete(id);
      toast.success('Regra removida');
      await carregar();
    } catch (e) {
      toast.error('Erro ao excluir regra');
    }
  };

  const adicionarNova = async () => {
    const nova = {
      nome_regra: 'Nova Regra',
      termos_chave: [],
      setor_alvo: 'geral',
      match_type: 'any',
      prioridade: (regras.length + 1) * 10,
      ativo: true,
      case_sensitive: false
    };
    try {
      await base44.entities.RegrasIntencao.create(nova);
      await carregar();
    } catch (e) {
      toast.error('Erro ao criar regra');
    }
  };

  const importarPadrao = async () => {
    if (!confirm(`Importar ${REGRAS_PADRAO.length} regras padrão? Regras existentes não serão afetadas.`)) return;
    try {
      for (const r of REGRAS_PADRAO) {
        await base44.entities.RegrasIntencao.create(r);
      }
      toast.success(`${REGRAS_PADRAO.length} regras importadas!`);
      await carregar();
    } catch (e) {
      toast.error('Erro ao importar regras padrão');
    }
  };

  const testarTexto = async () => {
    if (!textoTeste.trim()) return;
    setTestando(true);
    setResultadoTeste(null);
    try {
      const res = await base44.functions.invoke('aplicarRegrasRoteamento', {
        message_text: textoTeste,
        auto_apply: false
      });
      setResultadoTeste(res.data);
    } catch (e) {
      toast.error('Erro ao testar: ' + e.message);
    }
    setTestando(false);
  };

  const regrasAtivas = regras.filter(r => r.ativo).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <Zap className="w-4 h-4 text-orange-500" />
            Regras de Roteamento por Palavras-chave
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {regrasAtivas} regra{regrasAtivas !== 1 ? 's' : ''} ativa{regrasAtivas !== 1 ? 's' : ''} · Mensagens recebidas são analisadas em ordem de prioridade
          </p>
        </div>
        <div className="flex gap-2">
          {regras.length === 0 && (
            <Button variant="outline" size="sm" onClick={importarPadrao} className="text-xs h-8">
              Importar padrão
            </Button>
          )}
          <Button size="sm" onClick={adicionarNova} className="bg-orange-500 hover:bg-orange-600 h-8 text-xs">
            <Plus className="w-3.5 h-3.5 mr-1" /> Nova regra
          </Button>
        </div>
      </div>

      {/* Teste de texto */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="p-3">
          <Label className="text-xs text-slate-600 mb-1.5 flex items-center gap-1">
            <FlaskConical className="w-3.5 h-3.5" /> Testar texto de mensagem
          </Label>
          <div className="flex gap-2">
            <Input
              value={textoTeste}
              onChange={e => setTextoTeste(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && testarTexto()}
              placeholder="Ex: Preciso de suporte técnico urgente com minha máquina..."
              className="text-sm h-8 bg-white"
            />
            <Button size="sm" onClick={testarTexto} disabled={testando || !textoTeste.trim()} className="h-8 px-3">
              {testando ? 'Testando...' : 'Testar'}
            </Button>
          </div>
          {resultadoTeste && (
            <div className={`mt-2 p-2.5 rounded-lg text-xs flex items-start gap-2 ${resultadoTeste.matched ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
              {resultadoTeste.matched
                ? <CheckCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-green-600" />
                : <X className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-slate-400" />}
              <span>
                {resultadoTeste.matched
                  ? <>Regra ativada: <strong>"{resultadoTeste.regra?.nome}"</strong> → Setor: <strong>{resultadoTeste.regra?.setor_alvo}</strong></>
                  : resultadoTeste.reason || 'Nenhuma regra correspondeu'}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista de regras */}
      {loading ? (
        <div className="text-center py-8 text-slate-400 text-sm">Carregando regras...</div>
      ) : regras.length === 0 ? (
        <div className="text-center py-10 text-slate-400">
          <Zap className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhuma regra configurada.</p>
          <p className="text-xs mt-1">Clique em "Importar padrão" para começar com regras prontas.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {regras.map(regra => (
            <RegraCard key={regra.id} regra={regra} onSave={salvarRegra} onDelete={deletarRegra} />
          ))}
        </div>
      )}
    </div>
  );
}
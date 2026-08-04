import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Save, Trash2, RotateCcw } from 'lucide-react';
import { CATEGORIAS, FLUXOS, aplicarFluxosPersonalizados } from './agendaFluxos';

const slug = texto => texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const doPadrao = categoria => ({
  etapas: FLUXOS[categoria].etapas.map(([valor, rotulo]) => ({ valor, rotulo })),
  finais: FLUXOS[categoria].finais.map(([valor, rotulo]) => ({ valor, rotulo }))
});

function ListaEtapas({ titulo, lista, onChange }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wide text-slate-500">{titulo}</Label>
      {lista.map((etapa, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input value={etapa.rotulo} placeholder="Nome da etapa"
            onChange={e => onChange(lista.map((x, j) => j === i ? { rotulo: e.target.value, valor: x.valor || slug(e.target.value) } : x))} />
          <Button size="icon" variant="ghost" className="text-slate-400 hover:text-rose-600" onClick={() => onChange(lista.filter((_, j) => j !== i))}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={() => onChange([...lista, { valor: '', rotulo: '' }])}>
        <Plus className="mr-1 h-4 w-4" />Adicionar etapa
      </Button>
    </div>
  );
}

export default function ConfiguracaoFluxosAgenda({ aberto, onFechar, onSalvo }) {
  const [categoria, setCategoria] = useState('tarefa');
  const [configs, setConfigs] = useState({});
  const [registros, setRegistros] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    (async () => {
      setCarregando(true);
      const lista = await base44.entities.AgendaFluxoConfig.list();
      setRegistros(lista);
      const mapa = {};
      CATEGORIAS.forEach(([valor]) => {
        const salvo = lista.find(c => c.categoria === valor);
        mapa[valor] = salvo?.etapas?.length
          ? { etapas: salvo.etapas, finais: salvo.finais || doPadrao(valor).finais }
          : doPadrao(valor);
      });
      setConfigs(mapa);
      setCarregando(false);
    })();
  }, [aberto]);

  const atual = configs[categoria] || { etapas: [], finais: [] };
  const alterar = (campo, lista) => setConfigs(c => ({ ...c, [categoria]: { ...c[categoria], [campo]: lista } }));

  const salvar = async () => {
    const limpar = lista => lista.filter(e => e.rotulo?.trim()).map(e => ({ rotulo: e.rotulo.trim(), valor: e.valor || slug(e.rotulo) }));
    const etapas = limpar(atual.etapas);
    const finais = limpar(atual.finais);
    if (!etapas.length) return toast.error('Informe ao menos uma etapa');
    setSalvando(true);
    try {
      const existente = registros.find(r => r.categoria === categoria);
      const dados = { categoria, etapas, finais, ativo: true };
      if (existente) await base44.entities.AgendaFluxoConfig.update(existente.id, dados);
      else setRegistros([...registros, await base44.entities.AgendaFluxoConfig.create(dados)]);
      aplicarFluxosPersonalizados([dados]);
      toast.success('Fluxo atualizado');
      onSalvo?.();
    } catch (e) { console.error('[FLUXO CONFIG]', e); toast.error('Não foi possível salvar'); }
    finally { setSalvando(false); }
  };

  return (
    <Dialog open={aberto} onOpenChange={v => !v && onFechar?.()}>
      <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>Etapas por categoria</DialogTitle></DialogHeader>

        <div className="flex flex-wrap gap-1.5">
          {CATEGORIAS.map(([valor, rotulo]) => (
            <button key={valor} onClick={() => setCategoria(valor)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${categoria === valor ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
              {rotulo}
            </button>
          ))}
        </div>

        {carregando ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div> : (
          <div className="space-y-5">
            <ListaEtapas titulo="Etapas do fluxo" lista={atual.etapas} onChange={l => alterar('etapas', l)} />
            <ListaEtapas titulo="Encerramentos" lista={atual.finais} onChange={l => alterar('finais', l)} />
            <Button size="sm" variant="ghost" className="text-slate-500" onClick={() => setConfigs(c => ({ ...c, [categoria]: doPadrao(categoria) }))}>
              <RotateCcw className="mr-1 h-4 w-4" />Restaurar padrão
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onFechar} disabled={salvando}>Fechar</Button>
          <Button onClick={salvar} disabled={salvando || carregando} className="bg-slate-900 text-white">
            {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
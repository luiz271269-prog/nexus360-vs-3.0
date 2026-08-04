import React from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ListTodo, Loader2 } from 'lucide-react';
import NovaTarefaCampos from './NovaTarefaCampos';
import useNovaTarefa from './useNovaTarefa';

export default function NovaTarefaDialog({ aberto, onFechar, contexto = {}, onCriado }) {
  const fluxo = useNovaTarefa(aberto, contexto, onCriado, onFechar);
  return <Dialog open={aberto} onOpenChange={v => !v && onFechar?.()}>
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle className="flex items-center gap-2"><ListTodo className="w-5 h-5" />Nova tarefa</DialogTitle></DialogHeader>
      <NovaTarefaCampos form={fluxo.form} alterar={fluxo.alterar} usuario={fluxo.usuario} usuarios={fluxo.usuarios} />
      <DialogFooter><Button variant="ghost" onClick={onFechar} disabled={fluxo.salvando}>Cancelar</Button><Button onClick={fluxo.salvar} disabled={fluxo.salvando} className="bg-slate-900 text-white">{fluxo.salvando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ListTodo className="w-4 h-4 mr-2" />}Criar tarefa</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
import React from 'react';
import AgendaSecao from './AgendaSecao';
import { CATEGORIAS, categoriaDoItem } from './agendaFluxos';
import { ordenar } from './agendaModel';

const CORES = {
  solicitacao: 'text-sky-300', tarefa: 'text-violet-300', agendamento: 'text-indigo-300',
  lembrete: 'text-amber-300', retorno: 'text-emerald-300'
};

export default function AgendaPorTipo({ itens, ...acoes }) {
  return (
    <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
      {CATEGORIAS.map(([valor, rotulo]) => (
        <AgendaSecao key={valor} titulo={rotulo} cor={CORES[valor]}
          itens={ordenar(itens.filter(i => categoriaDoItem(i) === valor))} {...acoes} />
      ))}
    </div>
  );
}
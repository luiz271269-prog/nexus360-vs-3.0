import React, { useState, useEffect } from 'react';
import NovoAgendamentoDialog from '@/components/agenda/NovoAgendamentoDialog';
import NovaTarefaDialog from '@/components/agenda/NovaTarefaDialog';

export default function AgendamentoGlobal() {
  const [eventoAberto, setEventoAberto] = useState(false);
  const [tarefaAberta, setTarefaAberta] = useState(false);
  const [contexto, setContexto] = useState({});

  useEffect(() => {
    const abrirEvento = e => { setContexto(e.detail || {}); setEventoAberto(true); };
    const abrirTarefa = e => { setContexto(e.detail || {}); setTarefaAberta(true); };
    window.addEventListener('nexus:novo-agendamento', abrirEvento);
    window.addEventListener('nexus:nova-tarefa', abrirTarefa);
    return () => {
      window.removeEventListener('nexus:novo-agendamento', abrirEvento);
      window.removeEventListener('nexus:nova-tarefa', abrirTarefa);
    };
  }, []);

  return <>
    <NovoAgendamentoDialog aberto={eventoAberto} contexto={contexto} onFechar={() => setEventoAberto(false)} />
    <NovaTarefaDialog aberto={tarefaAberta} contexto={contexto} onFechar={() => setTarefaAberta(false)} />
  </>;
}
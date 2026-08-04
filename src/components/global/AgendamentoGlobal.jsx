import React, { useState, useEffect } from 'react';
import NovoAgendamentoDialog from '@/components/agenda/NovoAgendamentoDialog';
import NovaTarefaDialog from '@/components/agenda/NovaTarefaDialog';
import EscolherAgendamentoDialog from '@/components/agenda/EscolherAgendamentoDialog';

export default function AgendamentoGlobal() {
  const [eventoAberto, setEventoAberto] = useState(false);
  const [tarefaAberta, setTarefaAberta] = useState(false);
  const [escolhaAberta, setEscolhaAberta] = useState(false);
  const [contexto, setContexto] = useState({});

  useEffect(() => {
    const abrirEvento = e => { setContexto(e.detail || {}); setEventoAberto(true); };
    const abrirTarefa = e => { setContexto(e.detail || {}); setTarefaAberta(true); };
    const abrirRetorno = e => { setContexto(e.detail || {}); setEscolhaAberta(true); };
    window.addEventListener('nexus:novo-agendamento', abrirEvento);
    window.addEventListener('nexus:nova-tarefa', abrirTarefa);
    window.addEventListener('nexus:agendar-retorno', abrirRetorno);
    return () => {
      window.removeEventListener('nexus:novo-agendamento', abrirEvento);
      window.removeEventListener('nexus:nova-tarefa', abrirTarefa);
      window.removeEventListener('nexus:agendar-retorno', abrirRetorno);
    };
  }, []);

  const escolher = tipo => {
    setEscolhaAberta(false);
    if (tipo === 'evento') setEventoAberto(true);
    else setTarefaAberta(true);
  };

  return <>
    <EscolherAgendamentoDialog aberto={escolhaAberta} onFechar={() => setEscolhaAberta(false)} onEscolher={escolher} />
    <NovoAgendamentoDialog aberto={eventoAberto} contexto={contexto} onFechar={() => setEventoAberto(false)} />
    <NovaTarefaDialog aberto={tarefaAberta} contexto={contexto} onFechar={() => setTarefaAberta(false)} />
  </>;
}
import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CalendarCheck, RefreshCw, Loader2, Settings, MessageSquare, Inbox, Plus, ListTodo } from 'lucide-react';
import useAgendaUnificada from '@/components/agenda/useAgendaUnificada';
import { agruparPorFaixa, resumo as calcularResumo, diasDeAtraso } from '@/components/agenda/agendaModel';
import AgendaKPIs from '@/components/agenda/AgendaKPIs';
import AgendaSecao from '@/components/agenda/AgendaSecao';
import ConfiguracaoSincronizacao from '@/components/agenda/ConfiguracaoSincronizacao';

const concluida = i => ['concluida', 'completed'].includes(i.status);
const FILTROS = {
  hoje: i => !concluida(i) && i.quando && diasDeAtraso(i) === 0,
  atrasados: i => !concluida(i) && diasDeAtraso(i) > 0,
  compromissos: i => i.tipo === 'evento' && !concluida(i),
  aguardando: i => i.status === 'aguardando_terceiro',
  concluidas: concluida
};

export default function Agenda() {
  const [usuario, setUsuario] = useState(null);
  const [filtro, setFiltro] = useState(null);
  const [configAberta, setConfigAberta] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUsuario).catch(() => setUsuario(null));
  }, []);

  const { itens, carregando, ocupadoId, recarregar, iniciar, aguardar, concluir, cancelar, adiar } = useAgendaUnificada(usuario);

  // Atualiza a lista quando um agendamento é criado em qualquer tela
  useEffect(() => {
    const handler = () => recarregar();
    window.addEventListener('nexus:agendamento-criado', handler);
    return () => window.removeEventListener('nexus:agendamento-criado', handler);
  }, [recarregar]);

  const visiveis = useMemo(
    () => (filtro ? itens.filter(FILTROS[filtro]) : itens),
    [itens, filtro]
  );
  const faixas = useMemo(() => agruparPorFaixa(visiveis), [visiveis]);
  const resumo = useMemo(() => calcularResumo(itens), [itens]);

  const vazio = !carregando && visiveis.length === 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center flex-shrink-0">
              <CalendarCheck className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg md:text-xl font-bold text-slate-900 leading-tight">Meu dia</h1>
              <p className="text-xs text-slate-500 truncate">
                {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setConfigAberta(true)} title="Sincronização de calendários">
              <Settings className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={recarregar} disabled={carregando}>
              {carregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
            <Button asChild variant="outline" size="sm" className="hidden md:inline-flex">
              <a href="/Comunicacao"><MessageSquare className="w-4 h-4 mr-2" />Por chat</a>
            </Button>
            <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white" onClick={() => window.dispatchEvent(new CustomEvent('nexus:nova-tarefa'))}>
              <ListTodo className="w-4 h-4 mr-2" />Nova tarefa
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.dispatchEvent(new CustomEvent('nexus:novo-agendamento'))} title="Novo evento">
              <Plus className="w-4 h-4 md:mr-2" /><span className="hidden md:inline">Novo evento</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-6">
        <AgendaKPIs resumo={resumo} filtro={filtro} onFiltrar={setFiltro} />

        {carregando && (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}

        {vazio && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
            <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-700">
              {filtro ? 'Nada neste filtro' : 'Agenda limpa'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {filtro ? 'Toque no cartão novamente para ver tudo.' : 'Crie uma tarefa ou evento para organizar seu dia.'}
            </p>
          </div>
        )}

        {!carregando && (
          <div className="space-y-7">
            <AgendaSecao titulo="Atrasadas" itens={faixas.atrasados} cor="text-rose-600"
              ocupadoId={ocupadoId} onIniciar={iniciar} onAguardar={aguardar} onConcluir={concluir} onAdiar={adiar} onCancelar={cancelar} />
            <AgendaSecao titulo="Hoje" itens={faixas.hoje} cor="text-violet-700"
              ocupadoId={ocupadoId} onIniciar={iniciar} onAguardar={aguardar} onConcluir={concluir} onAdiar={adiar} onCancelar={cancelar} />
            <AgendaSecao titulo="Próximas" itens={faixas.proximos} cor="text-sky-700"
              ocupadoId={ocupadoId} onIniciar={iniciar} onAguardar={aguardar} onConcluir={concluir} onAdiar={adiar} onCancelar={cancelar} />
            <AgendaSecao titulo="Sem horário" itens={faixas.semHorario} cor="text-slate-500"
              ocupadoId={ocupadoId} onIniciar={iniciar} onAguardar={aguardar} onConcluir={concluir} onAdiar={adiar} onCancelar={cancelar} />
            <AgendaSecao titulo="Concluídas" itens={faixas.concluidas} cor="text-emerald-700" recolhida
              ocupadoId={ocupadoId} onIniciar={iniciar} onAguardar={aguardar} onConcluir={concluir} onAdiar={adiar} onCancelar={cancelar} />
          </div>
        )}
      </main>

      <Dialog open={configAberta} onOpenChange={setConfigAberta}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sincronização de calendários</DialogTitle>
          </DialogHeader>
          <ConfiguracaoSincronizacao usuario={usuario} onUpdate={recarregar} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
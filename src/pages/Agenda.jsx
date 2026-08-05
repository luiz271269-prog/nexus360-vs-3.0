import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CalendarCheck, RefreshCw, Loader2, Settings, MessageSquare, Plus, ListTodo, SlidersHorizontal } from 'lucide-react';
import useAgendaUnificada from '@/components/agenda/useAgendaUnificada';
import { agruparPorFaixa, resumo as calcularResumo, diasDeAtraso } from '@/components/agenda/agendaModel';
import AgendaKPIs from '@/components/agenda/AgendaKPIs';
import AgendaSecao from '@/components/agenda/AgendaSecao';
import AgendaPorTipo from '@/components/agenda/AgendaPorTipo';
import AgendaFluxoKanban from '@/components/agenda/AgendaFluxoKanban';
import AgendaDetalhePanel from '@/components/agenda/AgendaDetalhePanel';
import ConfiguracaoSincronizacao from '@/components/agenda/ConfiguracaoSincronizacao';
import ConfiguracaoFluxosAgenda from '@/components/agenda/ConfiguracaoFluxosAgenda';
import { aplicarFluxosPersonalizados } from '@/components/agenda/agendaFluxos';
import AgendaUsuarioFiltro from '@/components/agenda/AgendaUsuarioFiltro';
import RevisaoDiariaObrigatoria, { revisaoJaFeitaHoje } from '@/components/agenda/RevisaoDiariaObrigatoria';
import BarraComandoAgenda from '@/components/agenda/BarraComandoAgenda';

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
  const [modo, setModo] = useState('fluxo');
  const [detalhe, setDetalhe] = useState(null);
  const [fluxosAberto, setFluxosAberto] = useState(false);
  const [versaoFluxos, setVersaoFluxos] = useState(0);
  const [alvoUsuario, setAlvoUsuario] = useState('me');
  const [revisaoAberta, setRevisaoAberta] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUsuario).catch(() => setUsuario(null));
    base44.entities.AgendaFluxoConfig.list()
      .then(cfgs => { aplicarFluxosPersonalizados(cfgs); setVersaoFluxos(v => v + 1); })
      .catch(() => {});
  }, []);

  const { itens, carregando, ocupadoId, recarregar, iniciar, aguardar, concluir, cancelar, adiar } = useAgendaUnificada(usuario, alvoUsuario);

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
  // Abrir item direto ao tocar na notificação push (/Agenda?item=<id>)
  useEffect(() => {
    const alvo = new URLSearchParams(window.location.search).get('item');
    if (!alvo || !itens.length) return;
    const item = itens.find(i => i.id === alvo);
    if (item) setDetalhe(item);
  }, [itens]);

  // Revisão obrigatória: abre 1x por dia quando existem itens vencidos/vencendo hoje
  useEffect(() => {
    if (carregando || !usuario?.id || alvoUsuario !== 'me') return;
    if (revisaoJaFeitaHoje(usuario.id)) return;
    if (itens.some(i => FILTROS.hoje(i) || FILTROS.atrasados(i))) setRevisaoAberta(true);
  }, [carregando, usuario, itens, alvoUsuario]);

  const faixas = useMemo(() => agruparPorFaixa(visiveis), [visiveis]);
  const resumo = useMemo(() => calcularResumo(itens), [itens]);

  const vazio = !carregando && visiveis.length === 0;

  return (
    <div
      className="min-h-screen bg-agenda-backdrop bg-cover bg-center bg-fixed text-agenda-text"
      style={{ backgroundImage: "url('https://media.base44.com/images/public/68a7d067890527304dbe8477/c1f3df29e_generated_image.png')" }}
    >
      <header className="sticky top-0 z-20 border-b border-agenda-border bg-agenda-backdrop/75 backdrop-blur-2xl">
        <div className="flex w-full items-center justify-between gap-3 px-4 py-3 md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-agenda-border bg-agenda-panel/80 shadow-lg shadow-violet-950/40">
              <CalendarCheck className="h-5 w-5 text-agenda-accent" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold leading-tight text-agenda-text md:text-xl">
                {alvoUsuario === 'all' ? 'Agenda geral' : alvoUsuario === 'me' ? 'Meu dia' : 'Agenda do usuário'}
              </h1>
              <p className="truncate text-xs text-agenda-muted">
                {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden overflow-hidden rounded-lg border border-agenda-border md:flex">
              {[['dia', 'Meu dia'], ['tipo', 'Por tipo'], ['fluxo', 'Fluxo']].map(([valor, rotulo]) => (
                <button key={valor} onClick={() => setModo(valor)} className={`px-3 py-1.5 text-xs font-semibold transition-colors ${modo === valor ? 'bg-agenda-accent text-agenda-text' : 'bg-agenda-panel/40 text-agenda-muted hover:text-agenda-text'}`}>{rotulo}</button>
              ))}
            </div>
            {usuario?.role === 'admin' && (
              <AgendaUsuarioFiltro valor={alvoUsuario} onChange={setAlvoUsuario} />
            )}
            {usuario?.role === 'admin' && (
              <Button variant="ghost" size="icon" className="border border-agenda-border bg-agenda-panel/40 text-agenda-muted hover:bg-agenda-panel hover:text-agenda-text" onClick={() => setFluxosAberto(true)} title="Configurar etapas dos fluxos">
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="border border-agenda-border bg-agenda-panel/40 text-agenda-muted hover:bg-agenda-panel hover:text-agenda-text" onClick={() => setConfigAberta(true)} title="Sincronização de calendários">
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="border border-agenda-border bg-agenda-panel/40 text-agenda-muted hover:bg-agenda-panel hover:text-agenda-text" onClick={recarregar} disabled={carregando}>
              {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
            <Button asChild variant="ghost" size="sm" className="hidden border border-agenda-border bg-agenda-panel/40 text-agenda-text hover:bg-agenda-panel md:inline-flex">
              <a href="/Comunicacao"><MessageSquare className="mr-2 h-4 w-4" />Por chat</a>
            </Button>
            <Button size="sm" className="bg-agenda-accent text-agenda-text shadow-lg shadow-violet-700/30 hover:bg-agenda-accent-strong" onClick={() => window.dispatchEvent(new CustomEvent('nexus:nova-tarefa'))}>
              <ListTodo className="mr-2 h-4 w-4" />Nova tarefa
            </Button>
            <Button size="sm" variant="ghost" className="border border-agenda-border bg-agenda-panel/40 text-agenda-text hover:bg-agenda-panel" onClick={() => window.dispatchEvent(new CustomEvent('nexus:novo-agendamento'))} title="Novo evento">
              <Plus className="h-4 w-4 md:mr-2" /><span className="hidden md:inline">Novo evento</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="w-full space-y-6 px-4 py-5 md:px-8 md:py-6">
        <BarraComandoAgenda onCriado={recarregar} />

        <AgendaKPIs resumo={resumo} filtro={filtro} onFiltrar={setFiltro} />

        {carregando && (
          <div className="flex items-center justify-center rounded-2xl border border-agenda-border bg-agenda-panel/45 py-24 text-agenda-muted shadow-2xl backdrop-blur-xl">
            <Loader2 className="h-7 w-7 animate-spin" />
          </div>
        )}

        {vazio && (
          <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-agenda-border bg-agenda-panel/45 px-6 text-center shadow-2xl shadow-violet-950/30 backdrop-blur-2xl md:min-h-96">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-agenda-border bg-agenda-panel/60 shadow-lg shadow-violet-500/30">
              <CalendarCheck className="h-10 w-10 text-agenda-muted drop-shadow-[0_0_10px_rgba(196,181,253,0.8)]" />
            </div>
            <p className="text-lg font-medium text-agenda-text">
              {filtro ? 'Nada neste filtro' : 'Agenda limpa'}
            </p>
            <p className="mt-1 text-xs text-agenda-muted">
              {filtro ? 'Toque no cartão novamente para ver tudo.' : 'Crie uma tarefa ou evento para organizar seu dia.'}
            </p>
          </div>
        )}

        {!carregando && !vazio && modo === 'fluxo' && (
          <AgendaFluxoKanban key={versaoFluxos} itens={visiveis} onAbrir={setDetalhe} onAtualizado={recarregar} usuario={usuario} />
        )}

        {!carregando && !vazio && modo === 'tipo' && (
          <AgendaPorTipo itens={visiveis} ocupadoId={ocupadoId} onIniciar={iniciar} onAguardar={aguardar}
            onConcluir={concluir} onAdiar={adiar} onCancelar={cancelar} onAbrir={setDetalhe} />
        )}

        {!carregando && !vazio && modo === 'dia' && (
          <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {[['Atrasadas', faixas.atrasados, 'text-rose-400', false], ['Hoje', faixas.hoje, 'text-violet-300', false], ['Próximas', faixas.proximos, 'text-sky-300', false], ['Sem horário', faixas.semHorario, 'text-slate-300', false], ['Concluídas', faixas.concluidas, 'text-emerald-300', true]].map(([titulo, lista, cor, recolhida]) => (
              <AgendaSecao key={titulo} titulo={titulo} itens={lista} cor={cor} recolhida={recolhida}
                ocupadoId={ocupadoId} onIniciar={iniciar} onAguardar={aguardar} onConcluir={concluir} onAdiar={adiar} onCancelar={cancelar} onAbrir={setDetalhe} />
            ))}
          </div>
        )}

        {detalhe && <AgendaDetalhePanel item={detalhe} onFechar={() => setDetalhe(null)} onAtualizado={recarregar} />}
      </main>

      {revisaoAberta && (
        <RevisaoDiariaObrigatoria itens={itens} usuario={usuario} ocupadoId={ocupadoId}
          onConcluir={concluir} onAdiar={adiar} onFechar={() => setRevisaoAberta(false)} />
      )}

      <ConfiguracaoFluxosAgenda aberto={fluxosAberto} onFechar={() => setFluxosAberto(false)} onSalvo={() => setVersaoFluxos(v => v + 1)} />

      <Dialog open={configAberta} onOpenChange={setConfigAberta}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto border-agenda-border bg-agenda-backdrop text-agenda-text">
          <DialogHeader>
            <DialogTitle>Sincronização de calendários</DialogTitle>
          </DialogHeader>
          <ConfiguracaoSincronizacao usuario={usuario} onUpdate={recarregar} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
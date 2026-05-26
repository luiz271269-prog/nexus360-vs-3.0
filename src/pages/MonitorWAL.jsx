import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Activity, AlertTriangle, CheckCircle2, Clock, RotateCw, Search, Send, Shield, XCircle
} from 'lucide-react';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  pending:    { color: 'bg-amber-100 text-amber-800 border-amber-300',  icon: Clock,        label: 'Pendente' },
  processing: { color: 'bg-blue-100 text-blue-800 border-blue-300',     icon: RotateCw,     label: 'Processando' },
  processed:  { color: 'bg-green-100 text-green-800 border-green-300',  icon: CheckCircle2, label: 'Processada' },
  failed:     { color: 'bg-red-100 text-red-800 border-red-300',        icon: XCircle,      label: 'Falhou' },
  expired:    { color: 'bg-slate-100 text-slate-700 border-slate-300',  icon: AlertTriangle, label: 'Expirada' }
};

export default function MonitorWAL() {
  const queryClient = useQueryClient();
  const [statusFiltro, setStatusFiltro] = useState('pending');

  const { data: usuario } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 5 * 60_000
  });

  const { data: wals = [], isLoading } = useQuery({
    queryKey: ['wal-list', statusFiltro],
    queryFn: () => base44.entities.WebhookInboundWAL.filter(
      { status: statusFiltro }, '-created_date', 100
    ),
    refetchInterval: 30_000,
    refetchOnWindowFocus: false
  });

  const { data: contadores = {} } = useQuery({
    queryKey: ['wal-contadores'],
    queryFn: async () => {
      const todos = await base44.entities.WebhookInboundWAL.list('-created_date', 1000);
      return todos.reduce((acc, w) => {
        acc[w.status] = (acc[w.status] || 0) + 1;
        return acc;
      }, {});
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: false
  });

  const reprocessarLote = useMutation({
    mutationFn: () => base44.functions.invoke('reprocessarWebhookWAL', { limit: 50 }),
    onSuccess: (res) => {
      const r = res?.data?.resultados;
      toast.success(`Reprocessamento: ${r?.processed || 0} OK, ${r?.retry || 0} retry, ${r?.failed || 0} falhou`);
      queryClient.invalidateQueries({ queryKey: ['wal-list'] });
      queryClient.invalidateQueries({ queryKey: ['wal-contadores'] });
    },
    onError: (e) => toast.error(`Erro: ${e.message}`)
  });

  const verificarPerdas = useMutation({
    mutationFn: (action) => base44.functions.invoke('verificarPerdasReceived', { horas: 24, action }),
    onSuccess: (res) => {
      const d = res?.data;
      if (d?.action === 'inject_wal') {
        toast.success(`Varredura: ${d.total_orfas} órfãs encontradas, ${d.wals_injetadas} injetadas no WAL`);
      } else {
        toast.success(`Varredura: ${d?.total_orfas || 0} órfãs encontradas em ${d?.total_audits || 0} audits`);
      }
      queryClient.invalidateQueries({ queryKey: ['wal-list'] });
      queryClient.invalidateQueries({ queryKey: ['wal-contadores'] });
    },
    onError: (e) => toast.error(`Erro varredura: ${e.message}`)
  });

  if (usuario && usuario.role !== 'admin') {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6 flex items-center gap-3">
            <Shield className="w-8 h-8 text-red-600" />
            <div>
              <h3 className="font-semibold text-red-900">Acesso restrito</h3>
              <p className="text-sm text-red-700">Apenas administradores podem acessar o Monitor WAL.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6 text-indigo-600" />
            Monitor WAL — Recuperação de Webhooks
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Write-Ahead Log de mensagens inbound. Garantia de recuperação contra perdas por 429.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => verificarPerdas.mutate('list')}
            disabled={verificarPerdas.isPending}
          >
            <Search className="w-4 h-4 mr-2" />
            {verificarPerdas.isPending ? 'Verificando...' : 'Varrer perdas (24h)'}
          </Button>
          <Button
            variant="outline"
            className="border-amber-400 text-amber-700 hover:bg-amber-50"
            onClick={() => verificarPerdas.mutate('inject_wal')}
            disabled={verificarPerdas.isPending}
          >
            <Send className="w-4 h-4 mr-2" />
            Injetar órfãs no WAL
          </Button>
          <Button
            onClick={() => reprocessarLote.mutate()}
            disabled={reprocessarLote.isPending}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            <RotateCw className={`w-4 h-4 mr-2 ${reprocessarLote.isPending ? 'animate-spin' : ''}`} />
            {reprocessarLote.isPending ? 'Reprocessando...' : 'Reprocessar 50 pendentes'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
          const Icon = cfg.icon;
          const ativo = statusFiltro === key;
          return (
            <button
              key={key}
              onClick={() => setStatusFiltro(key)}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                ativo ? cfg.color + ' ring-2 ring-offset-1 ring-indigo-400' : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4" />
                <span className="text-xs font-medium">{cfg.label}</span>
              </div>
              <div className="text-2xl font-bold mt-1">{contadores[key] || 0}</div>
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Badge className={STATUS_CONFIG[statusFiltro].color}>{STATUS_CONFIG[statusFiltro].label}</Badge>
            <span className="text-slate-600">— últimas {wals.length} entradas</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-center text-slate-500">Carregando...</div>
          ) : wals.length === 0 ? (
            <div className="p-6 text-center text-slate-500">Nenhum registro nesse status.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provedor</TableHead>
                    <TableHead>Message ID</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Evento</TableHead>
                    <TableHead className="text-center">Tentativas</TableHead>
                    <TableHead>Próxima</TableHead>
                    <TableHead>Erro</TableHead>
                    <TableHead>Criado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wals.map(w => (
                    <TableRow key={w.id}>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {w.provider}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {w.message_id ? w.message_id.substring(0, 16) + '...' : '—'}
                      </TableCell>
                      <TableCell className="text-sm">{w.telefone_origem || '—'}</TableCell>
                      <TableCell className="text-xs">{w.evento_tipo || '—'}</TableCell>
                      <TableCell className="text-center">
                        <span className={w.tentativas >= (w.max_tentativas || 5) ? 'text-red-600 font-bold' : ''}>
                          {w.tentativas || 0}/{w.max_tentativas || 5}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">
                        {w.next_attempt_at ? new Date(w.next_attempt_at).toLocaleString('pt-BR') : '—'}
                      </TableCell>
                      <TableCell className="text-xs max-w-xs truncate text-red-600">
                        {w.erro_ultimo || '—'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {new Date(w.created_date).toLocaleString('pt-BR')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="p-4 text-xs text-slate-600 space-y-1">
          <div className="font-semibold text-slate-700 mb-2">Como funciona:</div>
          <div>• <b>pending</b> → aguardando worker (próxima tentativa via backoff exponencial)</div>
          <div>• <b>processing</b> → worker em andamento (deve sair desse status em segundos)</div>
          <div>• <b>processed</b> → Message criada com sucesso (recuperação OK)</div>
          <div>• <b>failed</b> → excedeu max_tentativas (5) — requer investigação manual</div>
          <div>• <b>Varrer perdas</b> → cruza audits ReceivedCallback × Message para achar órfãs</div>
        </CardContent>
      </Card>
    </div>
  );
}
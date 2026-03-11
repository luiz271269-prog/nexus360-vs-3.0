import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, Trash2, RefreshCw, TrendingUp, FileText, Users } from 'lucide-react';
import { toast } from 'sonner';
import KanbanLeadsColumn from '@/components/crm/KanbanLeadsColumn';
import KanbanClientesColumn from '@/components/crm/KanbanClientesColumn';
import KanbanOrcamentosColumn from '@/components/crm/KanbanOrcamentosColumn';

const STATUS_LEADS = [
  { id: 'novo_lead', label: '🆕 Novo Lead', status: 'novo_lead' },
  { id: 'primeiro_contato', label: '📞 Primeiro Contato', status: 'primeiro_contato' },
  { id: 'em_conversa', label: '💬 Em Conversa', status: 'em_conversa' },
  { id: 'lead_qualificado', label: '✅ Qualificado', status: 'lead_qualificado' },
  { id: 'desqualificado', label: '❌ Desqualificado', status: 'desqualificado' }
];

const STATUS_CLIENTES = [
  { id: 'novo_lead', label: '🆕 Novo Lead', status: 'novo_lead' },
  { id: 'em_conversa', label: '💬 Em Conversa', status: 'em_conversa' },
  { id: 'lead_qualificado', label: '⭐ Qualificado', status: 'lead_qualificado' },
  { id: 'cliente_ativo', label: '🎯 Cliente Ativo', status: 'cliente_ativo' }
];

const STATUS_ORCAMENTOS = [
  { id: 'rascunho', label: '📝 Rascunho', status: 'rascunho' },
  { id: 'enviado', label: '📤 Enviado', status: 'enviado' },
  { id: 'negociando', label: '💬 Negociando', status: 'negociando' },
  { id: 'aprovado', label: '✅ Aprovado', status: 'aprovado' },
  { id: 'rejeitado', label: '❌ Rejeitado', status: 'rejeitado' }
];

export default function LeadsQualificados() {
  const [usuario, setUsuario] = useState(null);
  const [aba, setAba] = useState('leads');
  const [limpando, setLimpando] = useState(false);

  useEffect(() => {
    const carregarUsuario = async () => {
      try {
        const user = await base44.auth.me();
        setUsuario(user);
      } catch (error) {
        console.error('Erro ao carregar usuário:', error);
      }
    };
    carregarUsuario();
  }, []);

  // LEADS
  const { data: leads, isLoading: loadingLeads, refetch: refetchLeads } = useQuery({
    queryKey: ['crm_leads'],
    queryFn: async () => {
      const clientes = await base44.entities.Cliente.list('-created_date', 500);
      return clientes.filter(c => ['novo_lead', 'primeiro_contato', 'em_conversa', 'lead_qualificado', 'desqualificado'].includes(c.status));
    }
  });

  // CLIENTES
  const { data: clientes, isLoading: loadingClientes, refetch: refetchClientes } = useQuery({
    queryKey: ['crm_clientes'],
    queryFn: async () => {
      const all = await base44.entities.Cliente.list('-created_date', 500);
      return all.filter(c => ['cliente_ativo', 'Ativo'].includes(c.status));
    }
  });

  // ORÇAMENTOS
  const { data: orcamentos, isLoading: loadingOrcamentos, refetch: refetchOrcamentos } = useQuery({
    queryKey: ['crm_orcamentos'],
    queryFn: async () => {
      return await base44.entities.Orcamento.list('-data_orcamento', 500);
    }
  });

  // Função para limpar dados
  const handleLimparBD = async () => {
    setLimpando(true);
    try {
      // Deletar leads
      const allClientes = await base44.entities.Cliente.list();
      for (const cliente of allClientes) {
        try {
          await base44.entities.Cliente.delete(cliente.id);
        } catch (err) {
          console.warn('Erro ao deletar cliente:', err);
        }
      }

      // Deletar orçamentos
      const allOrcamentos = await base44.entities.Orcamento.list();
      for (const orc of allOrcamentos) {
        try {
          await base44.entities.Orcamento.delete(orc.id);
        } catch (err) {
          console.warn('Erro ao deletar orçamento:', err);
        }
      }

      toast.success('Base de dados limpa com sucesso! Pronto para começar.');
      refetchLeads();
      refetchClientes();
      refetchOrcamentos();
    } catch (error) {
      toast.error('Erro ao limpar base de dados: ' + error.message);
    } finally {
      setLimpando(false);
    }
  };

  // Handler para drag and drop
  const handleDragEnd = async (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    try {
      const novoStatus = destination.droppableId;
      
      if (aba === 'leads' || aba === 'clientes') {
        await base44.entities.Cliente.update(draggableId, { status: novoStatus });
        refetchLeads();
        refetchClientes();
      } else if (aba === 'orcamentos') {
        await base44.entities.Orcamento.update(draggableId, { status: novoStatus });
        refetchOrcamentos();
      }
    } catch (error) {
      toast.error('Erro ao atualizar: ' + error.message);
    }
  };

  const loadingAba = aba === 'leads' ? loadingLeads : aba === 'clientes' ? loadingClientes : loadingOrcamentos;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-blue-600" />
            CRM - Funil de Vendas
          </h1>
          <p className="text-slate-600 mt-1">
            Central de Qualificação: Leads → Clientes → Orçamentos
          </p>
        </div>

        <div className="flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={limpando}>
                <Trash2 className="w-4 h-4 mr-2" />
                Limpar BD
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>⚠️ Limpar Base de Dados</AlertDialogTitle>
                <AlertDialogDescription>
                  Isto vai deletar TODOS os Clientes e Orçamentos. Esta ação é irreversível. Tem certeza?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="flex gap-3">
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleLimparBD}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Sim, Limpar
                </AlertDialogAction>
              </div>
            </AlertDialogContent>
          </AlertDialog>

          <Button 
            onClick={() => {
              refetchLeads();
              refetchClientes();
              refetchOrcamentos();
            }}
            variant="outline"
            size="sm"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Métricas Rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-blue-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Leads em Qualificação</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">{leads?.length || 0}</p>
              </div>
              <Users className="w-10 h-10 text-blue-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-green-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Clientes Ativos</p>
                <p className="text-3xl font-bold text-green-600 mt-2">{clientes?.length || 0}</p>
              </div>
              <Users className="w-10 h-10 text-green-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-orange-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Orçamentos em Aberto</p>
                <p className="text-3xl font-bold text-orange-600 mt-2">
                  {orcamentos?.filter(o => !['rejeitado'].includes(o.status)).length || 0}
                </p>
              </div>
              <FileText className="w-10 h-10 text-orange-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Kanban Tabs */}
      <Tabs value={aba} onValueChange={setAba} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="leads">
            <TrendingUp className="w-4 h-4 mr-2" />
            Leads
          </TabsTrigger>
          <TabsTrigger value="clientes">
            <Users className="w-4 h-4 mr-2" />
            Clientes
          </TabsTrigger>
          <TabsTrigger value="orcamentos">
            <FileText className="w-4 h-4 mr-2" />
            Orçamentos
          </TabsTrigger>
        </TabsList>

        {/* TAB: LEADS */}
        <TabsContent value="leads" className="space-y-4">
          {loadingLeads ? (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-96 bg-slate-100 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : (
            <DragDropContext onDragEnd={handleDragEnd}>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {STATUS_LEADS.map(status => (
                  <KanbanLeadsColumn
                    key={status.id}
                    status={status}
                    items={leads?.filter(l => l.status === status.status) || []}
                  />
                ))}
              </div>
            </DragDropContext>
          )}
        </TabsContent>

        {/* TAB: CLIENTES */}
        <TabsContent value="clientes" className="space-y-4">
          {loadingClientes ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-96 bg-slate-100 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : (
            <DragDropContext onDragEnd={handleDragEnd}>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {STATUS_CLIENTES.map(status => (
                  <KanbanClientesColumn
                    key={status.id}
                    status={status}
                    items={clientes?.filter(c => c.status === status.status) || []}
                  />
                ))}
              </div>
            </DragDropContext>
          )}
        </TabsContent>

        {/* TAB: ORÇAMENTOS */}
        <TabsContent value="orcamentos" className="space-y-4">
          {loadingOrcamentos ? (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-96 bg-slate-100 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : (
            <DragDropContext onDragEnd={handleDragEnd}>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {STATUS_ORCAMENTOS.map(status => (
                  <KanbanOrcamentosColumn
                    key={status.id}
                    status={status}
                    items={orcamentos?.filter(o => o.status === status.status) || []}
                  />
                ))}
              </div>
            </DragDropContext>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
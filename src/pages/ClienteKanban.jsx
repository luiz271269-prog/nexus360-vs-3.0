import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DragDropContext, 
  Droppable, 
  Draggable 
} from '@hello-pangea/dnd';
import { 
  Plus, 
  Users, 
  Zap, 
  Filter,
  AlertCircle 
} from 'lucide-react';
import ClienteKanbanColumn from '../components/clientes/ClienteKanbanColumn.js';

const COLUNAS = [
  { id: 'novo_lead', label: '🆕 Novo Lead', status: 'novo_lead', cor: 'bg-slate-100' },
  { id: 'primeiro_contato', label: '📞 Primeiro Contato', status: 'primeiro_contato', cor: 'bg-blue-100' },
  { id: 'em_conversa', label: '💬 Em Conversa', status: 'em_conversa', cor: 'bg-cyan-100' },
  { id: 'lead_qualificado', label: '✅ Lead Qualificado', status: 'lead_qualificado', cor: 'bg-green-100' },
  { id: 'cliente_ativo', label: '🎯 Cliente Ativo', status: 'cliente_ativo', cor: 'bg-emerald-100' },
  { id: 'em_risco', label: '⚠️ Em Risco', status: 'Em Risco', cor: 'bg-orange-100' }
];

export default function ClienteKanban() {
  const [usuario, setUsuario] = useState(null);
  const [filtroVendedor, setFiltroVendedor] = useState(null);
  const [clientesPorStatus, setClientesPorStatus] = useState({});

  // Verificar se é usuário do setor comercial (vendas)
  useEffect(() => {
    const carregarUsuario = async () => {
      try {
        const user = await base44.auth.me();
        setUsuario(user);
        
        // Se é do setor vendas, filtrar por vendedor_responsavel = user.id
        if (user?.attendant_sector === 'vendas') {
          setFiltroVendedor(user.id);
        }
      } catch (error) {
        console.error('Erro ao carregar usuário:', error);
      }
    };
    carregarUsuario();
  }, []);

  // Buscar clientes
  const { data: clientes, isLoading, refetch } = useQuery({
    queryKey: ['cliente_kanban', filtroVendedor],
    queryFn: async () => {
      if (!usuario?.attendant_sector === 'vendas') {
        return [];
      }

      const allClientes = await base44.entities.Cliente.list('-created_date', 500);

      // Filtrar clientes do vendedor atual
      const clientesDoVendedor = allClientes.filter(c => {
        if (c.vendedor_id === usuario?.id) return true;
        // Ou sincronizar com contatos fidelizados do vendedor
        if (c.is_cliente_fidelizado) return true;
        return false;
      });

      return clientesDoVendedor;
    },
    enabled: !!usuario && usuario?.attendant_sector === 'vendas',
    refetchInterval: 30000 // Atualizar a cada 30s
  });

  // Agrupar clientes por status
  useEffect(() => {
    if (clientes) {
      const agrupado = {};
      COLUNAS.forEach(col => {
        agrupado[col.id] = clientes.filter(c => c.status === col.status);
      });
      setClientesPorStatus(agrupado);
    }
  }, [clientes]);

  // Handler para drag and drop
  const handleDragEnd = async (result) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const clienteId = draggableId;
    const novoStatus = COLUNAS.find(col => col.id === destination.droppableId)?.status;

    try {
      await base44.entities.Cliente.update(clienteId, { status: novoStatus });
      refetch();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
    }
  };

  // Verificar permissão
  if (usuario && usuario?.attendant_sector !== 'vendas') {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <Card className="border-l-4 border-orange-500 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-orange-900">Acesso Restrito</h3>
                <p className="text-sm text-orange-700 mt-1">Este Kanban é exclusivo para usuários do setor comercial (Vendas).</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-4">
        <div className="h-8 w-40 bg-slate-200 animate-pulse rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-96 bg-slate-100 animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const totalClientes = clientes?.length || 0;
  const clientesAtivos = clientesPorStatus['cliente_ativo']?.length || 0;
  const clientesEmRisco = clientesPorStatus['em_risco']?.length || 0;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-600" />
            Gestão de Clientes - Kanban
          </h1>
          <p className="text-slate-600 mt-1">
            Visualize e gerencie seus clientes por etapa
          </p>
        </div>
        
        <Button className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Novo Cliente
        </Button>
      </div>

      {/* Métricas Rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Total de Clientes</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">{totalClientes}</p>
              </div>
              <Users className="w-10 h-10 text-blue-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Clientes Ativos</p>
                <p className="text-3xl font-bold text-green-600 mt-2">{clientesAtivos}</p>
              </div>
              <Zap className="w-10 h-10 text-green-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Em Risco</p>
                <p className="text-3xl font-bold text-orange-600 mt-2">{clientesEmRisco}</p>
              </div>
              <AlertCircle className="w-10 h-10 text-orange-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {COLUNAS.map(coluna => (
            <ClienteKanbanColumn
              key={coluna.id}
              coluna={coluna}
              clientes={clientesPorStatus[coluna.id] || []}
              onClienteClick={(cliente) => {
                // TODO: Abrir modal ou navegar para detalhes
              }}
            />
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}
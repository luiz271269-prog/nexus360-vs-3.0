
import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Search,
  TrendingUp,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  BarChart3,
  Zap,
  Calendar,
  DollarSign,
  User,
  ChevronRight,
  RefreshCw,
  Loader2,
  Eye,
  Edit,
  Trash2,
  Download,
  Brain,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";
import OrcamentoKanban from "../components/orcamentos/OrcamentoKanban";
import OrcamentoTable from "../components/orcamentos/OrcamentoTable";
import ImportacaoCompletaOrcamento from "../components/importacao/ImportacaoCompletaOrcamento";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Orcamentos() {
  const [viewMode, setViewMode] = useState('kanban');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [mostrarImportacao, setMostrarImportacao] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: orcamentos = [], isLoading, refetch } = useQuery({
    queryKey: ['orcamentos'],
    queryFn: async () => {
      const data = await base44.entities.Orcamento.list();
      return data;
    },
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list(),
  });

  const { data: vendedores = [] } = useQuery({
    queryKey: ['vendedores'],
    queryFn: () => base44.entities.Vendedor.list(),
  });

  const metrics = {
    total: orcamentos.length,
    pendentes: orcamentos.filter(o => o.status === 'pendente').length,
    aprovados: orcamentos.filter(o => o.status === 'aprovado').length,
    cancelados: orcamentos.filter(o => o.status === 'cancelado').length,
    valorTotal: orcamentos.reduce((sum, o) => sum + (parseFloat(o.valor_total) || 0), 0),
  };

  const filteredOrcamentos = orcamentos.filter(orcamento => {
    const matchesSearch = searchTerm === '' || 
      orcamento.numero_orcamento?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      orcamento.nome_cliente?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || orcamento.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const handleDelete = async (id) => {
    if (!confirm('Tem certeza que deseja excluir este orçamento?')) return;
    
    try {
      await base44.entities.Orcamento.delete(id);
      toast.success('Orçamento excluído com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
    } catch (error) {
      toast.error('Erro ao excluir orçamento');
      console.error(error);
    }
  };

  const handleEdit = (orcamento) => {
    navigate(createPageUrl(`OrcamentoDetalhes?id=${orcamento.id}`));
  };

  const handleView = (orcamento) => {
    navigate(createPageUrl(`OrcamentoDetalhes?id=${orcamento.id}`));
  };

  const handleImportacaoCompleta = (dadosImportados) => {
    setMostrarImportacao(false);
    navigate(createPageUrl(`OrcamentoDetalhes?importacao=true`), {
      state: { dadosImportados }
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto mb-8">
        <Card className="bg-gradient-to-r from-slate-800 to-slate-900 border-slate-700 shadow-2xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <FileText className="w-8 h-8 text-white" />
                </div>
                <div>
                  <CardTitle className="text-3xl font-bold text-white">Pipeline de Orçamentos</CardTitle>
                  <p className="text-slate-400 mt-1">Gestão inteligente com insights de IA em tempo real</p>
                </div>
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg">
                    <Plus className="w-5 h-5 mr-2" />
                    Novo Orçamento
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>Criar Novo Orçamento</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate(createPageUrl("OrcamentoDetalhes"))}>
                    <Plus className="w-4 h-4 mr-2" />
                    Orçamento em Branco
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setMostrarImportacao(true)}
                    className="text-purple-600 focus:text-purple-700 focus:bg-purple-50"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Importar Proposta (IA)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-6">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-400 text-sm">Total</p>
                      <p className="text-2xl font-bold text-white">{metrics.total}</p>
                    </div>
                    <FileText className="w-8 h-8 text-blue-400" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-400 text-sm">Pendentes</p>
                      <p className="text-2xl font-bold text-yellow-400">{metrics.pendentes}</p>
                    </div>
                    <Clock className="w-8 h-8 text-yellow-400" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-400 text-sm">Aprovados</p>
                      <p className="text-2xl font-bold text-green-400">{metrics.aprovados}</p>
                    </div>
                    <CheckCircle className="w-8 h-8 text-green-400" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-400 text-sm">Cancelados</p>
                      <p className="text-2xl font-bold text-red-400">{metrics.cancelados}</p>
                    </div>
                    <XCircle className="w-8 h-8 text-red-400" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-emerald-600 to-green-700 border-emerald-500">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-emerald-100 text-sm">Valor Total</p>
                      <p className="text-2xl font-bold text-white">
                        R$ {metrics.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <DollarSign className="w-8 h-8 text-white" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardHeader>
        </Card>
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:w-80">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <Input
                    type="text"
                    placeholder="Buscar orçamento..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-slate-700 border-slate-600 text-white"
                  />
                </div>
                
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                >
                  <option value="all">Todos Status</option>
                  <option value="pendente">Pendentes</option>
                  <option value="aprovado">Aprovados</option>
                  <option value="cancelado">Cancelados</option>
                </select>
              </div>

              <div className="flex gap-2">
                <Button
                  variant={viewMode === 'kanban' ? 'default' : 'outline'}
                  onClick={() => setViewMode('kanban')}
                  className={viewMode === 'kanban' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Kanban
                </Button>
                <Button
                  variant={viewMode === 'table' ? 'default' : 'outline'}
                  onClick={() => setViewMode('table')}
                  className={viewMode === 'table' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Tabela
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
              </div>
            ) : viewMode === 'kanban' ? (
              <OrcamentoKanban
                orcamentos={filteredOrcamentos}
                onView={handleView}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ) : (
              <OrcamentoTable
                orcamentos={filteredOrcamentos}
                onView={handleView}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal de Importação Inteligente */}
      <ImportacaoCompletaOrcamento
        isOpen={mostrarImportacao}
        onClose={() => setMostrarImportacao(false)}
        onSuccess={handleImportacaoCompleta}
      />
    </div>
  );
}

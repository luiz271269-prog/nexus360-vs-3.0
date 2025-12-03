
import { useState } from "react"; // Added useEffect
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Shield,
  Download,
  Filter,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  User,
  Clock,
  RefreshCw
} from "lucide-react";
import { AuditLogger } from "../components/security/AuditLogger";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import PermissionGuard, { usePermissions, PERMISSIONS } from "../components/security/PermissionGuard";

export default function Auditoria() {
  return (
    <PermissionGuard permission="VIEW_AUDIT">
      <AuditoriaContent />
    </PermissionGuard>
  );
}

function AuditoriaContent() {
  const [filtros, setFiltros] = useState({
    usuario: '',
    acao: 'todas',
    entidade: 'todas',
    resultado: 'todos',
    busca: ''
  });

  const { hasPermission } = usePermissions();

  const { data: logsData, isLoading, refetch: carregarLogs } = useQuery({
    queryKey: ['auditLogs'],
    queryFn: async () => {
      try {
        // The original code called AuditLogger.getLogs({}, 200);
        const logs = await AuditLogger.getLogs({}, 200);
        return logs;
      } catch (error) {
        console.error("Erro ao carregar logs:", error);
        toast.error("Erro ao carregar logs de auditoria");
        throw error; // Re-throw to propagate the error state to useQuery
      }
    },
    staleTime: 5 * 60 * 1000, // Optional: Cache data for 5 minutes
    refetchOnWindowFocus: false, // Optional: Prevent refetching on window focus
  });

  // Ensure logs is an array, even when data is undefined (e.g., initially loading)
  const logs = logsData || [];

  const logsFiltrados = logs.filter(log => {
    if (filtros.usuario && !log.usuario_email.toLowerCase().includes(filtros.usuario.toLowerCase())) {
      return false;
    }
    if (filtros.acao !== 'todas' && log.acao !== filtros.acao) {
      return false;
    }
    if (filtros.entidade !== 'todas' && log.entidade_tipo !== filtros.entidade) {
      return false;
    }
    if (filtros.resultado !== 'todos' && log.resultado !== filtros.resultado) {
      return false;
    }
    if (filtros.busca) {
      const busca = filtros.busca.toLowerCase();
      return (
        log.entidade_nome?.toLowerCase().includes(busca) ||
        log.usuario_nome?.toLowerCase().includes(busca) ||
        log.acao.toLowerCase().includes(busca)
      );
    }
    return true;
  });

  const exportarLogs = () => {
    const csv = gerarCSV(logsFiltrados);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    toast.success("Logs exportados com sucesso");
  };

  const gerarCSV = (logs) => {
    const headers = ['Data/Hora', 'Usuário', 'Ação', 'Entidade', 'Item', 'Resultado'];
    const rows = logs.map(log => [
      format(new Date(log.created_date), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR }),
      log.usuario_nome,
      log.acao,
      log.entidade_tipo,
      log.entidade_nome || '-',
      log.resultado
    ]);
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header com Gradiente Laranja */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-xl border-2 border-slate-700/50 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-orange-500/50">
              <Shield className="w-9 h-9 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 bg-clip-text text-transparent">
                Auditoria
              </h1>
              <p className="text-slate-300 mt-1">
                Logs de atividades e rastreamento de ações
              </p>
            </div>
          </div>

          {/* Buttons for Refresh and Export */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="bg-white/10 text-white border-white/20 hover:bg-white/20"
              onClick={carregarLogs}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>

            <PermissionGuard permission={PERMISSIONS.AUDITORIA_EXPORTAR}>
              <Button
                variant="outline"
                className="bg-green-600 text-white border-green-500 hover:bg-green-700"
                onClick={exportarLogs}
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </PermissionGuard>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-indigo-600" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <Input
                placeholder="Buscar..."
                value={filtros.busca}
                onChange={(e) => setFiltros({ ...filtros, busca: e.target.value })}
                className="w-full"
              />
            </div>

            <div>
              <Input
                placeholder="Filtrar por usuário..."
                value={filtros.usuario}
                onChange={(e) => setFiltros({ ...filtros, usuario: e.target.value })}
              />
            </div>

            <Select value={filtros.acao} onValueChange={(value) => setFiltros({ ...filtros, acao: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as Ações</SelectItem>
                <SelectItem value="criar">Criar</SelectItem>
                <SelectItem value="editar">Editar</SelectItem>
                <SelectItem value="deletar">Deletar</SelectItem>
                <SelectItem value="visualizar">Visualizar</SelectItem>
                <SelectItem value="exportar">Exportar</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filtros.entidade} onValueChange={(value) => setFiltros({ ...filtros, entidade: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as Entidades</SelectItem>
                <SelectItem value="Cliente">Cliente</SelectItem>
                <SelectItem value="Venda">Venda</SelectItem>
                <SelectItem value="Orcamento">Orçamento</SelectItem>
                <SelectItem value="Produto">Produto</SelectItem>
                <SelectItem value="Configuracao">Configuração</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filtros.resultado} onValueChange={(value) => setFiltros({ ...filtros, resultado: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Resultados</SelectItem>
                <SelectItem value="sucesso">Sucesso</SelectItem>
                <SelectItem value="erro">Erro</SelectItem>
                <SelectItem value="bloqueado">Bloqueado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="mt-4 flex items-center gap-4 text-sm text-slate-600">
            <span>Total: <strong>{logs.length}</strong> registros</span>
            <span>•</span>
            <span>Filtrados: <strong>{logsFiltrados.length}</strong></span>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Logs */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
              <p className="text-slate-600">Carregando logs...</p>
            </div>
          ) : logsFiltrados.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600">Nenhum log encontrado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {logsFiltrados.map((log) => (
                <LogCard key={log.id} log={log} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LogCard({ log }) {
  const getIconeAcao = (acao) => {
    switch (acao) {
      case 'criar': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'editar': return <Edit className="w-5 h-5 text-blue-600" />;
      case 'deletar': return <Trash2 className="w-5 h-5 text-red-600" />;
      case 'visualizar': return <Eye className="w-5 h-5 text-purple-600" />;
      case 'exportar': return <Download className="w-5 h-5 text-orange-600" />;
      default: return <Shield className="w-5 h-5 text-slate-600" />;
    }
  };

  const getBadgeResultado = (resultado) => {
    switch (resultado) {
      case 'sucesso': return <Badge className="bg-green-100 text-green-800">Sucesso</Badge>;
      case 'erro': return <Badge className="bg-red-100 text-red-800">Erro</Badge>;
      case 'bloqueado': return <Badge className="bg-orange-100 text-orange-800">Bloqueado</Badge>;
      default: return <Badge>{resultado}</Badge>;
    }
  };

  return (
    <div className="flex items-center gap-4 p-4 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors">
      <div className="flex-shrink-0">
        {getIconeAcao(log.acao)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-slate-900">{log.usuario_nome}</span>
          <span className="text-slate-500">•</span>
          <span className="text-sm text-slate-600 capitalize">{log.acao}</span>
          <span className="text-slate-500">•</span>
          <span className="text-sm font-medium text-indigo-600">{log.entidade_tipo}</span>
          {log.entidade_nome && (
            <>
              <span className="text-slate-500">•</span>
              <span className="text-sm text-slate-700 truncate">{log.entidade_nome}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {format(new Date(log.created_date), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
          </div>
          <div className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {log.usuario_email}
          </div>
        </div>
      </div>

      <div className="flex-shrink-0">
        {getBadgeResultado(log.resultado)}
      </div>
    </div>
  );
}

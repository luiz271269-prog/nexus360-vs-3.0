import React, { useState, useEffect } from 'react';
import { useContatosInteligentes } from '../components/hooks/useContatosInteligentes';
import { base44 } from '@/api/base44Client';
import ClienteCard from '../components/inteligencia/ClienteCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, 
  TrendingUp, 
  Activity,
  RefreshCw,
  Loader2,
  Target,
  Filter
} from 'lucide-react';

export default function ContatosInteligentes() {
  const [usuario, setUsuario] = useState(null);
  const [filtroAtivo, setFiltroAtivo] = useState('todos'); // todos, critico, alto
  
  const { 
    clientes, 
    estatisticas, 
    loading, 
    error,
    totalUrgentes,
    criticos,
    altos,
    refetch 
  } = useContatosInteligentes(usuario, {
    tipo: ['lead', 'cliente'],
    diasSemMensagem: 2,
    minDealRisk: 30,
    limit: 50,
    autoRefresh: true
  });

  // Carregar usuário
  useEffect(() => {
    base44.auth.me().then(setUsuario).catch(console.error);
  }, []);

  const clientesFiltrados = clientes.filter(c => {
    if (filtroAtivo === 'critico') return c.prioridadeLabel === 'CRITICO';
    if (filtroAtivo === 'alto') return ['CRITICO', 'ALTO'].includes(c.prioridadeLabel);
    return true;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Contatos Inteligentes
            </h1>
            <p className="text-slate-600">
              Análise por IA · Priorização automática · Ações recomendadas
            </p>
          </div>
          
          <Button
            onClick={() => refetch()}
            disabled={loading}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* Cards de estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Críticos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-red-600">
                {loading ? '...' : criticos.length}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-orange-700 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Alta Prioridade
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-orange-600">
                {loading ? '...' : altos.length}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-700 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Total Urgentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-600">
                {loading ? '...' : totalUrgentes}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Target className="w-4 h-4" />
                Total Analisados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-slate-600">
                {loading ? '...' : clientes.length}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros rápidos */}
        <div className="flex items-center gap-2 mb-6">
          <Filter className="w-4 h-4 text-slate-500" />
          <Button
            size="sm"
            variant={filtroAtivo === 'todos' ? 'default' : 'outline'}
            onClick={() => setFiltroAtivo('todos')}
          >
            Todos ({clientes.length})
          </Button>
          <Button
            size="sm"
            variant={filtroAtivo === 'critico' ? 'default' : 'outline'}
            onClick={() => setFiltroAtivo('critico')}
            className={filtroAtivo === 'critico' ? 'bg-red-500 hover:bg-red-600' : ''}
          >
            Críticos ({criticos.length})
          </Button>
          <Button
            size="sm"
            variant={filtroAtivo === 'alto' ? 'default' : 'outline'}
            onClick={() => setFiltroAtivo('alto')}
            className={filtroAtivo === 'alto' ? 'bg-orange-500 hover:bg-orange-600' : ''}
          >
            Alta Prioridade ({totalUrgentes})
          </Button>
        </div>

        {/* Lista de clientes */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400 mb-3" />
            <p className="text-slate-600">Analisando contatos...</p>
          </div>
        ) : error ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6 text-center">
              <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
              <p className="text-red-700 font-medium">Erro ao carregar contatos</p>
              <p className="text-xs text-red-600 mt-1">{error}</p>
            </CardContent>
          </Card>
        ) : clientesFiltrados.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <Target className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-lg font-medium text-slate-700">Tudo sob controle!</p>
              <p className="text-sm text-slate-500 mt-1">
                Nenhum contato requer atenção no filtro selecionado
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clientesFiltrados.map(cliente => (
              <ClienteCard key={cliente.contact_id} cliente={cliente} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
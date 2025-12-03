
import { useState, useEffect } from "react";
import { Venda } from "@/entities/Venda";
import { Cliente } from "@/entities/Cliente";
import { Vendedor } from "@/entities/Vendedor";
import { Produto } from "@/entities/Produto";
import { User } from "@/entities/User";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TrendingUp,
  Plus,
  Search,
  DollarSign,
  Target,
  Brain,
  Sparkles,
  Package,
  Award
} from "lucide-react";
import VendaForm from "../components/vendas/VendaForm";
import VendaLista from "../components/vendas/VendaLista";
import { toast } from "sonner";
import { InvokeLLM } from "@/integrations/Core";
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import AlertasInteligentesIA from '../components/global/AlertasInteligentesIA';
import BotaoNexusFlutuante from '../components/global/BotaoNexusFlutuante';

export default function Vendas() {
  const [vendas, setVendas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [usuario, setUsuario] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingVenda, setEditingVenda] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analisandoIA, setAnalisandoIA] = useState(false);

  const [filtros, setFiltros] = useState({
    busca: '',
    periodo: 'mes_atual',
    vendedor: 'todos',
    tipo: 'todos'
  });

  const [insightsIA, setInsightsIA] = useState(null);
  const [padrõesCompra, setPadrõesCompra] = useState([]);
  const [oportunidadesUpsell, setOportunidadesUpsell] = useState([]);
  const [alertasIA, setAlertasIA] = useState([]);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [vendasData, clientesData, vendedoresData, produtosData, user] = await Promise.all([
        Venda.list('-data_venda'),
        Cliente.list(),
        Vendedor.list(),
        Produto.list(),
        User.me()
      ]);

      setVendas(vendasData);
      setClientes(clientesData);
      setVendedores(vendedoresData);
      setProdutos(produtosData);
      setUsuario(user);

      // Análises com IA
      await analisarPadroesCompra(vendasData, clientesData);
      await identificarOportunidadesUpsell(vendasData, clientesData, produtosData);
      gerarAlertasIA(vendasData);

    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar vendas");
    }
    setLoading(false);
  };

  const gerarAlertasIA = (vendas) => {
    const alertas = [];

    // Vendas pendentes há muito tempo
    const vendasPendentes = vendas.filter(v =>
      v.status === 'Pendente' &&
      Math.floor((new Date() - new Date(v.data_venda)) / (1000 * 60 * 60 * 24)) > 7
    );

    if (vendasPendentes.length > 0) {
      alertas.push({
        id: 'vendas_pendentes',
        prioridade: 'alta',
        titulo: `${vendasPendentes.length} Vendas Pendentes`,
        descricao: 'Vendas aguardando faturamento há mais de 7 dias',
        acao_sugerida: 'Revisar Pendências',
        onAcao: () => toast.info('📦 Revisão de pendências necessária')
      });
    }

    // Alerta de meta mensal
    const hoje = new Date();
    const mesAtual = hoje.toISOString().slice(0, 7); // YYYY-MM
    const vendasMes = vendas.filter(v => new Date(v.data_venda).toISOString().slice(0,7) === mesAtual);
    const totalMes = vendasMes.reduce((sum, v) => sum + (v.valor_total || 0), 0);

    const META_MENSAL = 100000; // Exemplo de meta
    if (totalMes < META_MENSAL * 0.7 && hoje.getDate() > 20) {
      alertas.push({
        id: 'meta_mensal',
        prioridade: 'critica',
        titulo: 'Meta Mensal em Risco',
        descricao: `Apenas ${Math.round((totalMes / META_MENSAL) * 100)}% da meta de R$ ${META_MENSAL.toLocaleString('pt-BR')} atingida`,
        acao_sugerida: 'Ação Urgente',
        onAcao: () => toast.info('Navegação para Orçamentos simulada.')
      });
    }

    setAlertasIA(alertas);
  };

  const analisarPadroesCompra = async (vendas, clientes) => {
    setAnalisandoIA(true);
    try {
      // Agrupar vendas por cliente
      const vendasPorCliente = vendas.reduce((acc, venda) => {
        const cliente = venda.cliente_nome;
        if (!acc[cliente]) acc[cliente] = [];
        acc[cliente].push(venda);
        return acc;
      }, {});

      // Análise de padrões
      const contexto = {
        total_vendas: vendas.length,
        ticket_medio: vendas.length > 0 ? vendas.reduce((sum, v) => sum + (v.valor_total || 0), 0) / vendas.length : 0,
        clientes_com_multiplas_compras: Object.values(vendasPorCliente).filter(v => v.length > 1).length,
        tipos_venda_distribuicao: vendas.reduce((acc, v) => {
          acc[v.tipo_venda || 'Nova Venda'] = (acc[v.tipo_venda || 'Nova Venda'] || 0) + 1;
          return acc;
        }, {})
      };

      const analise = await InvokeLLM({
        prompt: `Analise estes padrões de compra e identifique insights acionáveis:

DADOS:
${JSON.stringify(contexto, null, 2)}

Identifique:
1. Padrões de recorrência de compra
2. Produtos/serviços mais vendidos
3. Segmentos de maior valor
4. Sazonalidade (se houver)
5. Oportunidades de otimização`,
        response_json_schema: {
          type: "object",
          properties: {
            padroes_identificados: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  padrao: { type: "string" },
                  insight: { type: "string" },
                  acao_sugerida: { type: "string" }
                }
              }
            },
            segmentos_destaque: {
              type: "array",
              items: { type: "string" }
            },
            recomendacao_estrategica: { type: "string" }
          }
        }
      });

      setPadrõesCompra(analise.padroes_identificados || []);
      setInsightsIA(analise);

    } catch (error) {
      console.error("Erro ao analisar padrões:", error);
    }
    setAnalisandoIA(false);
  };

  const identificarOportunidadesUpsell = async (vendas, clientes, produtos) => {
    try {
      // Agrupar vendas por cliente
      const vendasPorCliente = {};
      vendas.forEach(venda => {
        if (!vendasPorCliente[venda.cliente_nome]) {
          vendasPorCliente[venda.cliente_nome] = [];
        }
        vendasPorCliente[venda.cliente_nome].push(venda);
      });

      const oportunidades = [];

      // Para cada cliente, verificar produtos que ele comprou e sugerir complementares
      for (const [clienteNome, vendasCliente] of Object.entries(vendasPorCliente)) {
        const cliente = clientes.find(c => c.razao_social === clienteNome);
        if (!cliente) continue;

        // Produtos já comprados
        const produtosComprados = vendasCliente.flatMap(v =>
          v.produtos?.map(p => p.nome) || []
        );

        // Se o cliente tem histórico mas não comprou recentemente
        // Sort vendasCliente by data_venda in descending order to get the latest sale
        const sortedVendasCliente = [...vendasCliente].sort((a, b) => new Date(b.data_venda) - new Date(a.data_venda));
        const ultimaVenda = sortedVendasCliente[0];
        
        const diasDesdeUltimaCompra = ultimaVenda ? Math.floor(
          (new Date() - new Date(ultimaVenda.data_venda)) / (1000 * 60 * 60 * 24)
        ) : Infinity;

        if (diasDesdeUltimaCompra > 60 && ultimaVenda) {
          oportunidades.push({
            cliente: clienteNome,
            tipo: 'reativacao',
            motivo: `Cliente sem comprar há ${diasDesdeUltimaCompra} dias`,
            produtos_sugeridos: produtosComprados.length > 0 ? produtosComprados.slice(0, 2) : ['Produto genérico'],
            valor_estimado: ultimaVenda.valor_total,
            prioridade: diasDesdeUltimaCompra > 180 ? 'alta' : 'media'
          });
        }

        // Upsell: Cliente comprou produto X, pode se interessar por Y
        if (produtosComprados.some(p => p.toLowerCase().includes('basic')) && ultimaVenda) {
          oportunidades.push({
            cliente: clienteNome,
            tipo: 'upsell',
            motivo: 'Cliente possui versão básica, pode migrar para premium',
            produtos_sugeridos: ['Versão Premium', 'Pacote Completo'],
            valor_estimado: ultimaVenda.valor_total * 1.5,
            prioridade: 'media'
          });
        }

        // Cross-sell: produtos complementares
        if (vendasCliente.length > 2 && cliente.segmento === 'Corporativo' && ultimaVenda) {
          oportunidades.push({
            cliente: clienteNome,
            tipo: 'crosssell',
            motivo: 'Cliente corporativo ativo, ofertas produtos complementares',
            produtos_sugeridos: produtos.slice(0, 3).map(p => p.nome),
            valor_estimado: ultimaVenda.valor_total * 0.7,
            prioridade: 'alta'
          });
        }
      }

      // Ordenar por prioridade
      oportunidades.sort((a, b) => {
        const prioridadeOrdem = { alta: 3, media: 2, baixa: 1 };
        return prioridadeOrdem[b.prioridade] - prioridadeOrdem[a.prioridade];
      });

      setOportunidadesUpsell(oportunidades.slice(0, 10));

    } catch (error) {
      console.error("Erro ao identificar oportunidades:", error);
    }
  };

  const handleSalvar = async (vendaData) => {
    try {
      if (editingVenda) {
        await Venda.update(editingVenda.id, vendaData);
        toast.success('Venda atualizada!');
      } else {
        await Venda.create(vendaData);
        toast.success('Venda cadastrada!');
      }

      setShowForm(false);
      setEditingVenda(null);
      await carregarDados();
    } catch (error) {
      console.error("Erro ao salvar venda:", error);
      toast.error('Erro ao salvar venda');
    }
  };

  const handleEditar = (venda) => {
    setEditingVenda(venda);
    setShowForm(true);
  };

  const handleExcluir = async (vendaId) => {
    if (!confirm('Tem certeza que deseja excluir esta venda?')) return;

    try {
      await Venda.delete(vendaId);
      toast.success('Venda excluída!');
      await carregarDados();
    } catch (error) {
      console.error("Erro ao excluir venda:", error);
      toast.error('Erro ao excluir venda');
    }
  };

  const vendasFiltradas = vendas.filter(venda => {
    if (filtros.busca) {
      const busca = filtros.busca.toLowerCase();
      if (!venda.numero_pedido?.toLowerCase().includes(busca) &&
          !venda.cliente_nome?.toLowerCase().includes(busca)) {
        return false;
      }
    }

    if (filtros.vendedor !== 'todos' && venda.vendedor !== filtros.vendedor) {
      return false;
    }

    if (filtros.tipo !== 'todos' && venda.tipo_venda !== filtros.tipo) {
      return false;
    }

    if (filtros.periodo !== 'todos') {
      const dataVenda = new Date(venda.data_venda);
      const hoje = new Date();

      if (filtros.periodo === 'mes_atual') {
        if (dataVenda.getMonth() !== hoje.getMonth() ||
            dataVenda.getFullYear() !== hoje.getFullYear()) {
          return false;
        }
      }
    }

    return true;
  });

  const isGerente = usuario?.role === 'admin';

  // Métricas gerais
  const faturamentoTotal = vendasFiltradas.reduce((sum, v) => sum + (v.valor_total || 0), 0);
  const ticketMedio = vendasFiltradas.length > 0 ? faturamentoTotal / vendasFiltradas.length : 0;

  // Distribuição por tipo
  const distribuicaoTipo = vendasFiltradas.reduce((acc, v) => {
    const tipo = v.tipo_venda || 'Nova Venda';
    acc[tipo] = (acc[tipo] || 0) + 1;
    return acc;
  }, {});

  const dadosTipo = Object.entries(distribuicaoTipo).map(([tipo, quantidade]) => ({
    name: tipo,
    value: quantidade
  }));

  const COLORS = ['#f97316', '#fb923c', '#fdba74', '#fed7aa', '#fcd34d']; // Orange/Amber shades

  return (
    <div className="space-y-6 p-6">
      {/* Header com Gradiente Laranja */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-xl border-2 border-slate-700/50 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-orange-500/50">
              <TrendingUp className="w-9 h-9 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 bg-clip-text text-transparent">
                Vendas Realizadas
              </h1>
              <p className="text-slate-300 mt-1">
                Análise inteligente de padrões e oportunidades
              </p>
            </div>
          </div>

          <Button
            onClick={() => {
              setEditingVenda(null);
              setShowForm(true);
            }}
            className="bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 hover:from-amber-500 hover:via-orange-600 hover:to-red-600 text-white font-bold shadow-lg shadow-orange-500/30"
          >
            <Plus className="w-5 h-5 mr-2" />
            Registrar Venda
          </Button>
        </div>
      </div>

      <BotaoNexusFlutuante
        contadorLembretes={alertasIA.length}
        onClick={() => {
          if (alertasIA.length > 0) {
            toast.info(`📊 ${alertasIA.length} alertas de vendas`);
          } else {
            toast.info('Nenhum alerta de vendas no momento.');
          }
        }}
      />

      <AlertasInteligentesIA
        alertas={alertasIA}
        titulo="Vendas IA"
        onAcaoExecutada={(alerta) => {
          if (alerta.id === 'fechar_tudo') {
            setAlertasIA([]);
            return;
          }
          setAlertasIA(prev => prev.filter(a => a.id !== alerta.id));
        }}
      />

      {/* Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-orange-500/50 text-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-300">Faturamento Total</p>
                <p className="text-2xl font-bold text-orange-400 mt-1">
                  R$ {faturamentoTotal.toLocaleString('pt-BR')}
                </p>
              </div>
              <DollarSign className="w-10 h-10 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-orange-500/50 text-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-300">Ticket Médio</p>
                <p className="text-2xl font-bold text-orange-400 mt-1">
                  R$ {ticketMedio.toLocaleString('pt-BR')}
                </p>
              </div>
              <Target className="w-10 h-10 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-orange-500/50 text-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-300">Total de Vendas</p>
                <p className="text-2xl font-bold text-orange-400 mt-1">
                  {vendasFiltradas.length}
                </p>
              </div>
              <Award className="w-10 h-10 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Padrões de Compra e Oportunidades */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Padrões Identificados pela IA */}
        {padrõesCompra.length > 0 && (
          <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-orange-500/50 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-400">
                <Brain className="w-5 h-5" />
                Padrões de Compra (IA)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {padrõesCompra.slice(0, 5).map((padrao, idx) => (
                  <div key={idx} className="bg-slate-700 p-4 rounded-lg border border-orange-600/50">
                    <div className="flex items-start gap-2">
                      <Badge className="bg-orange-600 text-white">Insight</Badge>
                      <div className="flex-1">
                        <p className="font-medium text-slate-100">{padrao.padrao}</p>
                        <p className="text-sm text-slate-300 mt-1">{padrao.insight}</p>
                        <p className="text-xs text-orange-300 mt-2">
                          💡 {padrao.acao_sugerida}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Oportunidades de Upsell/Cross-sell */}
        {oportunidadesUpsell.length > 0 && (
          <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-orange-500/50 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-400">
                <Sparkles className="w-5 h-5" />
                Oportunidades Identificadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {oportunidadesUpsell.slice(0, 5).map((oportunidade, idx) => (
                  <div key={idx} className={`bg-slate-700 p-4 rounded-lg border-2 ${
                    oportunidade.prioridade === 'alta' ? 'border-red-500' : 'border-orange-600/50'
                  }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={
                            oportunidade.tipo === 'upsell' ? 'bg-purple-600 text-white' :
                            oportunidade.tipo === 'crosssell' ? 'bg-blue-600 text-white' :
                            'bg-orange-600 text-white'
                          }>
                            {oportunidade.tipo}
                          </Badge>
                          <Badge className={
                            oportunidade.prioridade === 'alta' ? 'bg-red-600 text-white' : 'bg-yellow-600 text-white'
                          }>
                            {oportunidade.prioridade}
                          </Badge>
                        </div>
                        <p className="font-medium text-slate-100">{oportunidade.cliente}</p>
                        <p className="text-sm text-slate-300 mt-1">{oportunidade.motivo}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Package className="w-4 h-4 text-slate-400" />
                          <p className="text-xs text-slate-300">
                            Produtos: {oportunidade.produtos_sugeridos.join(', ')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-lg font-bold text-green-500">
                          R$ {Math.round(oportunidade.valor_estimado).toLocaleString('pt-BR')}
                        </p>
                        <p className="text-xs text-slate-300">estimado</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Distribuição por Tipo de Venda */}
      {dadosTipo.length > 0 && (
        <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-orange-500/50 text-white">
          <CardHeader>
            <CardTitle className="text-orange-400">Distribuição por Tipo de Venda</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={dadosTipo}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  
                >
                  {dadosTipo.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#333', border: 'none', color: '#fff' }} itemStyle={{ color: '#fff' }} />
                <Legend wrapperStyle={{ color: '#ccc' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Filtros */}
      <div className="bg-slate-800 p-4 rounded-xl shadow border border-slate-700">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <Input
              placeholder="Buscar venda..."
              value={filtros.busca}
              onChange={(e) => setFiltros({...filtros, busca: e.target.value})}
              className="pl-10 bg-slate-900 text-white border-slate-700 placeholder:text-slate-500"
            />
          </div>

          <Select value={filtros.periodo} onValueChange={(value) => setFiltros({...filtros, periodo: value})}>
            <SelectTrigger className="bg-slate-900 text-white border-slate-700">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 text-white border-slate-700">
              <SelectItem value="todos">Todos os Períodos</SelectItem>
              <SelectItem value="mes_atual">Mês Atual</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filtros.tipo} onValueChange={(value) => setFiltros({...filtros, tipo: value})}>
            <SelectTrigger className="bg-slate-900 text-white border-slate-700">
              <SelectValue placeholder="Tipo de Venda" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 text-white border-slate-700">
              <SelectItem value="todos">Todos os Tipos</SelectItem>
              <SelectItem value="Nova Venda">Nova Venda</SelectItem>
              <SelectItem value="Renovação">Renovação</SelectItem>
              <SelectItem value="Upsell">Upsell</SelectItem>
              <SelectItem value="Cross-sell">Cross-sell</SelectItem>
            </SelectContent>
          </Select>

          {isGerente && (
            <Select value={filtros.vendedor} onValueChange={(value) => setFiltros({...filtros, vendedor: value})}>
              <SelectTrigger className="bg-slate-900 text-white border-slate-700">
                <SelectValue placeholder="Vendedor" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 text-white border-slate-700">
                <SelectItem value="todos">Todos os Vendedores</SelectItem>
                {vendedores.map(v => (
                  <SelectItem key={v.id} value={v.nome}>{v.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <VendaForm
              venda={editingVenda}
              clientes={clientes}
              vendedores={vendedores}
              onSave={handleSalvar}
              onCancel={() => {
                setShowForm(false);
                setEditingVenda(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center h-64 text-slate-300">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
        </div>
      ) : (
        <VendaLista
          vendas={vendasFiltradas}
          onEdit={handleEditar}
          onDelete={handleExcluir}
          className="bg-slate-800" // Apply dark theme to VendaLista if it supports className prop
        />
      )}
    </div>
  );
}

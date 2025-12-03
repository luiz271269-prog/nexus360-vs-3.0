
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// Keep Progress for potential future use or if any other card uses it
import { 
  Bot, 
  Brain, 
  Zap, 
  Target, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  Activity,
  Play,
  AlertTriangle, // New import
  Settings,      // New import
  X              // New import
} from "lucide-react";

// Mock data and classes for demonstration purposes
// In a real application, these would be actual API calls or imported services.

let mockRules = [
  { id: 'rule_1', nome: 'Follow-up de Cliente Inativo', descricao: 'Envia e-mail de reengajamento 3 dias após último contato se o cliente estiver inativo.', categoria: 'vendas', ativa: true, contador_execucoes: 120, taxa_sucesso: 95, ultima_execucao: new Date(Date.now() - 3600000).toISOString() },
  { id: 'rule_2', nome: 'Qualificação de Lead por Interação', descricao: 'Atribui score ao lead baseado em interação com o site e abertura de e-mails.', categoria: 'marketing', ativa: true, contador_execucoes: 85, taxa_sucesso: 88, ultima_execucao: new Date(Date.now() - 7200000).toISOString() },
  { id: 'rule_3', nome: 'Alerta de Baixo Desempenho de Vendas', descricao: 'Notifica gestor se um vendedor está abaixo da meta por 7 dias.', categoria: 'atendimento', ativa: false, contador_execucoes: 45, taxa_sucesso: 98, ultima_execucao: null },
  { id: 'rule_4', nome: 'Recálculo Diário de Score de Clientes', descricao: 'Recalcula o score de todos os clientes no sistema diariamente à meia-noite.', categoria: 'geral', ativa: true, contador_execucoes: 2, taxa_sucesso: 100, ultima_execucao: new Date().toISOString() },
  { id: 'rule_5', nome: 'Criação de Tarefa de Contato Pós-Venda', descricao: 'Cria uma tarefa para a equipe de sucesso do cliente após 30 dias da compra.', categoria: 'operacional', ativa: true, contador_execucoes: 70, taxa_sucesso: 92, ultima_execucao: new Date(Date.now() - 10800000).toISOString() },
];

let mockExecutions = [
  { id: 'exec_1', rule_id: 'rule_1', rule_name: 'Follow-up de Cliente Inativo', status: 'concluido', executado_em: new Date().toISOString(), resultado: { detalhes: 'Email enviado para cliente A' } },
  { id: 'exec_2', rule_id: 'rule_2', rule_name: 'Qualificação de Lead por Interação', status: 'falhou', executado_em: new Date(Date.now() - 60000).toISOString(), erro_detalhes: 'Falha ao conectar com CRM' },
  { id: 'exec_3', rule_id: 'rule_4', rule_name: 'Recálculo Diário de Score de Clientes', status: 'executando', executado_em: null, resultado: { detalhes: 'Calculando 1000 clientes' } },
  { id: 'exec_4', rule_id: 'rule_1', rule_name: 'Follow-up de Cliente Inativo', status: 'agendado', executado_em: null },
  { id: 'exec_5', rule_id: 'rule_5', rule_name: 'Criação de Tarefa de Contato Pós-Venda', status: 'concluido', executado_em: new Date(Date.now() - 120000).toISOString(), resultado: { detalhes: 'Tarefa criada para cliente B' } },
  { id: 'exec_6', rule_id: 'rule_2', rule_name: 'Qualificação de Lead por Interação', status: 'concluido', executado_em: new Date(Date.now() - 180000).toISOString(), resultado: { detalhes: 'Score atualizado para Lead C' } },
];

let mockTarefas = [
  { id: 'tarefa_1', nome: 'Ligar para Cliente X (Baixo Score)', prioridade: 'alta', created_date: new Date().toISOString() },
  { id: 'tarefa_2', nome: 'Verificar Orçamento Y (Pendente)', prioridade: 'media', created_date: new Date(Date.now() - 3600000).toISOString() },
  { id: 'tarefa_3', nome: 'Alerta: Cliente Z Inativo por 60 dias', prioridade: 'critica', created_date: new Date().toISOString() },
  { id: 'tarefa_4', nome: 'Reunião de Follow-up (Lead Quente)', prioridade: 'baixa', created_date: new Date(Date.now() - 7200000).toISOString() },
  { id: 'tarefa_5', nome: 'Verificar Status da Campanha de Marketing', prioridade: 'media', created_date: new Date(Date.now() - 10800000).toISOString() },
];

class AutomationRule {
  static async list(sortBy = '', limit = Infinity) {
    await new Promise(resolve => setTimeout(resolve, 300)); // Simulate API call
    let data = [...mockRules];
    if (sortBy.includes('created_date')) {
      data.sort((a, b) => new Date(b.created_date || 0).getTime() - new Date(a.created_date || 0).getTime());
    }
    return data.slice(0, limit);
  }

  static async update(id, newData) {
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate API call
    const index = mockRules.findIndex(r => r.id === id);
    if (index !== -1) {
      mockRules[index] = { ...mockRules[index], ...newData };
      return mockRules[index];
    }
    return null;
  }
}

class AutomationExecution {
  static async list(sortBy = '', limit = Infinity) {
    await new Promise(resolve => setTimeout(resolve, 300)); // Simulate API call
    let data = [...mockExecutions];
    if (sortBy.includes('executado_em')) {
      data.sort((a, b) => new Date(b.executado_em || 0).getTime() - new Date(a.executado_em || 0).getTime());
    }
    return data.slice(0, limit);
  }
}

class TarefaInteligente {
  static async list(sortBy = '', limit = Infinity) {
    await new Promise(resolve => setTimeout(resolve, 300)); // Simulate API call
    let data = [...mockTarefas];
    if (sortBy.includes('created_date')) {
      data.sort((a, b) => new Date(b.created_date || 0).getTime() - new Date(a.created_date || 0).getTime());
    }
    return data.slice(0, limit);
  }
}

class MotorAutomacao {
  static inicializarRegrasPreDefinidas() {
    console.log("Motor de Automação: Regras pré-definidas inicializadas.");
  }

  static async executarTodasRegras() {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate long process
    const numExecuted = mockRules.filter(r => r.ativa).length;
    const numCreated = Math.floor(Math.random() * 5); // Simulate some tasks created
    const numFailed = Math.floor(Math.random() * (numExecuted / 3)); // Simulate some failures

    // Update mock data for immediate visual feedback
    mockExecutions.unshift({
      id: `exec_${Date.now()}`,
      rule_id: 'bulk_run',
      rule_name: 'Execução em Lote Completa',
      status: numFailed > 0 ? 'falhou' : 'concluido',
      executado_em: new Date().toISOString(),
      resultado: { detalhes: `Executadas ${numExecuted} regras, ${numCreated} itens criados.` }
    });
    
    // Simulate updating rule counters
    mockRules = mockRules.map(rule => ({
        ...rule,
        contador_execucoes: rule.ativa ? (rule.contador_execucoes || 0) + 1 : rule.contador_execucoes,
        ultima_execucao: rule.ativa ? new Date().toISOString() : rule.ultima_execucao,
        taxa_sucesso: rule.ativa ? Math.min(100, (rule.taxa_sucesso || 90) + Math.floor(Math.random() * 5) - 2) : rule.taxa_sucesso
    }));

    // Add mock tasks
    for(let i=0; i < numCreated; i++) {
      mockTarefas.unshift({
        id: `tarefa_${Date.now() + i}`,
        nome: `Tarefa gerada por Automação #${Math.random().toString(36).substring(7).toUpperCase()}`,
        prioridade: Math.random() > 0.7 ? 'alta' : 'media',
        created_date: new Date().toISOString()
      });
    }

    return {
      total_regras: mockRules.length,
      executadas: numExecuted,
      criadas: numCreated,
      falharam: numFailed,
      detalhes: [
        { tipo: 'regras', detalhes: `${numExecuted} regras processadas` },
        { tipo: 'tarefas', detalhes: `${numCreated} tarefas geradas` }
      ],
      erro: numFailed > 0 ? "Algumas automações falharam." : null
    };
  }
}


export default function PainelAutomacao() {
  const [estatisticas, setEstatisticas] = useState({
    regras_ativas: 0,
    execucoes_hoje: 0,
    tarefas_criadas_hoje: 0,
    alertas_ativos: 0,
    score_eficiencia: 0
  });
  const [regrasAutomacao, setRegrasAutomacao] = useState([]);
  const [execucoesRecentes, setExecucoesRecentes] = useState([]);
  const [processando, setProcessando] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showDetalhes, setShowDetalhes] = useState(null);

  useEffect(() => {
    carregarDados();
    MotorAutomacao.inicializarRegrasPreDefinidas();
    // Atualizar a cada 30 segundos
    const interval = setInterval(carregarDados, 30000);
    return () => clearInterval(interval);
  }, []);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [regras, execucoes, tarefas] = await Promise.all([
        AutomationRule.list("-created_date"), // Assuming created_date or similar for sorting
        AutomationExecution.list("-executado_em", 50),
        TarefaInteligente.list("-created_date", 100)
      ]);

      setRegrasAutomacao(regras);
      setExecucoesRecentes(execucoes);

      // Calcular estatísticas reais
      const hoje = new Date().toISOString().slice(0, 10);
      const execucoesHoje = execucoes.filter(e => e.executado_em?.startsWith(hoje));
      const tarefasHoje = tarefas.filter(t => t.created_date?.startsWith(hoje));

      const estatisticasReais = {
        regras_ativas: regras.filter(r => r.ativa).length,
        execucoes_hoje: execucoesHoje.length,
        tarefas_criadas_hoje: tarefasHoje.length,
        alertas_ativos: tarefas.filter(t => t.prioridade === "alta" || t.prioridade === "critica").length,
        score_eficiencia: regras.length > 0 ? Math.round((execucoesHoje.filter(e => e.status === 'concluido').length / Math.max(1, execucoesHoje.length)) * 100) : 85 // Default to 85 if no executions
      };

      setEstatisticas(estatisticasReais);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
    setLoading(false);
  };

  const executarTodasAutomacoes = async () => {
    setProcessando(true);
    try {
      console.log("🤖 Executando todas as automações...");
      const resultado = await MotorAutomacao.executarTodasRegras();
      
      if (resultado.erro) {
        alert(`Erro durante a automação: ${resultado.erro}`);
      } else {
        let mensagem = `✅ Automação Concluída!\n\n`;
        mensagem += `📊 Regras Executadas: ${resultado.executadas}/${resultado.total_regras}\n`;
        mensagem += `🎯 Tarefas Geradas: ${resultado.criadas}\n`;
        
        if (resultado.falharam > 0) {
          mensagem += `❌ Falhas Detectadas: ${resultado.falharam}\n`;
        }
        
        mensagem += `\nDetalhes: ${resultado.detalhes.map(d => d.detalhes).join(' | ')}`;
        alert(mensagem);
      }

      await carregarDados(); // Reload data to show updated stats and executions
    } catch (error) {
      console.error("Erro ao executar automações:", error);
      alert("Erro durante a execução das automações. Verifique o console.");
    }
    setProcessando(false);
  };

  const alternarRegra = async (regra) => {
    try {
      await AutomationRule.update(regra.id, { ativa: !regra.ativa });
      await carregarDados();
    } catch (error) {
      console.error("Erro ao alterar regra:", error);
    }
  };

  const getStatusColor = (status) => {
    const cores = {
      agendado: "bg-yellow-100 text-yellow-800",
      executando: "bg-blue-100 text-blue-800", 
      concluido: "bg-green-100 text-green-800",
      falhou: "bg-red-100 text-red-800"
    };
    return cores[status] || "bg-gray-100 text-gray-800";
  };

  const getStatusIcon = (status) => {
    const icones = {
      agendado: <Clock className="w-4 h-4 text-yellow-600" />,
      executando: <Activity className="w-4 h-4 text-blue-600" />,
      concluido: <CheckCircle className="w-4 h-4 text-green-600" />,
      falhou: <AlertCircle className="w-4 h-4 text-red-600" />
    };
    return icones[status] || <Clock className="w-4 h-4" />;
  };

  // New function for category badge styling
  const getCategoriaInfo = (categoria) => {
    const categorias = {
      vendas: "bg-indigo-100 text-indigo-800",
      marketing: "bg-purple-100 text-purple-800",
      atendimento: "bg-teal-100 text-teal-800",
      geral: "bg-gray-100 text-gray-800",
      operacional: "bg-orange-100 text-orange-800",
      // Add more categories as needed
    };
    return categorias[categoria] || "bg-gray-100 text-gray-800";
  };

  if (loading) {
    return <div className="p-6 text-center">Carregando sistema de automação...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Bot className="w-8 h-8 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Centro de Automação Inteligente</h1>
            <p className="text-slate-600">Sistema que automatiza follow-ups, alertas e scoring de clientes</p>
          </div>
        </div>
        
        <Button 
          onClick={executarTodasAutomacoes}
          disabled={processando}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          {processando ? (
            <>
              <Activity className="w-4 h-4 mr-2 animate-spin" />
              Executando...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              Executar Todas Automações
            </>
          )}
        </Button>
      </div>

      {/* KPIs Reais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Regras Ativas</p>
                <p className="text-2xl font-bold text-slate-900">{estatisticas.regras_ativas}</p>
              </div>
              <Zap className="w-6 h-6 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Execuções Hoje</p>
                <p className="text-2xl font-bold text-slate-900">{estatisticas.execucoes_hoje}</p>
              </div>
              <Activity className="w-6 h-6 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Tarefas Criadas</p>
                <p className="text-2xl font-bold text-slate-900">{estatisticas.tarefas_criadas_hoje}</p>
              </div>
              <Target className="w-6 h-6 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Alertas Ativos</p>
                <p className="text-2xl font-bold text-slate-900">{estatisticas.alertas_ativos}</p>
              </div>
              <AlertTriangle className="w-6 h-6 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Eficiência</p>
                <p className="text-2xl font-bold text-slate-900">{estatisticas.score_eficiencia}%</p>
              </div>
              <Brain className="w-6 h-6 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Regras de Automação */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Regras de Automação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {regrasAutomacao.map((regra) => (
                <div key={regra.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${regra.ativa ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <div>
                      <p className="font-medium text-slate-800">{regra.nome}</p>
                      <p className="text-sm text-slate-600">{regra.descricao}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={getCategoriaInfo(regra.categoria)}>
                          {regra.categoria}
                        </Badge>
                        <span className="text-xs text-slate-500">
                          {regra.contador_execucoes || 0} execuções
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDetalhes(regra)}
                    >
                      Ver Detalhes
                    </Button>
                    <Button
                      variant={regra.ativa ? "secondary" : "default"}
                      size="sm"
                      onClick={() => alternarRegra(regra)}
                    >
                      {regra.ativa ? "Desativar" : "Ativar"}
                    </Button>
                  </div>
                </div>
              ))}
              
              {regrasAutomacao.length === 0 && (
                <div className="text-center py-6 text-slate-500">
                  <Settings className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma regra de automação configurada</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Execuções Recentes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Execuções Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {execucoesRecentes.slice(0, 10).map((execucao) => (
                <div key={execucao.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(execucao.status)}
                    <div>
                      <p className="font-medium text-slate-800 text-sm">
                        {execucao.rule_name}
                      </p>
                      <p className="text-xs text-slate-600">
                        {execucao.resultado?.detalhes || execucao.erro_detalhes || 'Processamento concluído'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <Badge className={getStatusColor(execucao.status)}>
                      {execucao.status}
                    </Badge>
                    <p className="text-xs text-slate-500 mt-1">
                      {execucao.executado_em 
                        ? new Date(execucao.executado_em).toLocaleString('pt-BR')
                        : 'Agendado'
                      }
                    </p>
                  </div>
                </div>
              ))}
              
              {execucoesRecentes.length === 0 && (
                <div className="text-center py-6 text-slate-500">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma execução registrada ainda</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal de Detalhes */}
      {showDetalhes && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-800">Detalhes da Regra</h3>
                <Button variant="ghost" size="icon" onClick={() => setShowDetalhes(null)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <h4 className="font-semibold text-slate-700">Nome:</h4>
                <p className="text-slate-600">{showDetalhes.nome}</p>
              </div>
              <div>
                <h4 className="font-semibold text-slate-700">Descrição:</h4>
                <p className="text-slate-600">{showDetalhes.descricao}</p>
              </div>
              <div>
                <h4 className="font-semibold text-slate-700">Categoria:</h4>
                <Badge className={getCategoriaInfo(showDetalhes.categoria)}>
                  {showDetalhes.categoria}
                </Badge>
              </div>
              <div>
                <h4 className="font-semibold text-slate-700">Status:</h4>
                <Badge className={showDetalhes.ativa ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                  {showDetalhes.ativa ? 'Ativa' : 'Inativa'}
                </Badge>
              </div>
              <div>
                <h4 className="font-semibold text-slate-700">Estatísticas:</h4>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <p className="text-sm text-slate-600">Total de Execuções</p>
                    <p className="text-xl font-bold">{showDetalhes.contador_execucoes || 0}</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <p className="text-sm text-slate-600">Taxa de Sucesso</p>
                    <p className="text-xl font-bold">{showDetalhes.taxa_sucesso || 0}%</p>
                  </div>
                </div>
              </div>
              {showDetalhes.ultima_execucao && (
                <div>
                  <h4 className="font-semibold text-slate-700">Última Execução:</h4>
                  <p className="text-slate-600">
                    {new Date(showDetalhes.ultima_execucao).toLocaleString('pt-BR')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

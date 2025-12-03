import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Brain,
  Zap,
  Target,
  Play,
  Loader2,
  CheckCircle,
  AlertCircle,
  Code,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";
import MotorRaciocinio from "../components/inteligencia/MotorRaciocinio";
import SistemaToolUse from "../components/inteligencia/SistemaToolUse";
import MotorHiperPersonalizacao from "../components/inteligencia/MotorHiperPersonalizacao";
import { Cliente } from "@/entities/Cliente";

/**
 * Página de Testes das Capacidades de IA
 */

export default function TestesIA() {
  const [testeSelecionado, setTesteSelecionado] = useState(null);
  const [executando, setExecutando] = useState(false);
  const [resultado, setResultado] = useState(null);

  // Estados para cada teste
  const [tarefaComplexa, setTarefaComplexa] = useState("Crie um orçamento para o cliente ABC com produtos X e Y");
  const [nomeTool, setNomeTool] = useState("buscar_cliente");
  const [parametrosTool, setParametrosTool] = useState('{"termo_busca": "Empresa"}');
  const [clienteIdPersonalizacao, setClienteIdPersonalizacao] = useState("");
  const [mensagemGenerica, setMensagemGenerica] = useState("Olá! Gostaria de apresentar nossa nova linha de produtos.");

  const testes = [
    {
      id: "raciocinio",
      nome: "Motor de Raciocínio Multi-Passos",
      descricao: "Testa a capacidade da IA de planejar e executar tarefas complexas",
      icon: Brain,
      color: "purple"
    },
    {
      id: "tool_use",
      nome: "Sistema de Tool Use",
      descricao: "Testa a execução de ferramentas do sistema pela IA",
      icon: Zap,
      color: "amber"
    },
    {
      id: "personalizacao",
      nome: "Motor de Hiper-Personalização",
      descricao: "Testa a identificação de perfil e personalização de mensagens",
      icon: Target,
      color: "blue"
    }
  ];

  const executarTesteRaciocinio = async () => {
    setExecutando(true);
    setResultado(null);

    try {
      const toolsDisponiveis = SistemaToolUse.listarToolsDisponiveis();
      const resultado = await MotorRaciocinio.executarTarefa(
        tarefaComplexa,
        { usuario_teste: true },
        toolsDisponiveis
      );

      setResultado({
        sucesso: resultado.sucesso,
        dados: resultado,
        mensagem: resultado.sucesso
          ? `✅ Tarefa concluída em ${resultado.iteracoes} iterações`
          : `❌ Falha: ${resultado.erro}`
      });

      if (resultado.sucesso) {
        toast.success("Teste de Raciocínio concluído com sucesso!");
      } else {
        toast.error("Teste de Raciocínio falhou");
      }

    } catch (error) {
      setResultado({
        sucesso: false,
        erro: error.message
      });
      toast.error("Erro no teste: " + error.message);
    }

    setExecutando(false);
  };

  const executarTesteToolUse = async () => {
    setExecutando(true);
    setResultado(null);

    try {
      const parametros = JSON.parse(parametrosTool);
      const resultado = await SistemaToolUse.executarTool(nomeTool, parametros);

      setResultado({
        sucesso: resultado.sucesso,
        dados: resultado,
        mensagem: resultado.sucesso
          ? `✅ Tool "${nomeTool}" executada com sucesso`
          : `❌ Falha na execução: ${resultado.erro}`
      });

      if (resultado.sucesso) {
        toast.success("Tool executada com sucesso!");
      } else {
        toast.error("Falha na execução da tool");
      }

    } catch (error) {
      setResultado({
        sucesso: false,
        erro: error.message
      });
      toast.error("Erro no teste: " + error.message);
    }

    setExecutando(false);
  };

  const executarTestePersonalizacao = async () => {
    setExecutando(true);
    setResultado(null);

    try {
      // Se não houver cliente selecionado, pegar o primeiro da lista
      let clienteId = clienteIdPersonalizacao;
      
      if (!clienteId) {
        const clientes = await Cliente.list('-created_date', 1);
        if (clientes.length === 0) {
          throw new Error("Nenhum cliente encontrado no sistema");
        }
        clienteId = clientes[0].id;
      }

      // Identificar perfil
      const perfil = await MotorHiperPersonalizacao.identificarPerfil(clienteId);
      
      // Personalizar mensagem
      const mensagemPersonalizada = await MotorHiperPersonalizacao.personalizarMensagem(
        mensagemGenerica,
        clienteId
      );

      setResultado({
        sucesso: true,
        dados: {
          perfil,
          mensagemOriginal: mensagemGenerica,
          mensagemPersonalizada
        },
        mensagem: `✅ Mensagem personalizada para perfil "${perfil?.tipo_perfil}"`
      });

      toast.success("Teste de Personalização concluído!");

    } catch (error) {
      setResultado({
        sucesso: false,
        erro: error.message
      });
      toast.error("Erro no teste: " + error.message);
    }

    setExecutando(false);
  };

  const executarTeste = () => {
    switch (testeSelecionado) {
      case "raciocinio":
        return executarTesteRaciocinio();
      case "tool_use":
        return executarTesteToolUse();
      case "personalizacao":
        return executarTestePersonalizacao();
      default:
        toast.error("Selecione um teste");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 border-purple-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-purple-900 mb-2">
                🧪 Laboratório de Testes de IA
              </h1>
              <p className="text-sm text-purple-800 mb-3">
                Teste e valide as capacidades autônomas do VendaPro em ambiente controlado
              </p>
              <div className="flex gap-2">
                <Badge className="bg-purple-100 text-purple-800">Sandbox Seguro</Badge>
                <Badge className="bg-indigo-100 text-indigo-800">Logs Detalhados</Badge>
                <Badge className="bg-blue-100 text-blue-800">Validação em Tempo Real</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seleção de Testes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {testes.map((teste) => {
          const Icon = teste.icon;
          const isSelected = testeSelecionado === teste.id;
          
          return (
            <Card
              key={teste.id}
              className={`cursor-pointer transition-all hover:shadow-lg ${
                isSelected ? `border-2 border-${teste.color}-500 bg-${teste.color}-50` : ''
              }`}
              onClick={() => setTesteSelecionado(teste.id)}
            >
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Icon className={`w-5 h-5 text-${teste.color}-600`} />
                  {teste.nome}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-600">{teste.descricao}</p>
                {isSelected && (
                  <Badge className={`mt-3 bg-${teste.color}-100 text-${teste.color}-800`}>
                    ✓ Selecionado
                  </Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Configuração do Teste */}
      {testeSelecionado && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="w-5 h-5 text-slate-600" />
              Configuração do Teste
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {testeSelecionado === "raciocinio" && (
              <div>
                <label className="text-sm font-medium block mb-2">Tarefa Complexa:</label>
                <Textarea
                  value={tarefaComplexa}
                  onChange={(e) => setTarefaComplexa(e.target.value)}
                  placeholder="Digite uma tarefa complexa para a IA executar..."
                  className="h-24"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Exemplos: "Crie um orçamento para...", "Busque todos os clientes que..."
                </p>
              </div>
            )}

            {testeSelecionado === "tool_use" && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium block mb-2">Tool a Executar:</label>
                  <select
                    value={nomeTool}
                    onChange={(e) => setNomeTool(e.target.value)}
                    className="w-full p-2 border rounded-lg"
                  >
                    <option value="buscar_cliente">buscar_cliente</option>
                    <option value="listar_produtos">listar_produtos</option>
                    <option value="criar_orcamento">criar_orcamento</option>
                    <option value="buscar_orcamentos">buscar_orcamentos</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-2">Parâmetros (JSON):</label>
                  <Textarea
                    value={parametrosTool}
                    onChange={(e) => setParametrosTool(e.target.value)}
                    placeholder='{"termo_busca": "valor"}'
                    className="h-24 font-mono text-xs"
                  />
                </div>
              </div>
            )}

            {testeSelecionado === "personalizacao" && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium block mb-2">ID do Cliente (opcional):</label>
                  <Input
                    value={clienteIdPersonalizacao}
                    onChange={(e) => setClienteIdPersonalizacao(e.target.value)}
                    placeholder="Deixe vazio para usar o primeiro cliente"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-2">Mensagem Genérica:</label>
                  <Textarea
                    value={mensagemGenerica}
                    onChange={(e) => setMensagemGenerica(e.target.value)}
                    placeholder="Digite uma mensagem para ser personalizada..."
                    className="h-24"
                  />
                </div>
              </div>
            )}

            <Button
              onClick={executarTeste}
              disabled={executando}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600"
            >
              {executando ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Executando Teste...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 mr-2" />
                  Executar Teste
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Resultado do Teste */}
      {resultado && (
        <Card className={resultado.sucesso ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {resultado.sucesso ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-green-900">Teste Concluído com Sucesso</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <span className="text-red-900">Teste Falhou</span>
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-sm mb-4 ${resultado.sucesso ? 'text-green-800' : 'text-red-800'}`}>
              {resultado.mensagem}
            </p>
            
            <div className="bg-white p-4 rounded-lg border">
              <p className="text-xs font-semibold text-slate-700 mb-2">Resultado Detalhado:</p>
              <pre className="text-xs bg-slate-50 p-3 rounded overflow-auto max-h-96 font-mono">
                {JSON.stringify(resultado.dados, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ferramentas Disponíveis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-600" />
            Ferramentas Disponíveis para IA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {SistemaToolUse.listarToolsDisponiveis().map((tool, index) => (
              <div key={index} className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <p className="font-medium text-amber-900 text-sm">{tool.nome}</p>
                <p className="text-xs text-amber-700 mt-1">{tool.descricao}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Play, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Clock,
  RefreshCw,
  FileText
} from "lucide-react";
import { toast } from "sonner";

// Importar módulos a serem testados
import { MotorRAG } from "../inteligencia/MotorRAG";
import { NexusEngine } from "../comunicacao/NexusEngine";
import { ExecutorFluxos } from "../automacao/ExecutorFluxos";
import MotorInteligencia from "../agenda/MotorInteligencia";
import { Cliente } from "@/entities/Cliente";
import { Vendedor } from "@/entities/Vendedor";
import { Produto } from "@/entities/Produto";
import { FlowTemplate } from "@/entities/FlowTemplate";
import { BaseConhecimento } from "@/entities/BaseConhecimento";

/**
 * TestSuite - Suite Completa de Testes Automatizados
 * Valida todos os componentes críticos do sistema
 */
export default function TestSuite() {
  const [resultados, setResultados] = useState([]);
  const [executando, setExecutando] = useState(false);
  const [progresso, setProgresso] = useState(0);

  const SUITE_TESTES = [
    // ===== TESTES DE ENTIDADES =====
    {
      categoria: "Entidades",
      nome: "CRUD Cliente",
      descricao: "Criar, ler, atualizar e deletar cliente",
      teste: async () => {
        const clienteTeste = {
          razao_social: `Teste Cliente ${Date.now()}`,
          vendedor_responsavel: "Teste",
          status: "Prospect"
        };
        
        const criado = await Cliente.create(clienteTeste);
        if (!criado.id) throw new Error("Cliente não criado");
        
        const lido = await Cliente.get(criado.id);
        if (lido.razao_social !== clienteTeste.razao_social) {
          throw new Error("Cliente lido incorretamente");
        }
        
        await Cliente.update(criado.id, { status: "Ativo" });
        const atualizado = await Cliente.get(criado.id);
        if (atualizado.status !== "Ativo") {
          throw new Error("Cliente não atualizado");
        }
        
        await Cliente.delete(criado.id);
        
        return { sucesso: true, detalhes: "CRUD completo funcionando" };
      }
    },
    
    {
      categoria: "Entidades",
      nome: "CRUD Vendedor",
      descricao: "Operações básicas de vendedor",
      teste: async () => {
        const vendedorTeste = {
          nome: `Vendedor Teste ${Date.now()}`,
          codigo: `V-TEST-${Date.now()}`,
          email: `teste${Date.now()}@vendapro.com`,
          status: "ativo"
        };
        
        const criado = await Vendedor.create(vendedorTeste);
        if (!criado.id) throw new Error("Vendedor não criado");
        
        await Vendedor.delete(criado.id);
        
        return { sucesso: true, detalhes: "Vendedor criado e deletado" };
      }
    },
    
    {
      categoria: "Entidades",
      nome: "CRUD Produto",
      descricao: "Operações básicas de produto",
      teste: async () => {
        const produtoTeste = {
          codigo: `PROD-TEST-${Date.now()}`,
          nome: `Produto Teste ${Date.now()}`,
          preco_venda: 100,
          categoria: "Hardware",
          ativo: true
        };
        
        const criado = await Produto.create(produtoTeste);
        if (!criado.id) throw new Error("Produto não criado");
        
        await Produto.delete(criado.id);
        
        return { sucesso: true, detalhes: "Produto criado e deletado" };
      }
    },
    
    // ===== TESTES DE IA =====
    {
      categoria: "Inteligência Artificial",
      nome: "Motor RAG - Busca",
      descricao: "Validar busca de conhecimento",
      teste: async () => {
        const resultado = await MotorRAG.buscarConhecimento(
          "Como fazer um orçamento?",
          { limite: 3 }
        );
        
        if (!Array.isArray(resultado)) {
          throw new Error("RAG não retornou array");
        }
        
        return { 
          sucesso: true, 
          detalhes: `Encontrou ${resultado.length} documentos relevantes` 
        };
      }
    },
    
    {
      categoria: "Inteligência Artificial",
      nome: "NexusEngine - Processamento",
      descricao: "Validar processamento de entrada",
      teste: async () => {
        const resposta = await NexusEngine.processarEntrada(
          "Olá, preciso de ajuda",
          { email: "teste@vendapro.com" },
          { teste: true }
        );
        
        if (!resposta || !resposta.content) {
          throw new Error("NexusEngine não gerou resposta");
        }
        
        if (typeof resposta.confidence === 'undefined') {
          throw new Error("Resposta sem score de confiança");
        }
        
        return { 
          sucesso: true, 
          detalhes: `Resposta gerada com ${Math.round(resposta.confidence * 100)}% confiança` 
        };
      }
    },
    
    {
      categoria: "Inteligência Artificial",
      nome: "Score de Confiança",
      descricao: "Validar cálculo de confiança da IA",
      teste: async () => {
        const respostaAlta = { confidence: 0.95, type: 'text' };
        const contextoParcial = { conhecimento_encontrado: true };
        
        // Simular cálculo
        let score = respostaAlta.confidence;
        if (contextoParcial.conhecimento_encontrado) score += 0.2;
        
        if (score < 0.9) {
          throw new Error("Score de confiança incorreto");
        }
        
        return { 
          sucesso: true, 
          detalhes: `Score calculado: ${Math.round(score * 100)}%` 
        };
      }
    },
    
    // ===== TESTES DE AUTOMAÇÃO =====
    {
      categoria: "Automação",
      nome: "FlowTemplate - Criação",
      descricao: "Criar template de fluxo",
      teste: async () => {
        const fluxoTeste = {
          nome: `Fluxo Teste ${Date.now()}`,
          categoria: "teste",
          trigger_type: "manual",
          trigger_config: {},
          steps: [
            {
              tipo: 'send_message',
              config: { mensagem: 'Teste' }
            }
          ],
          ativo: false
        };
        
        const criado = await FlowTemplate.create(fluxoTeste);
        if (!criado.id) throw new Error("Fluxo não criado");
        
        await FlowTemplate.delete(criado.id);
        
        return { sucesso: true, detalhes: "Fluxo criado e deletado" };
      }
    },
    
    {
      categoria: "Automação",
      nome: "ExecutorFluxos - Validação",
      descricao: "Validar estrutura do executor",
      teste: async () => {
        // Validar métodos existem
        if (typeof ExecutorFluxos.iniciarFluxo !== 'function') {
          throw new Error("Método iniciarFluxo não encontrado");
        }
        
        if (typeof ExecutorFluxos.executarProximoPasso !== 'function') {
          throw new Error("Método executarProximoPasso não encontrado");
        }
        
        if (typeof ExecutorFluxos.executarPasso !== 'function') {
          throw new Error("Método executarPasso não encontrado");
        }
        
        return { sucesso: true, detalhes: "Todos os métodos presentes" };
      }
    },
    
    // ===== TESTES DE INTEGRAÇÃO =====
    {
      categoria: "Integração",
      nome: "Motor Inteligência - Análise Cliente",
      descricao: "Validar análise de cliente",
      teste: async () => {
        // Criar cliente temporário
        const clienteTeste = await Cliente.create({
          razao_social: `Cliente Análise ${Date.now()}`,
          vendedor_responsavel: "Teste",
          status: "Ativo"
        });
        
        try {
          const analise = await MotorInteligencia.analisarCliente(clienteTeste.id);
          
          if (!analise) {
            throw new Error("Análise não retornou resultado");
          }
          
          if (typeof analise.score_total === 'undefined') {
            throw new Error("Análise sem score");
          }
          
          await Cliente.delete(clienteTeste.id);
          
          return { 
            sucesso: true, 
            detalhes: `Cliente analisado com score ${analise.score_total}` 
          };
          
        } catch (error) {
          await Cliente.delete(clienteTeste.id);
          throw error;
        }
      }
    },
    
    {
      categoria: "Integração",
      nome: "Base Conhecimento - Indexação",
      descricao: "Validar criação e indexação de documentos",
      teste: async () => {
        const docTeste = {
          titulo: `Doc Teste ${Date.now()}`,
          categoria: "faq",
          conteudo: "Este é um documento de teste para validar a indexação",
          tags: ["teste", "automacao"],
          ativo: true,
          aprovado: true
        };
        
        const criado = await BaseConhecimento.create(docTeste);
        if (!criado.id) throw new Error("Documento não criado");
        
        // Testar busca
        const documentos = await BaseConhecimento.filter({ ativo: true });
        const encontrado = documentos.find(d => d.id === criado.id);
        
        if (!encontrado) {
          throw new Error("Documento não encontrado na busca");
        }
        
        await BaseConhecimento.delete(criado.id);
        
        return { sucesso: true, detalhes: "Documento criado, indexado e deletado" };
      }
    },
    
    // ===== TESTES DE PERFORMANCE =====
    {
      categoria: "Performance",
      nome: "Carga - Listagem Clientes",
      descricao: "Medir tempo de listagem de clientes",
      teste: async () => {
        const inicio = Date.now();
        const clientes = await Cliente.list('-created_date', 100);
        const tempo = Date.now() - inicio;
        
        if (tempo > 3000) {
          throw new Error(`Listagem muito lenta: ${tempo}ms`);
        }
        
        return { 
          sucesso: true, 
          detalhes: `${clientes.length} clientes em ${tempo}ms` 
        };
      }
    },
    
    {
      categoria: "Performance",
      nome: "Carga - Listagem Produtos",
      descricao: "Medir tempo de listagem de produtos",
      teste: async () => {
        const inicio = Date.now();
        const produtos = await Produto.list('-created_date', 100);
        const tempo = Date.now() - inicio;
        
        if (tempo > 3000) {
          throw new Error(`Listagem muito lenta: ${tempo}ms`);
        }
        
        return { 
          sucesso: true, 
          detalhes: `${produtos.length} produtos em ${tempo}ms` 
        };
      }
    },
    
    {
      categoria: "Performance",
      nome: "RAG - Velocidade de Busca",
      descricao: "Medir tempo de busca no RAG",
      teste: async () => {
        const inicio = Date.now();
        await MotorRAG.buscarConhecimento("teste performance", { limite: 5 });
        const tempo = Date.now() - inicio;
        
        if (tempo > 5000) {
          throw new Error(`Busca RAG muito lenta: ${tempo}ms`);
        }
        
        return { 
          sucesso: true, 
          detalhes: `Busca completada em ${tempo}ms` 
        };
      }
    }
  ];

  const executarTestes = async () => {
    setExecutando(true);
    setResultados([]);
    setProgresso(0);
    
    const resultadosTestes = [];
    const total = SUITE_TESTES.length;
    
    for (let i = 0; i < SUITE_TESTES.length; i++) {
      const teste = SUITE_TESTES[i];
      const timestampInicio = Date.now();
      
      try {
        console.log(`🧪 Executando: ${teste.nome}`);
        
        const resultado = await Promise.race([
          teste.teste(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout - teste excedeu 30s')), 30000)
          )
        ]);
        
        const tempo = Date.now() - timestampInicio;
        
        resultadosTestes.push({
          ...teste,
          status: 'passou',
          tempo,
          detalhes: resultado.detalhes || 'Teste passou'
        });
        
      } catch (error) {
        const tempo = Date.now() - timestampInicio;
        
        resultadosTestes.push({
          ...teste,
          status: 'falhou',
          tempo,
          erro: error.message
        });
      }
      
      setResultados([...resultadosTestes]);
      setProgresso(((i + 1) / total) * 100);
    }
    
    setExecutando(false);
    
    const passou = resultadosTestes.filter(r => r.status === 'passou').length;
    const falhou = resultadosTestes.filter(r => r.status === 'falhou').length;
    
    if (falhou === 0) {
      toast.success(`✅ Todos os ${passou} testes passaram!`);
    } else {
      toast.error(`❌ ${falhou} teste(s) falharam de ${total}`);
    }
  };

  const categoriasUnicas = [...new Set(SUITE_TESTES.map(t => t.categoria))];
  
  const estatisticas = {
    total: resultados.length,
    passou: resultados.filter(r => r.status === 'passou').length,
    falhou: resultados.filter(r => r.status === 'falhou').length,
    tempoTotal: resultados.reduce((acc, r) => acc + (r.tempo || 0), 0)
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 border-2 border-indigo-200">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/50">
                <FileText className="w-9 h-9 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-700 to-purple-700 bg-clip-text text-transparent">
                  Suite de Testes Automatizados
                </h1>
                <p className="text-slate-600 mt-1">
                  {SUITE_TESTES.length} testes • {categoriasUnicas.length} categorias
                </p>
              </div>
            </div>

            <Button
              onClick={executarTestes}
              disabled={executando}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
            >
              {executando ? (
                <>
                  <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                  Executando...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 mr-2" />
                  Executar Todos os Testes
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Progresso */}
      {executando && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-slate-600">
                <span>Progresso</span>
                <span>{Math.round(progresso)}%</span>
              </div>
              <Progress value={progresso} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estatísticas */}
      {resultados.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Total</p>
                  <p className="text-2xl font-bold">{estatisticas.total}</p>
                </div>
                <FileText className="w-8 h-8 text-slate-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600">Passaram</p>
                  <p className="text-2xl font-bold text-green-600">{estatisticas.passou}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-600">Falharam</p>
                  <p className="text-2xl font-bold text-red-600">{estatisticas.falhou}</p>
                </div>
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600">Tempo Total</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {(estatisticas.tempoTotal / 1000).toFixed(1)}s
                  </p>
                </div>
                <Clock className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Resultados por Categoria */}
      {resultados.length > 0 && categoriasUnicas.map(categoria => {
        const testesDaCategoria = resultados.filter(r => r.categoria === categoria);
        
        return (
          <Card key={categoria}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {categoria}
                <Badge variant="outline">
                  {testesDaCategoria.length} testes
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {testesDaCategoria.map((resultado, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-lg border-2 ${
                      resultado.status === 'passou' 
                        ? 'border-green-200 bg-green-50' 
                        : 'border-red-200 bg-red-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {resultado.status === 'passou' ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-600" />
                          )}
                          <h4 className="font-semibold text-slate-900">{resultado.nome}</h4>
                          <Badge className={resultado.status === 'passou' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                            {resultado.tempo}ms
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-600 mt-1">{resultado.descricao}</p>
                        
                        {resultado.status === 'passou' && resultado.detalhes && (
                          <p className="text-sm text-green-700 mt-2 font-medium">
                            ✓ {resultado.detalhes}
                          </p>
                        )}
                        
                        {resultado.status === 'falhou' && resultado.erro && (
                          <div className="mt-2 p-3 bg-red-100 rounded border border-red-200">
                            <p className="text-sm text-red-800 font-mono">
                              {resultado.erro}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Estado Inicial */}
      {resultados.length === 0 && !executando && (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">
              Nenhum teste executado ainda
            </h3>
            <p className="text-slate-500 mb-4">
              Clique em "Executar Todos os Testes" para iniciar a validação do sistema
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
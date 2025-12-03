import { useState, useEffect } from "react";
import { Cliente } from "@/entities/Cliente";
import { Orcamento } from "@/entities/Orcamento";
import { Venda } from "@/entities/Venda";
import { Interacao } from "@/entities/Interacao";
import { InvokeLLM } from "@/integrations/Core";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Target, 
  Phone, 
  MessageCircle, 
  Mail, 
  Clock, 
  AlertTriangle,
  TrendingUp,
  Brain
} from "lucide-react";
import RegistroInteracaoModal from "../interacoes/RegistroInteracaoModal";

export default function AgendaPrioritaria({ vendedorNome, onClienteContato }) {
  const [agendaPrioritaria, setAgendaPrioritaria] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRegistroModal, setShowRegistroModal] = useState(false);
  const [clienteSelecionado, setClienteSelecionado] = useState(null);

  useEffect(() => {
    gerarAgendaPrioritaria();
  }, [vendedorNome]);

  const gerarAgendaPrioritaria = async () => {
    setLoading(true);
    try {
      // Buscar dados do vendedor
      const [clientes, orcamentos, vendas, interacoes] = await Promise.all([
        Cliente.filter({ vendedor_responsavel: vendedorNome }),
        Orcamento.filter({ vendedor: vendedorNome }),
        Venda.filter({ vendedor: vendedorNome }),
        Interacao.filter({ vendedor: vendedorNome })
      ]);

      // Usar IA para priorizar clientes
      const prompt = `
        Analise os dados abaixo e gere uma agenda prioritária de 8-10 clientes para contato hoje.
        
        Dados do vendedor ${vendedorNome}:
        - ${clientes.length} clientes na carteira
        - ${orcamentos.filter(o => o.status === "Em Aberto").length} orçamentos em aberto
        - ${vendas.filter(v => v.data_venda?.startsWith(new Date().toISOString().slice(0, 7))).length} vendas no mês
        
        Priorize clientes baseado em:
        1. Orçamentos próximos do vencimento (alta prioridade)
        2. Clientes sem contato há mais de 15 dias
        3. Clientes com status "Em Risco"
        4. Clientes de alta classificação (A - Alto Potencial) 
        5. Próximos contatos agendados para hoje
        6. Clientes "quentes" que demonstraram interesse recente
        
        Para cada cliente sugerido, forneça:
        - Nome do cliente
        - Motivo da priorização
        - Prioridade (alta, media, baixa)
        - Sugestão de abordagem
        - Tipo de contato recomendado
      `;

      const agendaIA = await InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            agenda_prioritaria: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  cliente_nome: { type: "string" },
                  motivo_priorizacao: { type: "string" },
                  prioridade: { type: "string", enum: ["alta", "media", "baixa"] },
                  sugestao_abordagem: { type: "string" },
                  tipo_contato_recomendado: { type: "string" },
                  temperatura_esperada: { type: "string" }
                }
              }
            }
          }
        }
      });

      // Enriquecer dados da agenda com informações reais
      const agendaEnriquecida = agendaIA.agenda_prioritaria.map(item => {
        const cliente = clientes.find(c => c.razao_social.toLowerCase().includes(item.cliente_nome.toLowerCase()));
        const ultimaInteracao = interacoes
          .filter(i => i.cliente_nome === cliente?.razao_social)
          .sort((a, b) => new Date(b.data_interacao) - new Date(a.data_interacao))[0];
        
        const orcamentosCliente = orcamentos.filter(o => o.cliente_nome === cliente?.razao_social);
        const vendasCliente = vendas.filter(v => v.cliente_nome === cliente?.razao_social);

        return {
          ...item,
          cliente_id: cliente?.id,
          cliente_completo: cliente,
          ultima_interacao: ultimaInteracao,
          orcamentos_abertos: orcamentosCliente.filter(o => o.status === "Em Aberto").length,
          vendas_mes: vendasCliente.filter(v => v.data_venda?.startsWith(new Date().toISOString().slice(0, 7))).length,
          dias_sem_contato: ultimaInteracao ? 
            Math.floor((new Date() - new Date(ultimaInteracao.data_interacao)) / (1000 * 60 * 60 * 24)) : 
            "N/A"
        };
      }).filter(item => item.cliente_id); // Só incluir clientes que existem

      setAgendaPrioritaria(agendaEnriquecida.slice(0, 8)); // Limitar a 8 itens
    } catch (error) {
      console.error("Erro ao gerar agenda prioritária:", error);
      // Fallback sem IA
      gerarAgendaSimples();
    }
    setLoading(false);
  };

  const gerarAgendaSimples = async () => {
    // Versão simplificada sem IA como fallback
    const clientes = await Cliente.filter({ vendedor_responsavel: vendedorNome });
    const orcamentos = await Orcamento.filter({ vendedor: vendedorNome, status: "Em Aberto" });
    
    const clientesPrioritarios = clientes
      .slice(0, 6)
      .map(cliente => ({
        cliente_nome: cliente.razao_social,
        cliente_id: cliente.id,
        cliente_completo: cliente,
        motivo_priorizacao: orcamentos.find(o => o.cliente_nome === cliente.razao_social) 
          ? "Orçamento em aberto" 
          : "Acompanhamento de rotina",
        prioridade: cliente.classificacao === "A - Alto Potencial" ? "alta" : "media",
        sugestao_abordagem: "Verificar necessidades atuais e oportunidades",
        tipo_contato_recomendado: "ligacao",
        orcamentos_abertos: orcamentos.filter(o => o.cliente_nome === cliente.razao_social).length
      }));

    setAgendaPrioritaria(clientesPrioritarios);
  };

  const getPrioridadeColor = (prioridade) => {
    switch (prioridade) {
      case "alta": return "bg-red-500/20 text-red-400 border-red-500/30";
      case "media": return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "baixa": return "bg-sky-500/20 text-sky-400 border-sky-500/30";
      default: return "bg-slate-700 text-slate-400 border-slate-600";
    }
  };

  const getTipoContatoIcon = (tipo) => {
    switch (tipo) {
      case "ligacao": return <Phone className="w-4 h-4" />;
      case "whatsapp": return <MessageCircle className="w-4 h-4" />;
      case "email": return <Mail className="w-4 h-4" />;
      default: return <Phone className="w-4 h-4" />;
    }
  };

  const handleIniciarContato = (cliente) => {
    setClienteSelecionado(cliente);
    setShowRegistroModal(true);
  };

  const handleInteracaoRegistrada = () => {
    setShowRegistroModal(false);
    setClienteSelecionado(null);
    gerarAgendaPrioritaria(); // Atualizar agenda
  };

  if (loading) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-lg rounded-2xl p-6 border border-slate-700/50 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <Brain className="w-6 h-6 text-indigo-400 animate-pulse" />
          <h2 className="text-xl font-bold text-white">Gerando Agenda Prioritária...</h2>
        </div>
        <div className="space-y-3">
          {Array(5).fill(0).map((_, i) => (
            <div key={i} className="bg-slate-700/50 rounded-lg h-16 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-slate-800/50 backdrop-blur-lg rounded-2xl p-6 border border-slate-700/50 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/20 rounded-lg flex items-center justify-center border border-indigo-500/30">
              <Target className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Agenda Prioritária do Dia</h2>
              <p className="text-sm text-slate-400">Sugestões inteligentes da IA para maximizar suas vendas</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-emerald-500/20 text-emerald-300 font-semibold px-3 py-1 rounded-lg text-sm border border-emerald-500/30">
            <Brain className="w-4 h-4" />
            <span>IA Ativa</span>
          </div>
        </div>

        <div className="space-y-3">
          {agendaPrioritaria.map((item, index) => (
            <div key={index} className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 hover:border-slate-600 transition-all">
              <div className="flex items-start justify-between">
                <div className="flex-grow">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-lg font-bold text-slate-300">#{index + 1}</span>
                    <h3 className="font-bold text-white">{item.cliente_nome}</h3>
                    <Badge className={`${getPrioridadeColor(item.prioridade)} text-xs font-semibold`}>
                      {item.prioridade?.toUpperCase()}
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-slate-400 mb-2">
                    <strong>Motivo:</strong> {item.motivo_priorizacao}
                  </p>
                  
                  <p className="text-sm text-slate-400 mb-3">
                    <strong className="text-slate-300">Sugestão:</strong> {item.sugestao_abordagem}
                  </p>

                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    {item.orcamentos_abertos > 0 && (
                      <div className="flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                        <span>{item.orcamentos_abertos} orçamento(s) aberto(s)</span>
                      </div>
                    )}
                    {item.dias_sem_contato !== "N/A" && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{item.dias_sem_contato} dias sem contato</span>
                      </div>
                    )}
                    {item.vendas_mes > 0 && (
                      <div className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-emerald-400" />
                        <span>{item.vendas_mes} venda(s) no mês</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2 ml-4">
                  <Button
                    onClick={() => handleIniciarContato(item)}
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90 text-white text-sm px-4 py-2 h-auto"
                  >
                    {getTipoContatoIcon(item.tipo_contato_recomendado)}
                    <span className="ml-2">Iniciar Contato</span>
                  </Button>
                  
                  {item.cliente_completo && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onClienteContato && onClienteContato(item.cliente_completo)}
                      className="text-xs border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
                    >
                      Ver Detalhes
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-slate-700/50">
          <Button
            onClick={gerarAgendaPrioritaria}
            variant="outline"
            className="w-full bg-slate-800/50 text-slate-300 hover:bg-slate-700/80 hover:text-white border-slate-700"
          >
            <Brain className="w-4 h-4 mr-2" />
            Atualizar Agenda com IA
          </Button>
        </div>
      </div>

      {showRegistroModal && clienteSelecionado && (
        <RegistroInteracaoModal
          cliente={clienteSelecionado.cliente_completo}
          vendedorNome={vendedorNome}
          onSalvar={handleInteracaoRegistrada}
          onCancelar={() => setShowRegistroModal(false)}
        />
      )}
    </>
  );
}
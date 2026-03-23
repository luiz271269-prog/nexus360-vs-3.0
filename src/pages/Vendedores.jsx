import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Users,
  Plus,
  TrendingUp,
  Target,
  Award,
  Phone,
  MessageSquare,
  Mail,
  Edit,
  Trash2,
  Brain,
  Zap,
  AlertCircle,
  CheckCircle
} from "lucide-react";
import VendedorForm from "../components/vendedores/VendedorForm";
import VendedorTable from "../components/vendedores/VendedorTable";
import { toast } from "sonner";
import LembretesIAContextualizados from '../components/global/LembretesIAContextualizados';
import AlertasInteligentesIA from '../components/global/AlertasInteligentesIA';
import BotaoNexusFlutuante from '../components/global/BotaoNexusFlutuante';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function Vendedores() {
  const navigate = useNavigate();
  const [vendedores, setVendedores] = useState([]);
  const [vendedoresComMetricas, setVendedoresComMetricas] = useState([]);
  const [usuario, setUsuario] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingVendedor, setEditingVendedor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analisandoIA, setAnalisandoIA] = useState(false);
  const [insightsIA, setInsightsIA] = useState(null);
  const [lembretesIA, setLembretesIA] = useState([]);
  const [alertasIA, setAlertasIA] = useState([]);

  // Initial data load and reminder generation
  useEffect(() => {
    carregarDados();
  }, []);

  /**
   * Generates managerial AI-contextualized reminders.
   * This function now returns an array of lembretes instead of setting state directly.
   * @param {Vendedor[]} vendedoresData
   * @param {TarefaInteligente[]} tarefas
   * @param {Venda[]} vendas
   * @param {Orcamento[]} orcamentos
   * @param {Interacao[]} interacoes
   * @returns {Array} An array of lembrete objects.
   */
  const gerarLembretesGerenciais = (vendedoresData, tarefas, vendas, orcamentos, interacoes) => {
    const lembretes = [];
    const dataHoje = new Date();

    // Vendedor com muitas tarefas atrasadas
    vendedoresData.forEach(vendedor => {
      const tarefasAtrasadas = tarefas.filter(t =>
        t.vendedor_responsavel === vendedor.nome &&
        t.status === 'pendente' &&
        t.data_prazo && new Date(t.data_prazo) < dataHoje
      );

      if (tarefasAtrasadas.length >= 5) {
        lembretes.push({
          id: `tarefas_atrasadas_${vendedor.id}`,
          prioridade: 'alta',
          titulo: `${vendedor.nome}: ${tarefasAtrasadas.length} tarefas atrasadas`,
          descricao: `Vendedor pode estar sobrecarregado ou precisando de apoio`,
          acao_sugerida: 'Verificar e redistribuir carga de trabalho',
          entidade_relacionada: 'Vendedor',
          onAcao: () => {
            toast.info(`📋 Analisando tarefas de ${vendedor.nome}`);
            console.log(`Gerente clicou para analisar tarefas de ${vendedor.nome}`);
            // This specific action would likely require a refresh or navigation
          }
        });
      }
    });

    // Vendedor com baixa taxa de conversão em segmento específico
    vendedoresData.forEach(vendedor => {
      const vendasVendedor = vendas.filter(v => v.vendedor === vendedor.nome);
      const orcamentosVendedor = orcamentos.filter(o => o.vendedor === vendedor.nome);

      const taxaConversao = orcamentosVendedor.length > 0
        ? (vendasVendedor.length / orcamentosVendedor.length) * 100
        : 0;

      if (taxaConversao < 20 && orcamentosVendedor.length > 10) {
        lembretes.push({
          id: `baixa_conversao_${vendedor.id}`,
          prioridade: 'media',
          titulo: `${vendedor.nome}: Taxa de conversão baixa (${Math.round(taxaConversao)}%)`,
          descricao: `Pode precisar de treinamento ou ajuste de estratégia`,
          acao_sugerida: 'Oferecer mentoria e treinamento',
          entidade_relacionada: 'Vendedor',
          onAcao: () => {
            toast.info(`🎓 Agendando sessão de treinamento para ${vendedor.nome}`);
            console.log(`Gerente clicou para oferecer mentoria a ${vendedor.nome}`);
          }
        });
      }
    });

    // Vendedor que não usou funcionalidades de IA
    vendedoresData.forEach(vendedor => {
      const usouIA = interacoes.some(i =>
        i.vendedor === vendedor.nome &&
        (i.acao_ia || i.descricao?.includes('IA')) // Placeholder for IA related interaction
      );

      if (!usouIA && vendedor.status === 'ativo') {
        lembretes.push({
          id: `nao_usa_ia_${vendedor.id}`,
          prioridade: 'baixa',
          titulo: `${vendedor.nome}: Não está usando recursos de IA`,
          descricao: `Pode ganhar produtividade com automações e sugestões`,
          acao_sugerida: 'Oferecer treinamento em IA',
          entidade_relacionada: 'Vendedor',
          onAcao: () => {
            navigate('/nexus-command-center'); // Use navigate
            toast.success('🤖 Abrindo tutorial de recursos de IA');
          }
        });
      }
    });

    // Oportunidade de otimizar distribuição de leads
    const cargaTrabalho = vendedoresData.map(v => ({
      vendedor: v,
      carga: v.carga_trabalho_atual || 0,
      capacidade: v.capacidade_maxima || 20
    }));

    const sobrecarregados = cargaTrabalho.filter(c => c.carga >= c.capacidade * 0.9);
    const ociosos = cargaTrabalho.filter(c => c.carga <= c.capacidade * 0.3);

    if (sobrecarregados.length > 0 && ociosos.length > 0) {
      lembretes.push({
        id: 'otimizar_distribuicao',
        prioridade: 'alta',
        titulo: `Desbalanceamento de carga detectado`,
        descricao: `${sobrecarregados.length} vendedor(es) sobrecarregado(s) e ${ociosos.length} ocioso(s)`,
        acao_sugerida: 'Redistribuir leads para equilibrar',
        entidade_relacionada: 'Sistema',
        onAcao: () => {
          navigate('/roteamento-inteligente'); // Use navigate
          toast.info('⚖️ Abrindo sistema de roteamento inteligente');
        }
      });
    }

    return lembretes;
  };

  /**
   * Generates specific AI-contextualized reminders related to seller performance and workload.
   * This function now returns an array of lembretes instead of setting state directly.
   * It relies on pre-calculated metrics.
   * @param {Vendedor[]} vendedoresComMetricasData - Vendedor objects with calculated metrics.
   * @param {TarefaInteligente[]} tarefasData - All intelligent tasks.
   * @returns {Array} An array of lembrete objects.
   */
  const gerarLembretesVendedores = (vendedoresComMetricasData, tarefasData) => {
    const lembretes = [];

    // Vendedores sobrecarregados (using original properties from the extended object)
    const sobrecarregados = vendedoresComMetricasData.filter(v =>
      (v.carga_trabalho_atual !== undefined && v.capacidade_maxima !== undefined) &&
      v.carga_trabalho_atual >= (v.capacidade_maxima * 0.9)
    );

    if (sobrecarregados.length > 0) {
      lembretes.push({
        id: 'vendedores_sobrecarregados',
        prioridade: 'alta',
        titulo: `${sobrecarregados.length} vendedor(es) sobrecarregado(s)`,
        descricao: `Carga de trabalho acima de 90% da capacidade`,
        acao_sugerida: 'Redistribuir leads',
        metadata: { vendedores: sobrecarregados.length },
        onAcao: () => {
          toast.warning('⚠️ Considere redistribuir leads ou expandir a equipe');
          // This action might involve navigating or triggering another process
        }
      });
    }

    // Vendedores com baixa performance (using calculated metrics)
    const baixaPerformance = vendedoresComMetricasData.filter(v =>
      v.metricas?.taxaConversao !== undefined &&
      v.metricas.taxaConversao < 20 &&
      v.metricas.quantidadeOrcamentos > 0 // Only consider if they had actual opportunities
    );

    if (baixaPerformance.length > 0) {
      lembretes.push({
        id: 'vendedores_baixa_performance',
        prioridade: 'media',
        titulo: `${baixaPerformance.length} vendedor(es) precisando suporte`,
        descricao: `Taxa de conversão abaixo de 20%`,
        acao_sugerida: 'Agendar treinamento',
        metadata: { vendedores: baixaPerformance.length },
        onAcao: () => {
          toast.info('💡 Considere mentoria ou treinamento focado');
        }
      });
    }

    return lembretes;
  };

  /**
   * Generates intelligent AI alerts for all users based on vendedor performance and workload.
   * @param {Vendedor[]} vendedoresComMetricasData - Vendedor objects with calculated metrics.
   * @returns {Array} An array of alert objects.
   */
  const gerarAlertasIA = (vendedoresComMetricasData) => {
    const alertas = [];

    vendedoresComMetricasData.forEach(vendedor => {
      // Meta não cumprida
      if (vendedor.meta_mensal && vendedor.metricas.faturamento < vendedor.meta_mensal * 0.8) {
        alertas.push({
          id: `meta_${vendedor.id}`,
          prioridade: 'alta',
          titulo: `${vendedor.nome} - Meta em Risco`,
          descricao: `Atingiu apenas ${Math.round((vendedor.metricas.faturamento / vendedor.meta_mensal) * 100)}% da meta mensal`,
          acao_sugerida: 'Ver Detalhes',
          onAcao: () => handleEditar(vendedor)
        });
      }

      // Capacidade sobrecarregada
      if (vendedor.carga_trabalho_atual !== undefined && vendedor.capacidade_maxima !== undefined &&
          vendedor.carga_trabalho_atual > vendedor.capacidade_maxima * 0.9) {
        alertas.push({
          id: `carga_${vendedor.id}`,
          prioridade: 'critica',
          titulo: `${vendedor.nome} - Sobrecarga`,
          descricao: `${vendedor.carga_trabalho_atual}/${vendedor.capacidade_maxima} leads atribuídos`,
          acao_sugerida: 'Redistribuir Leads',
          onAcao: () => toast.info('🔄 Redistribuição de leads sugerida')
        });
      }

      // Performance baixa (taxa de conversão)
      if (vendedor.metricas.taxaConversao !== undefined && vendedor.metricas.taxaConversao < 20 && vendedor.metricas.quantidadeOrcamentos > 0) {
        alertas.push({
          id: `conversao_${vendedor.id}`,
          prioridade: 'media',
          titulo: `${vendedor.nome} - Taxa de Conversão Baixa`,
          descricao: `Apenas ${vendedor.metricas.taxaConversao}% de conversão`,
          acao_sugerida: 'Agendar Treinamento',
          onAcao: () => toast.info('📚 Treinamento recomendado')
        });
      }
    });

    return alertas;
  };

  const carregarDados = async () => {
    setLoading(true);
    try {
      // Fetch user first to determine role
      const user = await base44.auth.me();
      setUsuario(user);

      // Fetch all other data concurrently
      const [vendedoresData, vendasData, orcamentosData, interacoesData, tarefasData, usuariosData] = await Promise.all([
        base44.entities.Vendedor.list(),
        base44.entities.Venda.list('-data_venda', 500),
        base44.entities.Orcamento.list('-data_orcamento', 500),
        base44.entities.Interacao.list('-data_interacao', 1000),
        base44.entities.TarefaInteligente.list('-data_prazo', 500),
        base44.entities.User.list()
      ]);

      setVendedores(vendedoresData);

      // Calcular métricas por vendedor
      const vendedoresComCalculo = vendedoresData.map(vendedor => {
        // Resolver nome via user_id ou fallback para campo nome legado
        const usuarioVinculado = vendedor.user_id
          ? usuariosData.find(u => u.id === vendedor.user_id)
          : usuariosData.find(u => u.email === vendedor.email);
        const nomeVendedor = usuarioVinculado?.full_name || vendedor.nome || vendedor.email || '—';

        const vendasVendedor = vendasData.filter(v => v.vendedor === nomeVendedor || v.vendedor === vendedor.nome);
        const orcamentosVendedor = orcamentosData.filter(o => o.vendedor === nomeVendedor || o.vendedor === vendedor.nome);
        const interacoesVendedor = interacoesData.filter(i => i.vendedor === nomeVendedor || i.vendedor === vendedor.nome);

        const faturamento = vendasVendedor.reduce((sum, v) => sum + (v.valor_total || 0), 0);
        const percentualMeta = vendedor.meta_mensal > 0 ?
          Math.round((faturamento / vendedor.meta_mensal) * 100) : 0;

        const hoje = new Date().toISOString().slice(0, 10);
        const interacoesHoje = interacoesVendedor.filter(i =>
          i.data_interacao && i.data_interacao.slice(0, 10) === hoje
        );

        const ligacoesHoje = interacoesHoje.filter(i => i.tipo_interacao === 'ligacao').length;
        const whatsappHoje = interacoesHoje.filter(i => i.tipo_interacao === 'whatsapp').length;
        const emailsHoje = interacoesHoje.filter(i => i.tipo_interacao === 'email').length;

        // Calcular vendas mensais dos últimos 4 meses
        const vendasMensais = {};
        const faturamentoTotalCalculated = vendasVendedor.reduce((sum, v) => sum + (v.valor_total || 0), 0);

        // Obter os últimos 4 meses
        const meses = [];
        for (let i = 0; i < 4; i++) {
          const data = new Date();
          data.setMonth(data.getMonth() - i);
          const mesAno = data.toISOString().slice(0, 7); // YYYY-MM
          meses.push(mesAno);
          vendasMensais[mesAno] = 0;
        }

        // Agrupar vendas por mês
        vendasVendedor.forEach(venda => {
          if (venda.data_venda) {
            const mesVenda = venda.data_venda.slice(0, 7); // YYYY-MM
            if (vendasMensais.hasOwnProperty(mesVenda)) {
              vendasMensais[mesVenda] += (venda.valor_total || 0);
            }
          }
        });

        return {
          ...vendedor,
          nome: nomeVendedor, // sempre expor nome resolvido
          metricas: {
            faturamento,
            percentualMeta,
            quantidadeVendas: vendasVendedor.length,
            quantidadeOrcamentos: orcamentosVendedor.length,
            taxaConversao: orcamentosVendedor.length > 0 ?
              Math.round((vendasVendedor.length / orcamentosVendedor.length) * 100) : 0,
            ligacoesHoje,
            whatsappHoje,
            emailsHoje,
            metaLigacoes: vendedor.meta_ligacoes_diarias || 10,
            metaWhatsapp: vendedor.meta_whatsapp_diarios || 5,
            metaEmails: vendedor.meta_emails_diarias || 3, // Assuming this is emails_diarias
            progressoLigacoes: Math.min(100, (ligacoesHoje / (vendedor.meta_ligacoes_diarias || 10)) * 100),
            progressoWhatsapp: Math.min(100, (whatsappHoje / (vendedor.meta_whatsapp_diarios || 5)) * 100),
            progressoEmails: Math.min(100, (emailsHoje / (vendedor.meta_emails_diarias || 3)) * 100) // Assuming emails_diarias
          },
          vendasMensais,
          faturamentoTotal: faturamentoTotalCalculated
        };
      });

      setVendedoresComMetricas(vendedoresComCalculo);

      // Aggregate all lembretes if user is an admin
      let allLembretes = [];
      if (user?.role === 'admin') {
        const gerencialLembretes = gerarLembretesGerenciais(vendedoresData, tarefasData, vendasData, orcamentosData, interacoesData);
        allLembretes = allLembretes.concat(gerencialLembretes);

        // Pass calculated data to gerarLembretesVendedores
        const vendedorLembretes = gerarLembretesVendedores(vendedoresComCalculo, tarefasData);
        allLembretes = allLembretes.concat(vendedorLembretes);
      }
      setLembretesIA(allLembretes);

      // Generate general alerts for all users
      const generatedAlerts = gerarAlertasIA(vendedoresComCalculo);
      setAlertasIA(generatedAlerts);

    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar vendedores");
    } finally {
      setLoading(false);
    }
  };

  const handleAnalisarComIA = async () => {
    setAnalisandoIA(true);
    try {
      const contexto = vendedoresComMetricas.map(v => ({
        nome: v.nome,
        faturamento: v.metricas.faturamento,
        percentualMeta: v.metricas.percentualMeta,
        vendas: v.metricas.quantidadeVendas,
        taxaConversao: v.metricas.taxaConversao,
        atividades: {
          ligacoes: v.metricas.ligacoesHoje,
          whatsapp: v.metricas.whatsappHoje,
          emails: v.metricas.emailsHoje
        }
      }));

      // Dynamically import InvokeLLM
      const { InvokeLLM } = await import("@/integrations/Core");
      const analise = await InvokeLLM({
        prompt: `Você é um analista de vendas sênior. Analise a performance da equipe comercial e forneça insights acionáveis.

**Dados da Equipe:**
${JSON.stringify(contexto, null, 2)}

Forneça:
1. Análise geral da performance da equipe
2. Top 3 destaques positivos (quem está indo bem e por quê)
3. Top 3 alertas (quem precisa de atenção e o que fazer)
4. Recomendações específicas para melhorar a taxa de conversão geral
5. Sugestões de treinamento ou coaching baseadas nos dados`,
        response_json_schema: {
          type: "object",
          properties: {
            analise_geral: { type: "string" },
            destaques_positivos: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  vendedor: { type: "string" },
                  motivo: { type: "string" },
                  acao_sugerida: { type: "string" }
                }
              }
            },
            alertas: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  vendedor: { type: "string" },
                  problema: { type: "string" },
                  acao_corretiva: { type: "string" },
                  urgencia: { type: "string", enum: ["baixa", "media", "alta", "critica"] }
                }
              }
            },
            recomendacoes_gerais: {
              type: "array",
              items: { type: "string" }
            },
            sugestoes_treinamento: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  topico: { type: "string" },
                  justificativa: { type: "string" }
                }
              }
            }
          }
        }
      });

      setInsightsIA(analise);
      toast.success("Análise concluída! Veja os insights da IA.");

    } catch (error) {
      console.error("Erro na análise IA:", error);
      toast.error("Erro ao gerar análise da IA");
    }
    setAnalisandoIA(false);
  };

  const handleSalvar = async (data) => {
    try {
      if (editingVendedor) {
        await base44.entities.Vendedor.update(editingVendedor.id, data);
        toast.success('Vendedor atualizado!');
      } else {
        await base44.entities.Vendedor.create(data);
        toast.success('Vendedor criado!');
      }
      setShowForm(false);
      setEditingVendedor(null);
      await carregarDados();
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar vendedor");
    }
  };

  const handleEditar = (vendedor) => {
    setEditingVendedor(vendedor);
    setShowForm(true);
  };

  const handleExcluir = async (vendedorId) => {
    if (!confirm('Tem certeza que deseja excluir este vendedor?')) return;

    try {
      await base44.entities.Vendedor.delete(vendedorId);
      toast.success('Vendedor excluído!');
      await carregarDados();
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast.error("Erro ao excluir vendedor");
    }
  };

  const isAdmin = usuario?.role === 'admin';

  return (
    <div className="space-y-4 md:space-y-6 p-3 md:p-6">
      {/* Header com Gradiente Laranja */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-xl border-2 border-slate-700/50 p-4 md:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-orange-500/50 flex-shrink-0">
              <Users className="w-6 h-6 md:w-9 md:h-9 text-white" />
            </div>
            <div>
              <h1 className="text-xl md:text-3xl font-bold bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 bg-clip-text text-transparent">
                Gestão de Vendedores
              </h1>
              <p className="text-slate-300 mt-1 text-sm md:text-base">
                Equipe de vendas e performance em tempo real
              </p>
            </div>
          </div>

          <div className="flex gap-2 md:gap-3 flex-wrap">
              <Button
                onClick={handleAnalisarComIA}
                disabled={analisandoIA}
                variant="outline"
                className="bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200 text-slate-800 hover:text-slate-900"
              >
                {analisandoIA ? (
                  <><Brain className="w-4 h-4 mr-2 animate-pulse" /> Analisando...</>
                ) : (
                  <><Brain className="w-4 h-4 mr-2" /> Análise com IA</>
                )}
              </Button>

              {isAdmin && (
                <Button
                  onClick={() => {
                    setEditingVendedor(null);
                    setShowForm(true);
                  }}
                  className="bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 hover:from-amber-500 hover:via-orange-600 hover:to-red-600 text-white font-bold shadow-lg shadow-orange-500/30"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Novo Vendedor
                </Button>
              )}
            </div>
        </div>
      </div>

      <BotaoNexusFlutuante
        contadorLembretes={alertasIA.length}
        onClick={() => {
          if (alertasIA.length > 0) {
            toast.info(`📊 ${alertasIA.length} alertas de vendedores`);
          }
        }}
      />

      <AlertasInteligentesIA
        alertas={alertasIA}
        titulo="Vendedores IA"
        onAcaoExecutada={(alerta) => {
          if (alerta.id === 'fechar_tudo') {
            setAlertasIA([]);
            return;
          }
          setAlertasIA(prev => prev.filter(a => a.id !== alerta.id));
        }}
      />

      {/* 🆕 LEMBRETES DA IA - APENAS PARA GERENTES (FLOATING PANEL) */}
      {usuario?.role === 'admin' && lembretesIA.length > 0 && (
        <LembretesIAContextualizados
          lembretes={lembretesIA}
          onAcaoExecutada={(lembrete) => {
            if (lembrete.id === 'fechar_tudo') {
              setLembretesIA([]);
              return;
            }
            // Remove the executed lembrete from the list
            setLembretesIA(prev => prev.filter(l => l.id !== lembrete.id));
            // No full data reload here, as per the outline's specific instruction for this component.
          }}
        />
      )}

      {/* Insights da IA */}
      {insightsIA && (
        <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-900">
              <Brain className="w-6 h-6" />
              Insights da IA - Análise da Equipe
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Análise Geral */}
            <div>
              <h3 className="font-semibold text-slate-800 mb-2">📊 Análise Geral</h3>
              <p className="text-slate-600 leading-relaxed">{insightsIA.analise_geral}</p>
            </div>

            {/* Destaques Positivos */}
            {insightsIA.destaques_positivos?.length > 0 && (
              <div>
                <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Destaques Positivos
                </h3>
                <div className="grid gap-3">
                  {insightsIA.destaques_positivos.map((destaque, idx) => (
                    <Card key={idx} className="bg-green-50 border-green-200">
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-3">
                          <Award className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <h4 className="font-semibold text-green-900">{destaque.vendedor}</h4>
                            <p className="text-sm text-green-700 mt-1">{destaque.motivo}</p>
                            <Badge className="mt-2 bg-green-600 text-white">
                              {destaque.acao_sugerida}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Alertas */}
            {insightsIA.alertas?.length > 0 && (
              <div>
                <h3 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Alertas e Ações Corretivas
                </h3>
                <div className="grid gap-3">
                  {insightsIA.alertas.map((alerta, idx) => (
                    <Card key={idx} className={`border-2 ${
                      alerta.urgencia === 'critica' ? 'bg-red-50 border-red-300' :
                      alerta.urgencia === 'alta' ? 'bg-orange-50 border-orange-300' :
                      'bg-yellow-50 border-yellow-300'
                    }`}>
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-3">
                          <Zap className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                            alerta.urgencia === 'critica' ? 'text-red-600' :
                            alerta.urgencia === 'alta' ? 'text-orange-600' :
                            'text-yellow-600'
                          }`} />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold text-slate-900">{alerta.vendedor}</h4>
                              <Badge className={
                                alerta.urgencia === 'critica' ? 'bg-red-600 text-white' :
                                alerta.urgencia === 'alta' ? 'bg-orange-600 text-white' :
                                'bg-yellow-600 text-white'
                              }>
                                {alerta.urgencia.toUpperCase()}
                              </Badge>
                            </div>
                            <p className="text-sm text-slate-700 mt-1">{alerta.problema}</p>
                            <div className="mt-2 p-2 bg-white/50 rounded-lg">
                              <p className="text-xs font-medium text-slate-800">
                                💡 Ação recomendada: {alerta.acao_corretiva}
                              </p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Recomendações Gerais */}
            <div>
              <h3 className="font-semibold text-indigo-800 mb-3">💡 Recomendações Gerais</h3>
              <ul className="space-y-2">
                {insightsIA.recomendacoes_gerais?.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-slate-700">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Sugestões de Treinamento */}
            {insightsIA.sugestoes_treinamento?.length > 0 && (
              <div>
                <h3 className="font-semibold text-blue-800 mb-3">📚 Sugestões de Treinamento</h3>
                <div className="grid gap-2">
                  {insightsIA.sugestoes_treinamento.map((sugestao, idx) => (
                    <Card key={idx} className="bg-blue-50 border-blue-200">
                      <CardContent className="pt-3 pb-3">
                        <h4 className="font-semibold text-blue-900 text-sm">{sugestao.topico}</h4>
                        <p className="text-xs text-blue-700 mt-1">{sugestao.justificativa}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cards de Performance */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {vendedoresComMetricas.slice(0, 4).map((vendedor) => (
          <Card key={vendedor.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {vendedor.foto_url ? (
                    <img
                      src={vendedor.foto_url}
                      alt={vendedor.nome}
                      className="w-12 h-12 rounded-full object-cover border-2 border-indigo-200"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-slate-900">{vendedor.nome}</h3>
                    <p className="text-xs text-slate-500">{vendedor.codigo}</p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Meta */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-600">Meta Mensal</span>
                  <span className="font-semibold text-indigo-600">
                    {vendedor.metricas.percentualMeta}%
                  </span>
                </div>
                <Progress value={vendedor.metricas.percentualMeta} className="h-2" />
                <p className="text-xs text-slate-500 mt-1">
                  R$ {vendedor.metricas.faturamento.toLocaleString('pt-BR')} de R$ {(vendedor.meta_mensal || 0).toLocaleString('pt-BR')}
                </p>
              </div>

              {/* Atividades Hoje */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Phone className="w-4 h-4 text-blue-600 mx-auto mb-1" />
                  <p className="text-xs font-semibold text-blue-900">
                    {vendedor.metricas.ligacoesHoje}/{vendedor.metricas.metaLigacoes}
                  </p>
                </div>
                <div className="p-2 bg-green-50 rounded-lg">
                  <MessageSquare className="w-4 h-4 text-green-600 mx-auto mb-1" />
                  <p className="text-xs font-semibold text-green-900">
                    {vendedor.metricas.whatsappHoje}/{vendedor.metricas.metaWhatsapp}
                  </p>
                </div>
                <div className="p-2 bg-purple-50 rounded-lg">
                  <Mail className="w-4 h-4 text-purple-600 mx-auto mb-1" />
                  <p className="text-xs font-semibold text-purple-900">
                    {vendedor.metricas.emailsHoje}/{vendedor.metricas.metaEmails}
                  </p>
                </div>
              </div>

              {/* Conversão */}
              <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                <span className="text-xs text-slate-600">Taxa Conversão</span>
                <Badge variant="outline" className="font-semibold">
                  {vendedor.metricas.taxaConversao}%
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabela Completa */}
      <Card>
        <CardHeader>
          <CardTitle>Todos os Vendedores</CardTitle>
        </CardHeader>
        <CardContent>
          <VendedorTable
            vendedores={vendedoresComMetricas}
            onEditar={handleEditar}
            onExcluir={handleExcluir}
            isAdmin={isAdmin}
          />
        </CardContent>
      </Card>

      {/* Modal de Formulário */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto">
            <VendedorForm
              vendedor={editingVendedor}
              onSalvar={handleSalvar}
              onCancelar={() => {
                setShowForm(false);
                setEditingVendedor(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
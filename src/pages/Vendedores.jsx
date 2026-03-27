import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, Plus, TrendingUp, Target, Award, Phone, MessageSquare, Mail, Brain, Zap, AlertCircle, CheckCircle } from "lucide-react";
import VendedorForm from "../components/vendedores/VendedorForm";
import VendedorTable from "../components/vendedores/VendedorTable";
import { toast } from "sonner";
import BotaoNexusFlutuante from '../components/global/BotaoNexusFlutuante';
import AlertasInteligentesIA from '../components/global/AlertasInteligentesIA';

export default function Vendedores() {
  const [vendedores, setVendedores] = useState([]); // users com codigo preenchido
  const [vendedoresComMetricas, setVendedoresComMetricas] = useState([]);
  const [usuario, setUsuario] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingVendedor, setEditingVendedor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analisandoIA, setAnalisandoIA] = useState(false);
  const [insightsIA, setInsightsIA] = useState(null);
  const [alertasIA, setAlertasIA] = useState([]);

  useEffect(() => { carregarDados(); }, []);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const user = await base44.auth.me();
      setUsuario(user);

      const [todosUsuarios, vendasData, orcamentosData, interacoesData] = await Promise.all([
        base44.entities.User.list(),
        base44.entities.Venda.list('-data_venda', 500),
        base44.entities.Orcamento.list('-data_orcamento', 500),
        base44.entities.Interacao.list('-data_interacao', 1000),
      ]);

      // Vendedores = Users que têm o campo "codigo" preenchido OU attendant_sector === 'vendas'
      const vendedoresData = todosUsuarios.filter(u => u.codigo || u.attendant_sector === 'vendas');
      setVendedores(vendedoresData);

      const vendedoresComCalculo = vendedoresData.map(vendedor => {
        const nomeVendedor = vendedor.full_name || vendedor.display_name || vendedor.email || '—';

        const vendasVendedor = vendasData.filter(v =>
          v.vendedor_id === vendedor.id || v.vendedor === nomeVendedor
        );
        const orcamentosVendedor = orcamentosData.filter(o =>
          o.vendedor_id === vendedor.id || o.vendedor === nomeVendedor
        );
        const interacoesVendedor = interacoesData.filter(i =>
          i.vendedor_id === vendedor.id || i.vendedor === nomeVendedor
        );

        const faturamento = vendasVendedor.reduce((sum, v) => sum + (v.valor_total || 0), 0);
        const percentualMeta = vendedor.meta_mensal > 0 ? Math.round((faturamento / vendedor.meta_mensal) * 100) : 0;

        const hoje = new Date().toISOString().slice(0, 10);
        const interacoesHoje = interacoesVendedor.filter(i => i.data_interacao?.slice(0, 10) === hoje);
        const ligacoesHoje = interacoesHoje.filter(i => i.tipo_interacao === 'ligacao').length;
        const whatsappHoje = interacoesHoje.filter(i => i.tipo_interacao === 'whatsapp').length;
        const emailsHoje = interacoesHoje.filter(i => i.tipo_interacao === 'email').length;

        const vendasMensais = {};
        for (let i = 0; i < 4; i++) {
          const d = new Date(); d.setMonth(d.getMonth() - i);
          vendasMensais[d.toISOString().slice(0, 7)] = 0;
        }
        vendasVendedor.forEach(v => {
          if (v.data_venda) {
            const mes = v.data_venda.slice(0, 7);
            if (vendasMensais.hasOwnProperty(mes)) vendasMensais[mes] += (v.valor_total || 0);
          }
        });

        return {
          ...vendedor,
          nome: nomeVendedor,
          status: vendedor.status_vendedor || 'ativo',
          metricas: {
            faturamento, percentualMeta,
            quantidadeVendas: vendasVendedor.length,
            quantidadeOrcamentos: orcamentosVendedor.length,
            taxaConversao: orcamentosVendedor.length > 0 ? Math.round((vendasVendedor.length / orcamentosVendedor.length) * 100) : 0,
            ligacoesHoje, whatsappHoje, emailsHoje,
            metaLigacoes: vendedor.meta_ligacoes_diarias || 10,
            metaWhatsapp: vendedor.meta_whatsapp_diarios || 5,
            metaEmails: vendedor.meta_emails_diarios || 3,
          },
          vendasMensais,
          faturamentoTotal: faturamento
        };
      });

      setVendedoresComMetricas(vendedoresComCalculo);

      // Alertas
      const alertas = [];
      vendedoresComCalculo.forEach(v => {
        if (v.meta_mensal && v.metricas.faturamento < v.meta_mensal * 0.8) {
          alertas.push({ id: `meta_${v.id}`, prioridade: 'alta', titulo: `${v.nome} - Meta em Risco`, descricao: `Atingiu ${v.metricas.percentualMeta}% da meta mensal`, acao_sugerida: 'Ver Detalhes', onAcao: () => handleEditar(v) });
        }
        if (v.carga_trabalho_atual > (v.capacidade_maxima || 20) * 0.9) {
          alertas.push({ id: `carga_${v.id}`, prioridade: 'critica', titulo: `${v.nome} - Sobrecarga`, descricao: `${v.carga_trabalho_atual}/${v.capacidade_maxima} leads`, acao_sugerida: 'Redistribuir', onAcao: () => toast.info('🔄 Redistribuição sugerida') });
        }
      });
      setAlertasIA(alertas);

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
        nome: v.nome, faturamento: v.metricas.faturamento, percentualMeta: v.metricas.percentualMeta,
        taxaConversao: v.metricas.taxaConversao, ligacoes: v.metricas.ligacoesHoje
      }));
      const analise = await base44.integrations.Core.InvokeLLM({
        prompt: `Analise a equipe de vendas e dê insights acionáveis:\n${JSON.stringify(contexto, null, 2)}`,
        response_json_schema: {
          type: "object", properties: {
            analise_geral: { type: "string" },
            destaques_positivos: { type: "array", items: { type: "object", properties: { vendedor: { type: "string" }, motivo: { type: "string" }, acao_sugerida: { type: "string" } } } },
            alertas: { type: "array", items: { type: "object", properties: { vendedor: { type: "string" }, problema: { type: "string" }, acao_corretiva: { type: "string" }, urgencia: { type: "string" } } } },
            recomendacoes_gerais: { type: "array", items: { type: "string" } }
          }
        }
      });
      setInsightsIA(analise);
      toast.success("Análise concluída!");
    } catch (error) {
      toast.error("Erro ao gerar análise da IA");
    }
    setAnalisandoIA(false);
  };

  // Salva diretamente no User
  const handleSalvar = async (data) => {
    try {
      if (editingVendedor) {
        await base44.auth.updateMe ? 
          await base44.entities.User.update(editingVendedor.id, data) :
          await base44.entities.User.update(editingVendedor.id, data);
        toast.success('Vendedor atualizado!');
      } else {
        // Novo vendedor = convidar usuário (não cria diretamente)
        toast.info('Para adicionar um vendedor, convide o usuário e depois edite seu perfil.');
      }
      setShowForm(false);
      setEditingVendedor(null);
      await carregarDados();
    } catch (error) {
      toast.error("Erro ao salvar");
    }
  };

  const handleEditar = (vendedor) => { setEditingVendedor(vendedor); setShowForm(true); };

  const isAdmin = usuario?.role === 'admin';

  return (
    <div className="space-y-4 md:space-y-6 p-3 md:p-6">
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-xl border-2 border-slate-700/50 p-4 md:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-orange-500/50 flex-shrink-0">
              <Users className="w-6 h-6 md:w-9 md:h-9 text-white" />
            </div>
            <div>
              <h1 className="text-xl md:text-3xl font-bold bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 bg-clip-text text-transparent">Gestão de Vendedores</h1>
              <p className="text-slate-300 mt-1 text-sm md:text-base">Equipe de vendas e performance em tempo real</p>
            </div>
          </div>
          <div className="flex gap-2 md:gap-3 flex-wrap">
            <Button onClick={handleAnalisarComIA} disabled={analisandoIA} variant="outline" className="bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200 text-slate-800">
              {analisandoIA ? <><Brain className="w-4 h-4 mr-2 animate-pulse" /> Analisando...</> : <><Brain className="w-4 h-4 mr-2" /> Análise com IA</>}
            </Button>
          </div>
        </div>
      </div>

      <AlertasInteligentesIA alertas={alertasIA} titulo="Vendedores IA" onAcaoExecutada={(a) => setAlertasIA(prev => prev.filter(x => x.id !== a.id))} />

      {insightsIA && (
        <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50">
          <CardHeader><CardTitle className="flex items-center gap-2 text-purple-900"><Brain className="w-6 h-6" />Insights da IA</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-600">{insightsIA.analise_geral}</p>
            {insightsIA.destaques_positivos?.map((d, i) => (
              <Card key={i} className="bg-green-50 border-green-200"><CardContent className="pt-4">
                <div className="flex gap-3"><Award className="w-5 h-5 text-green-600 mt-0.5" /><div><h4 className="font-semibold text-green-900">{d.vendedor}</h4><p className="text-sm text-green-700">{d.motivo}</p></div></div>
              </CardContent></Card>
            ))}
            {insightsIA.alertas?.map((a, i) => (
              <Card key={i} className="bg-orange-50 border-orange-200"><CardContent className="pt-4">
                <div className="flex gap-3"><Zap className="w-5 h-5 text-orange-600 mt-0.5" /><div><h4 className="font-semibold">{a.vendedor}</h4><p className="text-sm">{a.problema}</p><p className="text-xs mt-1 font-medium">💡 {a.acao_corretiva}</p></div></div>
              </CardContent></Card>
            ))}
            {insightsIA.recomendacoes_gerais?.map((r, i) => (
              <div key={i} className="flex gap-2"><CheckCircle className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" /><span className="text-sm text-slate-700">{r}</span></div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Cards de Performance */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {vendedoresComMetricas.slice(0, 4).map((v) => (
          <Card key={v.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                {v.foto_url ? (
                  <img src={v.foto_url} alt={v.nome} className="w-12 h-12 rounded-full object-cover border-2 border-indigo-200" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                )}
                <div><h3 className="font-semibold text-slate-900">{v.nome}</h3><p className="text-xs text-slate-500">{v.codigo}</p></div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-600">Meta Mensal</span>
                  <span className="font-semibold text-indigo-600">{v.metricas.percentualMeta}%</span>
                </div>
                <Progress value={v.metricas.percentualMeta} className="h-2" />
                <p className="text-xs text-slate-500 mt-1">R$ {v.metricas.faturamento.toLocaleString('pt-BR')} de R$ {(v.meta_mensal || 0).toLocaleString('pt-BR')}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-blue-50 rounded-lg"><Phone className="w-4 h-4 text-blue-600 mx-auto mb-1" /><p className="text-xs font-semibold text-blue-900">{v.metricas.ligacoesHoje}/{v.metricas.metaLigacoes}</p></div>
                <div className="p-2 bg-green-50 rounded-lg"><MessageSquare className="w-4 h-4 text-green-600 mx-auto mb-1" /><p className="text-xs font-semibold text-green-900">{v.metricas.whatsappHoje}/{v.metricas.metaWhatsapp}</p></div>
                <div className="p-2 bg-purple-50 rounded-lg"><Mail className="w-4 h-4 text-purple-600 mx-auto mb-1" /><p className="text-xs font-semibold text-purple-900">{v.metricas.emailsHoje}/{v.metricas.metaEmails}</p></div>
              </div>
              <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                <span className="text-xs text-slate-600">Taxa Conversão</span>
                <Badge variant="outline" className="font-semibold">{v.metricas.taxaConversao}%</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Todos os Vendedores</CardTitle></CardHeader>
        <CardContent>
          <VendedorTable vendedores={vendedoresComMetricas} onEditar={handleEditar} isAdmin={isAdmin} />
        </CardContent>
      </Card>

      {showForm && editingVendedor && (
        <VendedorForm
          vendedor={editingVendedor}
          onSalvar={handleSalvar}
          onCancelar={() => { setShowForm(false); setEditingVendedor(null); }}
        />
      )}
    </div>
  );
}
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell
} from "recharts";
import {
  Shield,
  CheckCircle,
  AlertTriangle,
  Clock,
  MessageSquare,
  TrendingUp,
  Download,
  FileText,
  Activity
} from "lucide-react";
import { toast } from "sonner";

export default function DashboardConformidade() {
  const [periodo, setPeriodo] = useState('30d');

  const { data: threads = [] } = useQuery({
    queryKey: ['threads-conformidade'],
    queryFn: () => base44.entities.MessageThread.list('-last_message_at', 500),
    initialData: []
  });

  const { data: mensagens = [] } = useQuery({
    queryKey: ['mensagens-conformidade'],
    queryFn: () => base44.entities.Message.list('-created_date', 1000),
    initialData: []
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['templates-conformidade'],
    queryFn: () => base44.entities.WhatsAppTemplate.list(),
    initialData: []
  });

  const { data: integracoes = [] } = useQuery({
    queryKey: ['integracoes-conformidade'],
    queryFn: () => base44.entities.WhatsAppIntegration.list(),
    initialData: []
  });

  const calcularMetricasConformidade = () => {
    const agora = new Date();
    let dataLimite = new Date();
    
    switch(periodo) {
      case '7d':
        dataLimite.setDate(agora.getDate() - 7);
        break;
      case '30d':
        dataLimite.setDate(agora.getDate() - 30);
        break;
      case '90d':
        dataLimite.setDate(agora.getDate() - 90);
        break;
      default:
        dataLimite.setDate(agora.getDate() - 30);
    }

    const mensagensFiltradas = mensagens.filter(m => 
      new Date(m.created_date) >= dataLimite
    );

    const mensagensSistema = mensagensFiltradas.filter(m => 
      m.sender_type === 'user'
    );

    const mensagensDentroJanela = mensagensSistema.filter(m => {
      const thread = threads.find(t => t.id === m.thread_id);
      if (!thread) return false;
      
      const ultimaMsgCliente = mensagens
        .filter(msg => msg.thread_id === thread.id && msg.sender_type === 'contact')
        .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];
      
      if (!ultimaMsgCliente) return false;
      
      const diffHoras = (new Date(m.created_date) - new Date(ultimaMsgCliente.created_date)) / (1000 * 60 * 60);
      return diffHoras <= 24;
    });

    const mensagensViaTemplate = mensagensSistema.filter(m => m.is_template);

    const mensagensConformes = mensagensDentroJanela.length + mensagensViaTemplate.length;
    const taxaConformidade = mensagensSistema.length > 0 
      ? Math.round((mensagensConformes / mensagensSistema.length) * 100)
      : 100;

    const templatesAprovados = templates.filter(t => t.status_meta === 'aprovado').length;
    const templatesPendentes = templates.filter(t => 
      t.status_meta === 'enviado_aprovacao' || t.status_meta === 'rascunho'
    ).length;

    const conversasAtivas = threads.filter(t => 
      t.status === 'aberta' || t.status === 'aguardando_cliente'
    ).length;

    const conversasEmRisco = threads.filter(t => {
      if (!t.janela_24h_expira_em) return false;
      const horasRestantes = (new Date(t.janela_24h_expira_em) - agora) / (1000 * 60 * 60);
      return horasRestantes > 0 && horasRestantes < 2;
    }).length;

    const temposResposta = threads
      .filter(t => t.tempo_primeira_resposta_minutos !== null && t.tempo_primeira_resposta_minutos !== undefined)
      .map(t => t.tempo_primeira_resposta_minutos);
    
    const tempoMedioResposta = temposResposta.length > 0
      ? Math.round(temposResposta.reduce((a, b) => a + b, 0) / temposResposta.length)
      : 0;

    const integracoesAtivas = integracoes.filter(i => i.status === 'conectado').length;
    const integracoesTotal = integracoes.length;

    return {
      taxaConformidade,
      mensagensSistema: mensagensSistema.length,
      mensagensDentroJanela: mensagensDentroJanela.length,
      mensagensViaTemplate: mensagensViaTemplate.length,
      mensagensForaConformidade: mensagensSistema.length - mensagensConformes,
      templatesAprovados,
      templatesPendentes,
      conversasAtivas,
      conversasEmRisco,
      tempoMedioResposta,
      integracoesAtivas,
      integracoesTotal
    };
  };

  const metricas = calcularMetricasConformidade();

  const getDadosConformidadePorDia = () => {
    const diasParaAnalise = periodo === '7d' ? 7 : periodo === '30d' ? 30 : 90;
    const dados = [];
    
    for (let i = diasParaAnalise - 1; i >= 0; i--) {
      const data = new Date();
      data.setDate(data.getDate() - i);
      const dataStr = data.toISOString().split('T')[0];
      
      const mensagensDia = mensagens.filter(m => 
        m.created_date.split('T')[0] === dataStr && m.sender_type === 'user'
      );
      
      const conformesDia = mensagensDia.filter(m => {
        if (m.is_template) return true;
        
        const thread = threads.find(t => t.id === m.thread_id);
        if (!thread) return false;
        
        const ultimaMsgCliente = mensagens
          .filter(msg => msg.thread_id === thread.id && msg.sender_type === 'contact')
          .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];
        
        if (!ultimaMsgCliente) return false;
        
        const diffHoras = (new Date(m.created_date) - new Date(ultimaMsgCliente.created_date)) / (1000 * 60 * 60);
        return diffHoras <= 24;
      });
      
      dados.push({
        data: data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        total: mensagensDia.length,
        conformes: conformesDia.length,
        taxa: mensagensDia.length > 0 ? Math.round((conformesDia.length / mensagensDia.length) * 100) : 100
      });
    }
    
    return dados;
  };

  const dadosConformidade = getDadosConformidadePorDia();

  const dadosDistribuicao = [
    { name: 'Dentro da Janela 24h', value: metricas.mensagensDentroJanela, color: '#10b981' },
    { name: 'Via Template Aprovado', value: metricas.mensagensViaTemplate, color: '#3b82f6' },
    { name: 'Fora de Conformidade', value: metricas.mensagensForaConformidade, color: '#ef4444' }
  ].filter(d => d.value > 0);

  const handleExportarRelatorio = async () => {
    try {
      toast.info("📄 Gerando relatório de conformidade...");
      
      const relatorio = {
        data_geracao: new Date().toISOString(),
        periodo,
        metricas,
        dados_conformidade_diaria: dadosConformidade,
        templates: {
          total: templates.length,
          aprovados: templates.filter(t => t.status_meta === 'aprovado').length,
          pendentes: templates.filter(t => t.status_meta !== 'aprovado').length,
          lista: templates.map(t => ({
            nome: t.nome,
            status: t.status_meta,
            categoria: t.categoria
          }))
        },
        integracoes: {
          total: integracoes.length,
          ativas: integracoes.filter(i => i.status === 'conectado').length,
          lista: integracoes.map(i => ({
            nome: i.nome_instancia,
            status: i.status,
            numero: i.numero_telefone
          }))
        }
      };

      const blob = new Blob([JSON.stringify(relatorio, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio-conformidade-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success("✅ Relatório exportado!");
    } catch (error) {
      console.error('[CONFORMIDADE] Erro ao exportar:', error);
      toast.error("❌ Erro ao exportar relatório");
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-xl border-2 border-slate-700/50 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-green-500/50">
              <Shield className="w-9 h-9 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                Dashboard de Conformidade WhatsApp
              </h1>
              <p className="text-slate-300 mt-1">
                Monitoramento de políticas e regulamentações
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="w-32 bg-white/10 text-white border-white/30">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 dias</SelectItem>
                <SelectItem value="30d">30 dias</SelectItem>
                <SelectItem value="90d">90 dias</SelectItem>
              </SelectContent>
            </Select>

            <Button
              onClick={handleExportarRelatorio}
              className="bg-white/20 hover:bg-white/30 text-white border border-white/30"
            >
              <Download className="w-5 h-5 mr-2" />
              Exportar
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className={`${
          metricas.taxaConformidade >= 95 ? 'border-2 border-green-300 bg-green-50/30' :
          metricas.taxaConformidade >= 80 ? 'border-2 border-amber-300 bg-amber-50/30' :
          'border-2 border-red-300 bg-red-50/30'
        }`}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-slate-600">Taxa de Conformidade</p>
                <p className={`text-3xl font-bold ${
                  metricas.taxaConformidade >= 95 ? 'text-green-600' :
                  metricas.taxaConformidade >= 80 ? 'text-amber-600' :
                  'text-red-600'
                }`}>
                  {metricas.taxaConformidade}%
                </p>
              </div>
              {metricas.taxaConformidade >= 95 ? (
                <CheckCircle className="w-12 h-12 text-green-500" />
              ) : (
                <AlertTriangle className="w-12 h-12 text-amber-500" />
              )}
            </div>
            <Progress value={metricas.taxaConformidade} className="h-2" />
            <p className="text-xs text-slate-500 mt-2">
              {metricas.mensagensSistema} mensagens analisadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Templates Aprovados</p>
                <p className="text-2xl font-bold text-blue-600">
                  {metricas.templatesAprovados}
                </p>
                {metricas.templatesPendentes > 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    {metricas.templatesPendentes} pendentes
                  </p>
                )}
              </div>
              <FileText className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Conversas Ativas</p>
                <p className="text-2xl font-bold text-purple-600">
                  {metricas.conversasAtivas}
                </p>
                {metricas.conversasEmRisco > 0 && (
                  <p className="text-xs text-red-600 mt-1">
                    {metricas.conversasEmRisco} expirando em menos de 2h
                  </p>
                )}
              </div>
              <MessageSquare className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Tempo Médio Resposta</p>
                <p className="text-2xl font-bold text-indigo-600">
                  {metricas.tempoMedioResposta}min
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {metricas.integracoesAtivas}/{metricas.integracoesTotal} integrações ativas
                </p>
              </div>
              <Clock className="w-8 h-8 text-indigo-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-green-600" />
              Conformidade ao Longo do Tempo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dadosConformidade}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="data" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="taxa" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  name="Taxa de Conformidade (%)"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Distribuição de Mensagens
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dadosDistribuicao.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={dadosDistribuicao}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {dadosDistribuicao.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-slate-500">
                Sem dados para exibir no período selecionado
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {(metricas.taxaConformidade < 95 || metricas.conversasEmRisco > 0 || metricas.templatesPendentes > 0) && (
        <Card className="border-2 border-amber-300 bg-amber-50/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <AlertTriangle className="w-5 h-5" />
              Alertas e Recomendações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {metricas.taxaConformidade < 95 && (
              <div className="flex items-start gap-3 p-3 bg-white rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-900">Taxa de Conformidade Abaixo do Ideal</p>
                  <p className="text-sm text-amber-700 mt-1">
                    {metricas.mensagensForaConformidade} mensagens foram enviadas fora da janela de 24h sem uso de template aprovado.
                    Recomendamos criar templates para os cenários mais comuns.
                  </p>
                </div>
              </div>
            )}

            {metricas.conversasEmRisco > 0 && (
              <div className="flex items-start gap-3 p-3 bg-white rounded-lg">
                <Clock className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-900">Conversas Próximas de Expirar</p>
                  <p className="text-sm text-red-700 mt-1">
                    {metricas.conversasEmRisco} conversas expiram em menos de 2 horas.
                    Após expiração, só será possível enviar mensagens via template aprovado.
                  </p>
                </div>
              </div>
            )}

            {metricas.templatesPendentes > 0 && (
              <div className="flex items-start gap-3 p-3 bg-white rounded-lg">
                <FileText className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-blue-900">Templates Aguardando Aprovação</p>
                  <p className="text-sm text-blue-700 mt-1">
                    {metricas.templatesPendentes} templates estão aguardando aprovação da Meta.
                    O processo pode levar até 48 horas.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, TrendingUp, AlertCircle, CheckCircle, Zap, Filter } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function AnaliseContatosBanco() {
  const [contatos, setContatos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('todos');

  useEffect(() => {
    carregarContatos();
  }, []);

  const carregarContatos = async () => {
    try {
      const dados = await base44.entities.Contact.list('-created_date', 1000);
      setContatos(dados || []);
    } catch (erro) {
      console.error('Erro ao carregar contatos:', erro);
    } finally {
      setLoading(false);
    }
  };

  // Análises
  const totalContatos = contatos.length;
  const clientes = contatos.filter(c => c.data?.tipo_contato === 'cliente');
  const leads = contatos.filter(c => c.data?.tipo_contato === 'lead');
  const fornecedores = contatos.filter(c => c.data?.tipo_contato === 'fornecedor');
  const parceiros = contatos.filter(c => c.data?.tipo_contato === 'parceiro');

  // Segmentação
  const leadsFrios = contatos.filter(c => c.data?.segmento_atual === 'lead_frio');
  const leadsQuentes = contatos.filter(c => c.data?.segmento_atual === 'lead_quente');
  const clientesAtivos = contatos.filter(c => c.data?.segmento_atual === 'cliente_ativo');
  const emRisco = contatos.filter(c => c.data?.segmento_atual === 'risco_churn');

  // VIP e Fidelização
  const vip = contatos.filter(c => c.data?.is_vip);
  const fidelizados = contatos.filter(c => c.data?.is_cliente_fidelizado);
  const comAtendente = contatos.filter(c => c.data?.atendente_fidelizado_vendas || c.data?.atendente_fidelizado_assistencia || c.data?.atendente_fidelizado_financeiro);

  // Qualidade de dados
  const semNome = contatos.filter(c => !c.data?.nome || c.data?.nome === '.');
  const semTelefone = contatos.filter(c => !c.data?.telefone);
  const semEmpresa = contatos.filter(c => !c.data?.empresa);
  const bloqueados = contatos.filter(c => c.data?.bloqueado);

  // Engajamento
  const highEngagement = contatos.filter(c => (c.data?.score_engajamento || 0) >= 70);
  const lowEngagement = contatos.filter(c => (c.data?.score_engajamento || 0) < 30);

  const chartData = [
    { name: 'Clientes', value: clientes.length, fill: '#10b981' },
    { name: 'Leads', value: leads.length, fill: '#3b82f6' },
    { name: 'Fornecedores', value: fornecedores.length, fill: '#f59e0b' },
    { name: 'Parceiros', value: parceiros.length, fill: '#8b5cf6' }
  ];

  const segmentacaoData = [
    { name: 'Leads Frios', value: leadsFrios.length, fill: '#9ca3af' },
    { name: 'Leads Quentes', value: leadsQuentes.length, fill: '#f97316' },
    { name: 'Clientes Ativos', value: clientesAtivos.length, fill: '#10b981' },
    { name: 'Em Risco', value: emRisco.length, fill: '#dc2626' }
  ];

  const KPICard = ({ title, value, icon: Icon, color, subtitle }) => (
    <Card className={`border-l-4 ${color}`}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-600">{title}</p>
            <p className="text-3xl font-bold text-slate-900 mt-2">{value}</p>
            {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
          </div>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${color} bg-opacity-10`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) return <div className="p-6">Carregando análise...</div>;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
          <Users className="w-8 h-8" />
          Análise de Contatos no Banco
        </h1>
        <p className="text-slate-600 mt-1">Dashboard completo de segmentação e qualidade de dados</p>
      </div>

      {/* KPIs Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total de Contatos" value={totalContatos} icon={Users} color="border-blue-500" />
        <KPICard title="VIP & Fidelizados" value={vip.length + fidelizados.length} icon={Zap} color="border-amber-500" subtitle={`${comAtendente.length} com atendente`} />
        <KPICard title="Em Risco" value={emRisco.length} icon={AlertCircle} color="border-red-500" subtitle={`${lowEngagement.length} baixo engajamento`} />
        <KPICard title="Qualidade Crítica" value={semNome.length + semTelefone.length} icon={CheckCircle} color="border-orange-500" subtitle="Dados incompletos" />
      </div>

      {/* Segmentação */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={chartData} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name}: ${value}`} outerRadius={80} fill="#8884d8" dataKey="value">
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {chartData.map(d => (
                <div key={d.name} className="flex justify-between text-sm">
                  <span className="text-slate-600">{d.name}</span>
                  <span className="font-bold">{d.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Segmentação de Funil</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={segmentacaoData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {segmentacaoData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Qualidade de Dados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Problemas de Qualidade de Dados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <p className="text-sm text-red-600">Sem Nome</p>
              <p className="text-2xl font-bold text-red-700 mt-2">{semNome.length}</p>
              <p className="text-xs text-red-500 mt-1">{((semNome.length / totalContatos) * 100).toFixed(1)}% dos contatos</p>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
              <p className="text-sm text-orange-600">Sem Telefone</p>
              <p className="text-2xl font-bold text-orange-700 mt-2">{semTelefone.length}</p>
              <p className="text-xs text-orange-500 mt-1">{((semTelefone.length / totalContatos) * 100).toFixed(1)}% dos contatos</p>
            </div>
            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-sm text-yellow-600">Sem Empresa</p>
              <p className="text-2xl font-bold text-yellow-700 mt-2">{semEmpresa.length}</p>
              <p className="text-xs text-yellow-500 mt-1">{((semEmpresa.length / totalContatos) * 100).toFixed(1)}% dos contatos</p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <p className="text-sm text-red-600">Bloqueados</p>
              <p className="text-2xl font-bold text-red-700 mt-2">{bloqueados.length}</p>
              <p className="text-xs text-red-500 mt-1">{((bloqueados.length / totalContatos) * 100).toFixed(1)}% dos contatos</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fidelização */}
      <Card>
        <CardHeader>
          <CardTitle>Fidelização & VIP</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-600">VIP</p>
              <p className="text-3xl font-bold text-blue-700 mt-2">{vip.length}</p>
              <div className="mt-3 space-y-1">
                {vip.slice(0, 3).map(c => (
                  <p key={c.id} className="text-xs text-blue-600 truncate">👑 {c.data?.nome || c.data?.empresa}</p>
                ))}
              </div>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-purple-600">Fidelizados</p>
              <p className="text-3xl font-bold text-purple-700 mt-2">{fidelizados.length}</p>
              <p className="text-xs text-purple-500 mt-2">Cliente permanente com vínculo</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-green-600">Com Atendente Fidelizado</p>
              <p className="text-3xl font-bold text-green-700 mt-2">{comAtendente.length}</p>
              <p className="text-xs text-green-500 mt-2">Vínculo operacional ativo</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Contatos Críticos */}
      <Card>
        <CardHeader>
          <CardTitle>Contatos em Risco (Baixo Engajamento)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {lowEngagement.slice(0, 20).map(c => (
              <div key={c.id} className="p-3 border rounded-lg flex justify-between items-start hover:bg-slate-50">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate">{c.data?.nome || c.data?.empresa || 'N/A'}</p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">{c.data?.tipo_contato || 'N/A'}</Badge>
                    <Badge variant="outline" className="text-xs">{c.data?.segmento_atual || 'N/A'}</Badge>
                  </div>
                </div>
                <span className="text-xs text-slate-500 ml-2">Eng: {c.data?.score_engajamento || 0}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
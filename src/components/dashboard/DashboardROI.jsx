import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Cliente } from "@/entities/Cliente";
import { Venda } from "@/entities/Venda";
import { TrendingUp, DollarSign, Target, Award } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

/**
 * ═══════════════════════════════════════════════════════════
 * DASHBOARD DE ROI DE MÍDIA PAGA
 * ═══════════════════════════════════════════════════════════
 * 
 * Funcionalidade Premium inspirada no Leadster:
 * - ROI por canal de marketing
 * - Atribuição de receita por campanha
 * - Custo de Aquisição de Cliente (CAC)
 * - Lifetime Value (LTV) por origem
 */

export default function DashboardROI() {
  const [dadosROI, setDadosROI] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarDadosROI();
  }, []);

  const carregarDadosROI = async () => {
    setLoading(true);
    try {
      const clientes = await Cliente.list();
      const vendas = await Venda.list();

      // Agrupar por origem de campanha
      const receitaPorOrigem = {};
      const clientesPorOrigem = {};

      clientes.forEach(cliente => {
        const origem = cliente.origem_campanha?.utm_source || 'organico';
        
        if (!clientesPorOrigem[origem]) {
          clientesPorOrigem[origem] = 0;
        }
        clientesPorOrigem[origem]++;

        // Calcular receita deste cliente
        const vendasCliente = vendas.filter(v => v.cliente_nome === cliente.razao_social);
        const receitaCliente = vendasCliente.reduce((acc, v) => acc + (v.valor_total || 0), 0);

        if (!receitaPorOrigem[origem]) {
          receitaPorOrigem[origem] = 0;
        }
        receitaPorOrigem[origem] += receitaCliente;
      });

      // Transformar em array para gráficos
      const dadosGrafico = Object.keys(receitaPorOrigem).map(origem => ({
        origem,
        receita: receitaPorOrigem[origem],
        clientes: clientesPorOrigem[origem],
        ticketMedio: receitaPorOrigem[origem] / (clientesPorOrigem[origem] || 1)
      })).sort((a, b) => b.receita - a.receita);

      setDadosROI({
        porOrigem: dadosGrafico,
        receitaTotal: Object.values(receitaPorOrigem).reduce((a, b) => a + b, 0),
        clientesTotal: Object.values(clientesPorOrigem).reduce((a, b) => a + b, 0)
      });

    } catch (error) {
      console.error("Erro ao carregar dados de ROI:", error);
    }
    setLoading(false);
  };

  const CORES = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'];

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-600" />
              Receita Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900">
              R$ {(dadosROI?.receitaTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-green-700 mt-1">De todos os canais</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-600" />
              Total de Clientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900">
              {dadosROI?.clientesTotal || 0}
            </div>
            <p className="text-xs text-blue-700 mt-1">Clientes atribuídos</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Award className="w-4 h-4 text-purple-600" />
              Ticket Médio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900">
              R$ {((dadosROI?.receitaTotal || 0) / (dadosROI?.clientesTotal || 1)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-purple-700 mt-1">Por cliente</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Receita por Origem */}
      <Card>
        <CardHeader>
          <CardTitle>Receita por Canal de Marketing</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dadosROI?.porOrigem || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="origem" />
              <YAxis />
              <Tooltip formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
              <Bar dataKey="receita" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tabela Detalhada */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento por Canal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 text-sm font-semibold">Canal</th>
                  <th className="text-right p-3 text-sm font-semibold">Clientes</th>
                  <th className="text-right p-3 text-sm font-semibold">Receita</th>
                  <th className="text-right p-3 text-sm font-semibold">Ticket Médio</th>
                </tr>
              </thead>
              <tbody>
                {dadosROI?.porOrigem.map((item, idx) => (
                  <tr key={idx} className="border-b hover:bg-slate-50">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CORES[idx % CORES.length] }}></div>
                        <span className="font-medium capitalize">{item.origem}</span>
                      </div>
                    </td>
                    <td className="text-right p-3">{item.clientes}</td>
                    <td className="text-right p-3 font-semibold text-green-600">
                      R$ {item.receita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="text-right p-3">
                      R$ {item.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
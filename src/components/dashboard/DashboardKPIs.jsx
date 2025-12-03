import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Users,
  Target,
  Zap,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

export default function DashboardKPIs({ periodoDias = 30 }) {
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [atualizando, setAtualizando] = useState(false);

  useEffect(() => {
    carregarKPIs();
  }, [periodoDias]);

  const carregarKPIs = async () => {
    try {
      setLoading(true);
      
      const response = await base44.functions.invoke('metricsEngine', {
        action: 'calculate_kpis',
        periodo_dias: periodoDias
      });

      if (response.data.success) {
        setKpis(response.data.kpis);
      }
    } catch (error) {
      console.error('Erro ao carregar KPIs:', error);
      toast.error('Erro ao carregar métricas');
    } finally {
      setLoading(false);
    }
  };

  const handleAtualizar = async () => {
    setAtualizando(true);
    await carregarKPIs();
    setAtualizando(false);
    toast.success('Métricas atualizadas!');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!kpis) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <p className="text-slate-600">Nenhum dado disponível</p>
        </CardContent>
      </Card>
    );
  }

  const cards = [
    {
      titulo: 'Receita Total',
      valor: `R$ ${kpis.receita_total?.toLocaleString('pt-BR') || '0'}`,
      variacao: kpis.variacao_receita,
      icon: DollarSign,
      cor: 'blue'
    },
    {
      titulo: 'Conversões',
      valor: kpis.total_conversoes || 0,
      variacao: kpis.variacao_conversoes,
      icon: Target,
      cor: 'green'
    },
    {
      titulo: 'Taxa de Conversão',
      valor: `${kpis.taxa_conversao?.toFixed(1) || 0}%`,
      variacao: kpis.variacao_taxa_conversao,
      icon: TrendingUp,
      cor: 'purple'
    },
    {
      titulo: 'Leads Ativos',
      valor: kpis.leads_ativos || 0,
      variacao: kpis.variacao_leads,
      icon: Users,
      cor: 'amber'
    },
    {
      titulo: 'Playbooks Ativos',
      valor: kpis.playbooks_ativos || 0,
      icon: Zap,
      cor: 'indigo'
    },
    {
      titulo: 'Taxa de Sucesso',
      valor: `${kpis.taxa_sucesso_playbooks?.toFixed(1) || 0}%`,
      variacao: kpis.variacao_taxa_sucesso,
      icon: Target,
      cor: 'emerald'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">KPIs do Período</h2>
        <Button
          variant="outline"
          onClick={handleAtualizar}
          disabled={atualizando}
        >
          {atualizando ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          const cores = {
            blue: 'from-blue-500 to-blue-600',
            green: 'from-green-500 to-green-600',
            purple: 'from-purple-500 to-purple-600',
            amber: 'from-amber-500 to-amber-600',
            indigo: 'from-indigo-500 to-indigo-600',
            emerald: 'from-emerald-500 to-emerald-600'
          };

          return (
            <Card key={idx} className="overflow-hidden">
              <div className={`h-2 bg-gradient-to-r ${cores[card.cor]}`} />
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${cores[card.cor]} bg-opacity-10`}>
                    <Icon className={`w-6 h-6 text-${card.cor}-600`} />
                  </div>
                  {card.variacao !== undefined && (
                    <Badge 
                      variant={card.variacao >= 0 ? 'default' : 'destructive'}
                      className="flex items-center gap-1"
                    >
                      {card.variacao >= 0 ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      {Math.abs(card.variacao).toFixed(1)}%
                    </Badge>
                  )}
                </div>
                <div className="text-3xl font-bold mb-1">{card.valor}</div>
                <div className="text-sm text-slate-600">{card.titulo}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
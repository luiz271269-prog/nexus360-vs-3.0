import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Target, 
  TrendingUp, 
  Award, 
  Zap, 
  Trophy,
  Medal,
  Star,
  Flame,
  TrendingDown
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║  DASHBOARD DE METAS GAMIFICADO                               ║
 * ║  + Progresso visual diário/semanal/mensal                   ║
 * ║  + Ranking em tempo real                                     ║
 * ║  + Sistema de troféus e badges                              ║
 * ║  + Alertas de conquistas                                     ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

export default function DashboardMetas({ vendedorId, isGerente }) {
  const [periodo, setPeriodo] = useState('mensal'); // diario, semanal, mensal
  const [conquistas, setConquistas] = useState([]);

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard_metas', vendedorId, periodo],
    queryFn: async () => await calcularMetas(vendedorId, periodo, isGerente),
    refetchInterval: 30000 // Atualizar a cada 30s
  });

  useEffect(() => {
    if (data?.novasConquistas) {
      mostrarConquistas(data.novasConquistas);
    }
  }, [data]);

  const mostrarConquistas = (novas) => {
    setConquistas(prev => [...prev, ...novas]);
    setTimeout(() => {
      setConquistas([]);
    }, 5000);
  };

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  const { metaDiaria, metaSemanal, metaMensal, ranking, badges } = data;

  return (
    <div className="space-y-6">
      {/* Notificações de Conquistas */}
      <AnimatePresence>
        {conquistas.map((conquista, index) => (
          <motion.div
            key={index}
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            className="fixed top-20 right-6 z-50 bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-6 py-4 rounded-xl shadow-2xl"
          >
            <div className="flex items-center gap-3">
              <Trophy className="w-8 h-8" />
              <div>
                <h4 className="font-bold">{conquista.titulo}</h4>
                <p className="text-sm">{conquista.descricao}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Seletor de Período */}
      <div className="flex gap-2 justify-center">
        {['diario', 'semanal', 'mensal'].map(p => (
          <button
            key={p}
            onClick={() => setPeriodo(p)}
            className={`px-6 py-2 rounded-lg font-medium transition-all ${
              periodo === p
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {/* Cards de Metas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetaCard
          titulo="Meta Diária"
          meta={metaDiaria}
          periodo="hoje"
          icon={Zap}
          cor="from-blue-500 to-cyan-500"
        />
        <MetaCard
          titulo="Meta Semanal"
          meta={metaSemanal}
          periodo="esta semana"
          icon={Flame}
          cor="from-orange-500 to-red-500"
        />
        <MetaCard
          titulo="Meta Mensal"
          meta={metaMensal}
          periodo="este mês"
          icon={Trophy}
          cor="from-purple-500 to-pink-500"
        />
      </div>

      {/* Ranking de Vendedores */}
      {isGerente && ranking && (
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Award className="w-6 h-6 text-yellow-400" />
              Ranking do Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {ranking.map((vendedor, index) => (
                <RankingItem
                  key={vendedor.id}
                  vendedor={vendedor}
                  posicao={index + 1}
                  isAtual={vendedor.id === vendedorId}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Badges e Conquistas */}
      <Card className="bg-gradient-to-br from-amber-50 to-orange-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Medal className="w-6 h-6 text-orange-600" />
            Suas Conquistas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {badges.map((badge, index) => (
              <BadgeCard key={index} badge={badge} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Card de Meta Individual
 */
function MetaCard({ titulo, meta, periodo, icon: Icon, cor }) {
  const percentual = meta.percentual || 0;
  const isCompleta = percentual >= 100;
  
  return (
    <Card className={`border-2 ${isCompleta ? 'border-green-400 shadow-lg shadow-green-200' : 'border-slate-200'}`}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${cor} flex items-center justify-center`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          {isCompleta && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring" }}
            >
              <Trophy className="w-8 h-8 text-yellow-500" />
            </motion.div>
          )}
        </div>

        <h3 className="text-lg font-semibold text-slate-900 mb-1">{titulo}</h3>
        <p className="text-sm text-slate-500 mb-4">{periodo}</p>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Realizado</span>
            <span className="font-bold text-slate-900">
              R$ {meta.realizado?.toLocaleString('pt-BR') || 0}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Meta</span>
            <span className="font-bold text-slate-900">
              R$ {meta.valor?.toLocaleString('pt-BR') || 0}
            </span>
          </div>

          <Progress 
            value={Math.min(percentual, 100)} 
            className={`h-3 ${isCompleta ? 'bg-green-200' : ''}`}
          />

          <div className="flex items-center justify-between">
            <Badge className={`${
              percentual >= 100 ? 'bg-green-600' :
              percentual >= 80 ? 'bg-yellow-600' :
              percentual >= 50 ? 'bg-blue-600' :
              'bg-red-600'
            } text-white`}>
              {percentual.toFixed(1)}%
            </Badge>
            {percentual >= 100 ? (
              <span className="text-green-600 font-medium text-sm flex items-center gap-1">
                <TrendingUp className="w-4 h-4" /> Meta Atingida!
              </span>
            ) : (
              <span className="text-slate-500 text-sm">
                Faltam R$ {(meta.valor - meta.realizado).toLocaleString('pt-BR')}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Item do Ranking
 */
function RankingItem({ vendedor, posicao, isAtual }) {
  const podioColors = {
    1: 'from-yellow-400 to-yellow-600',
    2: 'from-slate-300 to-slate-500',
    3: 'from-orange-400 to-orange-600'
  };

  return (
    <div className={`flex items-center gap-4 p-4 rounded-xl ${
      isAtual ? 'bg-indigo-900/50 ring-2 ring-indigo-500' : 'bg-slate-800/50'
    }`}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
        posicao <= 3 
          ? `bg-gradient-to-br ${podioColors[posicao]}`
          : 'bg-slate-600'
      }`}>
        {posicao <= 3 ? <Trophy className="w-5 h-5" /> : posicao}
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-white truncate">{vendedor.nome}</h4>
        <div className="flex items-center gap-2 mt-1">
          <Progress value={vendedor.percentualMeta} className="h-2 flex-1" />
          <span className="text-sm text-slate-300 font-medium">
            {vendedor.percentualMeta}%
          </span>
        </div>
      </div>

      <div className="text-right">
        <div className="font-bold text-green-400">
          R$ {vendedor.faturamento?.toLocaleString('pt-BR')}
        </div>
        <div className="text-xs text-slate-400">
          {vendedor.quantidadeVendas} vendas
        </div>
      </div>
    </div>
  );
}

/**
 * Card de Badge/Conquista
 */
function BadgeCard({ badge }) {
  return (
    <div className={`p-4 rounded-xl text-center ${
      badge.conquistado 
        ? 'bg-gradient-to-br from-yellow-100 to-orange-100 border-2 border-orange-300' 
        : 'bg-slate-100 opacity-50'
    }`}>
      <div className="text-4xl mb-2">{badge.icone}</div>
      <h4 className="font-semibold text-sm text-slate-900">{badge.nome}</h4>
      <p className="text-xs text-slate-600 mt-1">{badge.descricao}</p>
      {badge.conquistado && badge.data && (
        <p className="text-xs text-orange-600 mt-2 font-medium">
          {new Date(badge.data).toLocaleDateString('pt-BR')}
        </p>
      )}
    </div>
  );
}

/**
 * Skeleton de Loading
 */
function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-64 bg-slate-200 animate-pulse rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/**
 * Calcular métricas de metas
 */
async function calcularMetas(vendedorId, periodo, isGerente) {
  const hoje = new Date();
  const inicioSemana = new Date(hoje);
  inicioSemana.setDate(hoje.getDate() - hoje.getDay());
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

  // Buscar dados
  const [vendedor, vendas, todosVendedores] = await Promise.all([
    vendedorId ? base44.entities.Vendedor.get(vendedorId) : null,
    base44.entities.Venda.list('-data_venda', 500),
    isGerente ? base44.entities.Vendedor.list() : []
  ]);

  const vendasVendedor = vendedorId 
    ? vendas.filter(v => v.vendedor === vendedor.nome)
    : vendas;

  // Meta Diária
  const vendasHoje = vendasVendedor.filter(v => 
    v.data_venda === hoje.toISOString().slice(0, 10)
  );
  const faturamentoHoje = vendasHoje.reduce((sum, v) => sum + (v.valor_total || 0), 0);
  const metaDiariaValor = vendedor?.meta_mensal ? vendedor.meta_mensal / 22 : 0; // ~22 dias úteis

  // Meta Semanal
  const vendasSemana = vendasVendedor.filter(v => 
    v.data_venda && new Date(v.data_venda) >= inicioSemana
  );
  const faturamentoSemana = vendasSemana.reduce((sum, v) => sum + (v.valor_total || 0), 0);
  const metaSemanalValor = vendedor?.meta_semanal || (vendedor?.meta_mensal / 4) || 0;

  // Meta Mensal
  const vendasMes = vendasVendedor.filter(v => 
    v.data_venda && new Date(v.data_venda) >= inicioMes
  );
  const faturamentoMes = vendasMes.reduce((sum, v) => sum + (v.valor_total || 0), 0);
  const metaMensalValor = vendedor?.meta_mensal || 0;

  // Ranking (se gerente)
  let ranking = [];
  if (isGerente && todosVendedores.length > 0) {
    ranking = todosVendedores.map(v => {
      const vendasV = vendas.filter(venda => venda.vendedor === v.nome);
      const vendasMesV = vendasV.filter(venda => 
        venda.data_venda && new Date(venda.data_venda) >= inicioMes
      );
      const faturamento = vendasMesV.reduce((sum, venda) => sum + (venda.valor_total || 0), 0);
      const percentualMeta = v.meta_mensal > 0 ? (faturamento / v.meta_mensal) * 100 : 0;

      return {
        id: v.id,
        nome: v.nome,
        faturamento,
        percentualMeta: Math.round(percentualMeta),
        quantidadeVendas: vendasMesV.length
      };
    }).sort((a, b) => b.faturamento - a.faturamento);
  }

  // Badges
  const badges = gerarBadges(faturamentoMes, vendasMes.length, vendedor);

  // Verificar conquistas
  const novasConquistas = [];
  if (metaDiariaValor > 0 && faturamentoHoje >= metaDiariaValor) {
    novasConquistas.push({
      titulo: '🎯 Meta Diária Atingida!',
      descricao: `Parabéns! Você bateu sua meta do dia!`
    });
  }

  return {
    metaDiaria: {
      valor: metaDiariaValor,
      realizado: faturamentoHoje,
      percentual: metaDiariaValor > 0 ? (faturamentoHoje / metaDiariaValor) * 100 : 0
    },
    metaSemanal: {
      valor: metaSemanalValor,
      realizado: faturamentoSemana,
      percentual: metaSemanalValor > 0 ? (faturamentoSemana / metaSemanalValor) * 100 : 0
    },
    metaMensal: {
      valor: metaMensalValor,
      realizado: faturamentoMes,
      percentual: metaMensalValor > 0 ? (faturamentoMes / metaMensalValor) * 100 : 0
    },
    ranking,
    badges,
    novasConquistas
  };
}

/**
 * Gerar badges baseado em conquistas
 */
function gerarBadges(faturamento, quantidadeVendas, vendedor) {
  return [
    {
      nome: '🔥 Estreante',
      descricao: 'Primeira venda',
      icone: '⭐',
      conquistado: quantidadeVendas >= 1,
      data: quantidadeVendas >= 1 ? new Date() : null
    },
    {
      nome: '💪 Consistente',
      descricao: '10 vendas no mês',
      icone: '💪',
      conquistado: quantidadeVendas >= 10
    },
    {
      nome: '🚀 Foguete',
      descricao: '50 vendas no mês',
      icone: '🚀',
      conquistado: quantidadeVendas >= 50
    },
    {
      nome: '👑 Top Performer',
      descricao: 'Meta mensal 100%',
      icone: '👑',
      conquistado: vendedor?.meta_mensal && faturamento >= vendedor.meta_mensal
    },
    {
      nome: '💎 Elite',
      descricao: 'Meta mensal 150%',
      icone: '💎',
      conquistado: vendedor?.meta_mensal && faturamento >= vendedor.meta_mensal * 1.5
    },
    {
      nome: '🏆 Lenda',
      descricao: 'Meta mensal 200%',
      icone: '🏆',
      conquistado: vendedor?.meta_mensal && faturamento >= vendedor.meta_mensal * 2
    }
  ];
}
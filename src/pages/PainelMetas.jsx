import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { buscarNotasFiscaisExternas } from "@/functions/buscarNotasFiscaisExternas";
import { getNomeExibicao, normalizarNome } from "@/components/lib/vendedorSync";
import BrutalCard from "@/components/metas/BrutalCard";
import MetaVendedorCard from "@/components/metas/MetaVendedorCard";
import EvolucaoReceitaChart from "@/components/metas/EvolucaoReceitaChart";
import { Target, TrendingUp, Loader2, Trophy } from "lucide-react";

const fmt = (v) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export default function PainelMetas() {
  const [loading, setLoading] = useState(true);
  const [vendedores, setVendedores] = useState([]); // { nome, realizado, meta }
  const [evolucao, setEvolucao] = useState([]);      // { mes, receita }
  const [totais, setTotais] = useState({ realizado: 0, meta: 0 });

  useEffect(() => {
    let ativo = true;
    (async () => {
      setLoading(true);
      try {
        const anoAtual = new Date().getFullYear();
        const mesAtual = new Date().getMonth(); // 0-11

        const [users, vendEntidades, notasRes] = await Promise.all([
          base44.entities.User.list().catch(() => []),
          base44.entities.Vendedor.list('-created_date', 200).catch(() => []),
          buscarNotasFiscaisExternas({}).catch(() => ({ data: { notas: [] } }))
        ]);

        const notas = notasRes?.data?.notas || notasRes?.data?.data || [];

        // Faturamento por vendedor no MÊS atual + evolução mensal do ano
        const porVendedorMes = {};
        const receitaPorMes = Array(12).fill(0);
        for (const n of notas) {
          const d = n.data_emissao || n.data || n.created_date;
          if (!d) continue;
          const dt = new Date(d);
          if (isNaN(dt) || dt.getFullYear() !== anoAtual) continue;
          const valor = n.valor_total || 0;
          receitaPorMes[dt.getMonth()] += valor;
          if (dt.getMonth() === mesAtual) {
            const v = normalizarNome(n.vendedor || n.vendedor_nome || '').toLowerCase();
            if (v) porVendedorMes[v] = (porVendedorMes[v] || 0) + valor;
          }
        }

        // Evolução: do mês 0 até o mês atual
        const evo = receitaPorMes
          .slice(0, mesAtual + 1)
          .map((receita, i) => ({ mes: MESES[i], receita: Math.round(receita) }));

        // Mapa de meta por vendedor (entidade Vendedor -> User)
        const userById = new Map(users.map(u => [u.id, u]));
        const lista = vendEntidades
          .filter(v => v.status !== 'inativo')
          .map(v => {
            const user = userById.get(v.usuario_id);
            const nome = user ? getNomeExibicao(user) : (v.codigo || 'Vendedor');
            const nomeNorm = normalizarNome(nome).toLowerCase();
            // casa faturamento pelo nome de exibição ou full_name legado
            const fullNorm = normalizarNome(user?.full_name || '').toLowerCase();
            const realizado = porVendedorMes[nomeNorm] || porVendedorMes[fullNorm] || 0;
            return { nome, realizado, meta: v.meta_mensal || 0 };
          })
          .sort((a, b) => b.realizado - a.realizado);

        const totalRealizado = lista.reduce((s, v) => s + v.realizado, 0);
        const totalMeta = lista.reduce((s, v) => s + v.meta, 0);

        if (ativo) {
          setVendedores(lista);
          setEvolucao(evo);
          setTotais({ realizado: totalRealizado, meta: totalMeta });
        }
      } catch (e) {
        console.error('Erro ao carregar painel de metas:', e);
      } finally {
        if (ativo) setLoading(false);
      }
    })();
    return () => { ativo = false; };
  }, []);

  const pctGeral = totais.meta > 0 ? Math.round((totais.realizado / totais.meta) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-yellow-50">
        <div className="flex items-center gap-3 font-black text-xl">
          <Loader2 className="w-7 h-7 animate-spin" /> Carregando metas...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-yellow-50 p-4 md:p-8 space-y-6">
      {/* Cabeçalho */}
      <BrutalCard className="p-5 bg-orange-400">
        <div className="flex items-center gap-3">
          <div className="bg-black p-2 rounded-none">
            <Target className="w-8 h-8 text-orange-400" />
          </div>
          <div>
            <h1 className="font-black text-2xl md:text-3xl uppercase">Painel de Metas</h1>
            <p className="font-bold text-black/70 text-sm">Atingimento por vendedor · Receita mensal</p>
          </div>
        </div>
      </BrutalCard>

      {/* Resumo geral */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <BrutalCard className="p-4 bg-white">
          <p className="font-bold uppercase text-xs text-black/60">Realizado no mês</p>
          <p className="font-black text-3xl">{fmt(totais.realizado)}</p>
        </BrutalCard>
        <BrutalCard className="p-4 bg-white">
          <p className="font-bold uppercase text-xs text-black/60">Meta total</p>
          <p className="font-black text-3xl">{fmt(totais.meta)}</p>
        </BrutalCard>
        <BrutalCard className={`p-4 ${pctGeral >= 100 ? 'bg-green-400' : 'bg-cyan-300'}`}>
          <p className="font-bold uppercase text-xs text-black/60">Atingimento geral</p>
          <p className="font-black text-3xl flex items-center gap-2">
            {pctGeral}% <TrendingUp className="w-6 h-6" />
          </p>
        </BrutalCard>
      </div>

      {/* Evolução da receita */}
      <EvolucaoReceitaChart dados={evolucao} />

      {/* Metas por vendedor */}
      <div>
        <h2 className="font-black text-xl uppercase mb-3 bg-black text-white inline-block px-3 py-1 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-400" /> Metas por Vendedor
        </h2>
        {vendedores.length === 0 ? (
          <BrutalCard className="p-6 bg-white">
            <p className="font-bold text-black/60 text-center">
              Nenhum vendedor com meta cadastrada. Configure as metas em "Metas de Vendas".
            </p>
          </BrutalCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {vendedores.map((v) => (
              <MetaVendedorCard key={v.nome} nome={v.nome} realizado={v.realizado} meta={v.meta} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
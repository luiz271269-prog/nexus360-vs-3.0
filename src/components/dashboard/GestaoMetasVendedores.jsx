import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { getNomeExibicao } from "@/components/lib/vendedorSync";
import { analisarHistoricoVendedor } from "./metasNfUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, Sparkles, Save, Users } from "lucide-react";
import { toast } from "sonner";

const fmt = (v) => `R$ ${(v || 0).toLocaleString('pt-BR')}`;

export default function GestaoMetasVendedores({ vendedores, vendedoresEntidade, notasTodas }) {
  const [metasEditadas, setMetasEditadas] = useState({});
  const [salvando, setSalvando] = useState(null);

  const linhas = (vendedores || []).map(v => {
    const ent = (vendedoresEntidade || []).find(e => e.usuario_id === v.id);
    const analise = analisarHistoricoVendedor(v, vendedores, notasTodas, 3);
    return {
      usuario: v,
      ent,
      nome: getNomeExibicao(v) || v.full_name || v.email,
      metaAtual: metasEditadas[v.id] !== undefined ? metasEditadas[v.id] : (ent?.meta_mensal || 0),
      ...analise
    };
  });

  const salvarMeta = async (linha, valor) => {
    setSalvando(linha.usuario.id);
    try {
      const meta = Number(valor) || 0;
      if (linha.ent) {
        await base44.entities.Vendedor.update(linha.ent.id, { meta_mensal: meta });
      } else {
        await base44.entities.Vendedor.create({
          usuario_id: linha.usuario.id,
          codigo: linha.usuario.codigo || `V-${(linha.nome || '').split(' ')[0].toUpperCase()}`,
          meta_mensal: meta,
          status: 'ativo'
        });
      }
      setMetasEditadas(prev => ({ ...prev, [linha.usuario.id]: meta }));
      toast.success(`Meta de ${linha.nome} atualizada para ${fmt(meta)}`);
    } catch (e) {
      toast.error(`Erro ao salvar meta: ${e.message}`);
    }
    setSalvando(null);
  };

  return (
    <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 text-white">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
          <Target className="w-5 h-5 text-orange-400" />
          Gestão e Previsão de Metas Mensais
        </CardTitle>
        <p className="text-xs text-slate-400">
          Sugestão baseada na média dos últimos 3 meses de NFs consolidadas e no volume de clientes recorrentes (compra em 2+ meses)
        </p>
      </CardHeader>
      <CardContent className="pt-0 overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-slate-400 text-xs border-b border-slate-700">
              <th className="text-left py-2 pr-2">Vendedor</th>
              <th className="text-right py-2 px-2">Média 3 meses</th>
              <th className="text-right py-2 px-2">
                <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" />Recorrentes</span>
              </th>
              <th className="text-right py-2 px-2">Receita recorrente/mês</th>
              <th className="text-right py-2 px-2">Meta sugerida</th>
              <th className="text-right py-2 px-2">Meta atual</th>
              <th className="text-right py-2 pl-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map(linha => (
              <tr key={linha.usuario.id} className="border-b border-slate-800 hover:bg-slate-800/40">
                <td className="py-2 pr-2 font-medium text-slate-100">{linha.nome}</td>
                <td className="py-2 px-2 text-right text-slate-300">{fmt(linha.mediaMensal)}</td>
                <td className="py-2 px-2 text-right text-slate-300">{linha.clientesRecorrentes}</td>
                <td className="py-2 px-2 text-right text-slate-300">{fmt(linha.receitaRecorrenteMensal)}</td>
                <td className="py-2 px-2 text-right font-semibold text-amber-400">{fmt(linha.metaSugerida)}</td>
                <td className="py-2 px-2 text-right">
                  <input
                    type="number"
                    value={metasEditadas[linha.usuario.id] !== undefined ? metasEditadas[linha.usuario.id] : linha.metaAtual}
                    onChange={(e) => setMetasEditadas(prev => ({ ...prev, [linha.usuario.id]: e.target.value }))}
                    className="w-28 p-1.5 text-right bg-slate-700 border border-slate-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </td>
                <td className="py-2 pl-2 text-right whitespace-nowrap">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={salvando === linha.usuario.id}
                    onClick={() => salvarMeta(linha, linha.metaSugerida)}
                    className="text-amber-400 hover:text-amber-300 hover:bg-slate-700 h-8 px-2"
                    title="Aplicar meta sugerida"
                  >
                    <Sparkles className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={salvando === linha.usuario.id}
                    onClick={() => salvarMeta(linha, metasEditadas[linha.usuario.id] !== undefined ? metasEditadas[linha.usuario.id] : linha.metaAtual)}
                    className="text-green-400 hover:text-green-300 hover:bg-slate-700 h-8 px-2"
                    title="Salvar meta"
                  >
                    <Save className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            ))}
            {linhas.length === 0 && (
              <tr><td colSpan={7} className="py-6 text-center text-slate-400">Nenhum vendedor encontrado</td></tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
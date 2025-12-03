import { Trophy, Award, Medal, Target, Phone, MessageCircle, FileText, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function VendedorRanking({ vendedores, vendas, orcamentos, onViewVendedorDetails }) {
  const calcularPerformanceCompleta = () => {
    return vendedores.map(vendedor => {
      const vendasVendedor = vendas.filter(v => v.vendedor === vendedor.nome);
      const orcamentosVendedor = orcamentos?.filter(o => o.vendedor === vendedor.nome) || [];
      
      const faturamento = vendasVendedor.reduce((sum, v) => sum + (v.valor_total || 0), 0);
      const meta = vendedor.meta_mensal || 0;
      const percentual = meta > 0 ? (faturamento / meta) * 100 : 0;
      
      // Simulando dados de interações (em produção viriam do sistema)
      const ligacoes = Math.floor(Math.random() * 50) + 10;
      const whatsapp = Math.floor(Math.random() * 100) + 20;
      const interacoes_total = ligacoes + whatsapp;
      
      return { 
        ...vendedor, 
        faturamento, 
        percentual: Math.round(percentual),
        vendas_count: vendasVendedor.length,
        orcamentos_count: orcamentosVendedor.length,
        ligacoes,
        whatsapp,
        interacoes_total
      };
    }).sort((a, b) => b.percentual - a.percentual);
  };

  const ranking = calcularPerformanceCompleta();

  const getRankInfo = (index) => {
    if (index === 0) return { icon: Trophy, color: "text-yellow-600", bg: "bg-yellow-100" };
    if (index === 1) return { icon: Award, color: "text-slate-500", bg: "bg-slate-100" };
    if (index === 2) return { icon: Medal, color: "text-orange-500", bg: "bg-orange-100" };
    return { icon: Target, color: "text-slate-400", bg: "bg-slate-50" };
  };

  return (
    <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-6 border border-slate-200/50 shadow-lg h-full">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-800">Ranking de Vendedores</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onViewVendedorDetails && onViewVendedorDetails(ranking)}
          className="bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
        >
          Ver Todos os Detalhes
        </Button>
      </div>
      
      <div className="space-y-4">
        {ranking.map((vendedor, index) => {
          const { icon: RankIcon, color: rankColor, bg: rankBg } = getRankInfo(index);
          return (
            <div key={vendedor.id} className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 ${rankBg} rounded-lg flex items-center justify-center`}>
                    <RankIcon className={`w-6 h-6 ${rankColor}`} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">{vendedor.nome}</p>
                    <p className="text-sm text-slate-600">R$ {vendedor.faturamento.toLocaleString('pt-BR')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-800">{vendedor.percentual}%</p>
                  <div className="w-24 bg-slate-200 rounded-full h-1.5 mt-1">
                    <div className="bg-sky-500 h-1.5 rounded-full" style={{ width: `${Math.min(vendedor.percentual, 100)}%` }}></div>
                  </div>
                </div>
              </div>
              
              {/* Métricas Detalhadas */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="flex items-center gap-2 bg-white/60 p-2 rounded-lg">
                  <ShoppingCart className="w-4 h-4 text-green-600" />
                  <div>
                    <p className="text-xs text-slate-500">Vendas</p>
                    <p className="text-sm font-bold text-slate-800">{vendedor.vendas_count}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 bg-white/60 p-2 rounded-lg">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <div>
                    <p className="text-xs text-slate-500">Orçamentos</p>
                    <p className="text-sm font-bold text-slate-800">{vendedor.orcamentos_count}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 bg-white/60 p-2 rounded-lg">
                  <Phone className="w-4 h-4 text-blue-600" />
                  <div>
                    <p className="text-xs text-slate-500">Ligações</p>
                    <p className="text-sm font-bold text-slate-800">{vendedor.ligacoes}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 bg-white/60 p-2 rounded-lg">
                  <MessageCircle className="w-4 h-4 text-green-500" />
                  <div>
                    <p className="text-xs text-slate-500">WhatsApp</p>
                    <p className="text-sm font-bold text-slate-800">{vendedor.whatsapp}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
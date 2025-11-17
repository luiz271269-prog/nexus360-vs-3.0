import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "lucide-react";

export default function FiltroMes({ vendas, mesSelecionado, onMesChange }) {
  // Extrair meses únicos das vendas
  const mesesDisponiveis = [...new Set(vendas.map(v => v.data_venda?.substring(0, 7)).filter(Boolean))]
    .sort()
    .reverse()
    .slice(0, 12); // Últimos 12 meses

  const formatarMes = (mesAno) => {
    const [ano, mes] = mesAno.split('-');
    return new Date(parseInt(ano), parseInt(mes) - 1).toLocaleDateString('pt-BR', { 
      month: 'long', 
      year: 'numeric' 
    });
  };

  return (
    <div className="flex items-center gap-2 bg-slate-50/80 backdrop-blur-sm p-3 rounded-xl border border-slate-200/50">
      <Calendar className="w-4 h-4 text-slate-500" />
      <Select value={mesSelecionado} onValueChange={onMesChange}>
        <SelectTrigger className="w-48 bg-transparent border-none text-slate-700">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {mesesDisponiveis.map((mes) => (
            <SelectItem key={mes} value={mes}>
              {formatarMes(mes)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
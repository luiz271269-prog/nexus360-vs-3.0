import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Filter } from "lucide-react";

export default function FiltrosAvancados({ filtros, onFiltrosChange, vendedores, isGerente }) {
  const handleFiltroChange = (campo, valor) => {
    onFiltrosChange((prev) => ({ ...prev, [campo]: valor }));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="bg-slate-950 text-yellow-600 px-4 py-2 text-sm font-medium inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border hover:text-accent-foreground h-10 hover:bg-slate-600/80 border-slate-600">
          <Filter className="w-4 h-4 mr-2" />
          Filtros
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 bg-slate-800 border-slate-600 text-white" align="end">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-slate-300">Período</Label>
            <Select value={filtros.periodo} onValueChange={(value) => handleFiltroChange("periodo", value)}>
              <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600 text-white">
                <SelectItem value="hoje">Hoje</SelectItem>
                <SelectItem value="semana_atual">Semana Atual</SelectItem>
                <SelectItem value="mes_atual">Mês Atual</SelectItem>
                <SelectItem value="trimestre_atual">Trimestre Atual</SelectItem>
                <SelectItem value="personalizado">Personalizado</SelectItem>
                <SelectItem value="todos">Todos os Períodos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filtros.periodo === 'personalizado' &&
          <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-slate-300 text-xs">Data Início</Label>
                <Input
                type="date"
                value={filtros.dataInicio}
                onChange={(e) => handleFiltroChange("dataInicio", e.target.value)}
                className="bg-slate-700 border-slate-600 text-white text-sm" />

              </div>
              <div>
                <Label className="text-slate-300 text-xs">Data Fim</Label>
                <Input
                type="date"
                value={filtros.dataFim}
                onChange={(e) => handleFiltroChange("dataFim", e.target.value)}
                className="bg-slate-700 border-slate-600 text-white text-sm" />

              </div>
            </div>
          }

          {isGerente &&
          <div className="space-y-2">
              <Label className="text-slate-300">Vendedor</Label>
              <Select value={filtros.vendedor} onValueChange={(value) => handleFiltroChange("vendedor", value)}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600 text-white">
                  <SelectItem value="todos">Todos os Vendedores</SelectItem>
                  {vendedores.map((vendedor) =>
                <SelectItem key={vendedor.id} value={vendedor.nome}>
                      {vendedor.nome}
                    </SelectItem>
                )}
                </SelectContent>
              </Select>
            </div>
          }

          <div className="space-y-2">
            <Label className="text-slate-300">Segmento</Label>
            <Select value={filtros.segmento} onValueChange={(value) => handleFiltroChange("segmento", value)}>
              <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600 text-white">
                <SelectItem value="todos">Todos os Segmentos</SelectItem>
                <SelectItem value="Corporativo">Corporativo</SelectItem>
                <SelectItem value="PME">PME</SelectItem>
                <SelectItem value="Micro">Micro</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>);

}
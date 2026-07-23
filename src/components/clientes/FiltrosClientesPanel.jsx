import React from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import FiltroRecorrencia from "./FiltroRecorrencia";

/**
 * Conteúdo dos filtros de Gestão de Clientes — usado no Card (desktop)
 * e dentro do MobileDrawer (mobile), conforme a Skill Mobile Global.
 */
export default function FiltrosClientesPanel({ filtros, setFiltros, vendedores = [], aba, clientes, faturamentoPorCliente }) {
  return (
    <div className="space-y-3">
      {['clientes', 'contatos_fidelizados'].includes(aba) && (
        <FiltroRecorrencia
          valor={filtros.recorrencia}
          onChange={(value) => setFiltros({ ...filtros, recorrencia: value })}
          clientes={clientes}
          faturamentoPorCliente={faturamentoPorCliente}
        />
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="lg:col-span-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Buscar cliente por nome, CNPJ, telefone ou email..."
              value={filtros.busca}
              onChange={(e) => setFiltros({ ...filtros, busca: e.target.value })}
              className="pl-10 h-9 border-slate-300 focus:border-blue-500"
            />
          </div>
        </div>

        <Select value={filtros.status} onValueChange={(value) => setFiltros({ ...filtros, status: value })}>
          <SelectTrigger className="h-9 border-slate-300 focus:border-blue-500"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Status</SelectItem>
            <SelectItem value="Ativo">Ativo</SelectItem>
            <SelectItem value="Inativo">Inativo</SelectItem>
            <SelectItem value="Em Risco">Em Risco</SelectItem>
            <SelectItem value="Promotor">Promotor</SelectItem>
            <SelectItem value="Prospect">Prospect</SelectItem>
            <SelectItem value="Lead Qualificado">Lead Qualificado</SelectItem>
            <SelectItem value="Lead Frio">Lead Frio</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filtros.classificacao} onValueChange={(value) => setFiltros({ ...filtros, classificacao: value })}>
          <SelectTrigger className="h-9 border-slate-300 focus:border-blue-500"><SelectValue placeholder="Classificação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as Classificações</SelectItem>
            <SelectItem value="A - Alto Potencial">A - Alto Potencial</SelectItem>
            <SelectItem value="B - Médio Potencial">B - Médio Potencial</SelectItem>
            <SelectItem value="C - Baixo Potencial">C - Baixo Potencial</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filtros.responsavel} onValueChange={(value) => setFiltros({ ...filtros, responsavel: value })}>
          <SelectTrigger className="h-9 border-slate-300 focus:border-blue-500"><SelectValue placeholder="👤 Responsável" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Responsáveis</SelectItem>
            {vendedores.map((vendedor) => (
              <SelectItem key={vendedor.value} value={vendedor.value}>{vendedor.label}</SelectItem>
            ))}
            <SelectItem value="nao_atribuido">Não Atribuído</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
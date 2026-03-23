import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, Edit, Trash2, User, Phone, Mail, DollarSign, Link as LinkIcon, CheckCircle, AlertCircle } from "lucide-react";

// Função para formatar moeda
const formatCurrency = (value) => {
  return (value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
};

// Função para obter os nomes dos últimos 4 meses
const getMonthHeaders = () => {
  const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const headers = [];
  for (let i = 0; i < 4; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    headers.push({
      key: d.toISOString().slice(0, 7), // YYYY-MM
      label: monthNames[d.getMonth()],
    });
  }
  return headers.reverse(); // Ordem cronológica
};


export default function VendedorTable({ vendedores, onEditar, onExcluir }) {
  const [usuarios, setUsuarios] = useState([]);
  const monthHeaders = getMonthHeaders();

  useEffect(() => {
    carregarUsuarios();
  }, []);

  const carregarUsuarios = async () => {
    try {
      const users = await base44.entities.User.list();
      setUsuarios(users || []);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    }
  };

  const getStatusChip = (status) => {
    const cores = {
      ativo: "bg-green-100 text-green-700",
      inativo: "bg-red-100 text-red-700",
      ferias: "bg-yellow-100 text-yellow-700"
    };
    return <Badge className={`capitalize ${cores[status] || 'bg-slate-100 text-slate-600'}`}>{status}</Badge>;
  };

  const getVinculoStatus = (vendedor) => {
    const usuarioVinculado = vendedor.user_id
      ? usuarios.find(u => u.id === vendedor.user_id)
      : usuarios.find(u => u.email === vendedor.email); // fallback legado

    if (usuarioVinculado) {
      return {
        vinculado: true,
        usuario: usuarioVinculado,
        badge: (
          <Badge className="bg-green-100 text-green-700 border border-green-300 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            Vinculado
          </Badge>
        )
      };
    }
    
    return {
      vinculado: false,
      usuario: null,
      badge: (
        <Badge className="bg-amber-100 text-amber-700 border border-amber-300 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          Sem Login
        </Badge>
      )
    };
  };
  
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader className="bg-slate-50">
          <TableRow>
            <TableHead className="w-[250px]">Vendedor</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Contatos</TableHead>
            <TableHead className="text-right">Meta Mensal</TableHead>
            <TableHead className="text-right">Faturamento (4 meses)</TableHead>
            {monthHeaders.map(header => (
              <TableHead key={header.key} className="text-right">{header.label}</TableHead>
            ))}
            <TableHead className="text-center">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vendedores.map((vendedor) => {
            const vinculoStatus = getVinculoStatus(vendedor);
            const nomeExibido = vinculoStatus.usuario?.full_name || vendedor.nome || vendedor.email || '—';

            return (
              <TableRow key={vendedor.id} className="hover:bg-slate-50">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex-shrink-0 flex items-center justify-center overflow-hidden">
                      {vendedor.foto_url ? (
                        <img src={vendedor.foto_url} alt={vendedor.nome} className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-5 h-5 text-slate-500" />
                      )}
                    </div>
                    <div className="font-medium text-slate-800 truncate">{nomeExibido}</div>
                    {vinculoStatus.usuario && (
                      <div className="text-xs text-slate-400 truncate">{vinculoStatus.usuario.email}</div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getStatusChip(vendedor.status)}
                    {vinculoStatus.badge}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    {vinculoStatus.usuario?.email && <div className="flex items-center gap-1.5 text-xs text-slate-600"><Mail className="w-3 h-3" />{vinculoStatus.usuario.email}</div>}
                    {vendedor.telefone && <div className="flex items-center gap-1.5 text-xs text-slate-600"><Phone className="w-3 h-3" />{vendedor.telefone}</div>}
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium text-slate-700">{formatCurrency(vendedor.meta_mensal)}</TableCell>
                <TableCell className="text-right font-bold text-blue-600">{formatCurrency(vendedor.faturamentoTotal || 0)}</TableCell>
                {monthHeaders.map(header => (
                  <TableCell key={header.key} className="text-right text-slate-600">
                    {formatCurrency(vendedor.vendasMensais?.[header.key] || 0)}
                  </TableCell>
                ))}
                <TableCell className="text-center">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEditar(vendedor)}>
                        <Edit className="w-4 h-4 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onExcluir(vendedor.id)} className="text-red-600">
                        <Trash2 className="w-4 h-4 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
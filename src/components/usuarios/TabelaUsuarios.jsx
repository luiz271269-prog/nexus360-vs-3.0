import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, Edit, Shield, UserCheck, User, AlertTriangle, Crown } from "lucide-react";

export default function TabelaUsuarios({ usuarios, vendedores, onEditar, onAlterarRole, usuarioAtual }) {

  const getRoleInfo = (role) => {
    return role === 'admin' 
      ? { label: 'Admin', icon: Shield, color: 'bg-blue-100 text-blue-800 border-blue-200' }
      : { label: 'Vendedor', icon: UserCheck, color: 'bg-green-100 text-green-800 border-green-200' };
  };

  const getVendedorStatus = (usuarioEmail) => {
    const isLinked = vendedores.some(v => v.email === usuarioEmail);
    return isLinked
      ? { label: 'Vinculado', icon: UserCheck, color: 'text-green-600' }
      : { label: 'Não Vinculado', icon: AlertTriangle, color: 'text-amber-600' };
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
      <Table>
        <TableHeader className="bg-slate-50">
          <TableRow>
            <TableHead className="w-[300px]">Usuário</TableHead>
            <TableHead>Perfil</TableHead>
            <TableHead>Status Vendedor</TableHead>
            <TableHead>Criado em</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {usuarios.map((usuario) => {
            const roleInfo = getRoleInfo(usuario.role);
            const vendedorStatus = getVendedorStatus(usuario.email);
            const isCurrentUser = usuario.id === usuarioAtual?.id;

            return (
              <TableRow key={usuario.id} className="hover:bg-slate-50">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600">
                      {usuario.full_name ? usuario.full_name.charAt(0).toUpperCase() : <User />}
                    </div>
                    <div>
                      <div className="font-medium text-slate-800 flex items-center gap-2">
                        {usuario.full_name}
                        {usuario.attendant_sector && <span className="text-slate-400">•</span>}
                        {usuario.attendant_sector && <span className="text-slate-600 font-normal text-sm">{usuario.attendant_sector}</span>}
                        {isCurrentUser && <Crown className="w-4 h-4 text-amber-500" />}
                      </div>
                      <div className="text-sm text-slate-500">{usuario.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={`gap-1.5 ${roleInfo.color}`}>
                    <roleInfo.icon className="w-3 h-3" />
                    {roleInfo.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  {usuario.role === 'user' && (
                    <div className={`flex items-center gap-1.5 text-sm ${vendedorStatus.color}`}>
                      <vendedorStatus.icon className="w-4 h-4" />
                      <span>{vendedorStatus.label}</span>
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-slate-600">
                  {new Date(usuario.created_date).toLocaleDateString('pt-BR')}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" disabled={isCurrentUser}>
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => onEditar(usuario)}>
                        <Edit className="w-4 h-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      {usuario.role === 'user' ? (
                        <DropdownMenuItem onClick={() => onAlterarRole(usuario, 'admin')}>
                          <Shield className="w-4 h-4 mr-2" />
                          Tornar Admin
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => onAlterarRole(usuario, 'user')}>
                          <UserCheck className="w-4 h-4 mr-2" />
                          Tornar Vendedor
                        </DropdownMenuItem>
                      )}
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
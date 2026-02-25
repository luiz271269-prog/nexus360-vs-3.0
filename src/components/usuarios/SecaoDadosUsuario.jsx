import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { User, Shield, Lock } from 'lucide-react';
import CardRegraFixaHardCore from './CardRegraFixaHardCore';

const SETORES = [
  { value: "vendas", label: "Vendas" },
  { value: "assistencia", label: "Assistência" },
  { value: "financeiro", label: "Financeiro" },
  { value: "fornecedor", label: "Compras" },
  { value: "geral", label: "Geral" },
];

const FUNCOES = [
  { value: "junior", label: "Júnior" },
  { value: "pleno", label: "Pleno" },
  { value: "senior", label: "Sênior" },
  { value: "coordenador", label: "Coordenador" },
  { value: "gerente", label: "Gerente" },
];

const PERFIS_RAPIDOS = {
  admin: { 
    label: "👑 Admin Total", 
    desc: "Acesso completo",
    cor: "from-red-500 to-orange-500",
  },
  gerente: { 
    label: "👔 Gerente", 
    desc: "Visão + gestão",
    cor: "from-blue-500 to-indigo-500",
  },
  vendedor: { 
    label: "💼 Vendedor", 
    desc: "Operacional",
    cor: "from-green-500 to-emerald-500",
  },
};

export default function SecaoDadosUsuario({
  usuarioSelecionado,
  atualizarUsuario,
  integracoesWhatsApp = []
}) {
  if (!usuarioSelecionado) return null;

  return (
    <div className="space-y-4">
      {/* Dados Básicos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-5 h-5" />
            Informações Básicas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-700 mb-1 block">Nome Completo</label>
              <Input
                value={usuarioSelecionado.nome || ""}
                onChange={(e) => atualizarUsuario("nome", e.target.value)}
                placeholder="Nome do usuário"
                className="h-9"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700 mb-1 block">E-mail</label>
              <Input
                value={usuarioSelecionado.email || ""}
                onChange={(e) => atualizarUsuario("email", e.target.value)}
                placeholder="email@empresa.com"
                className="h-9"
                disabled={!usuarioSelecionado.isNovo}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-700 mb-1 block">Setor</label>
              <Select value={usuarioSelecionado.setor || "geral"} onValueChange={(v) => atualizarUsuario("setor", v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SETORES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700 mb-1 block">Função</label>
              <Select value={usuarioSelecionado.funcao || "pleno"} onValueChange={(v) => atualizarUsuario("funcao", v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FUNCOES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700 mb-1 block">Tipo de Acesso</label>
              <Select value={usuarioSelecionado.tipoAcesso || "user"} onValueChange={(v) => atualizarUsuario("tipoAcesso", v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="user">Usuário</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
            <div>
              <p className="text-sm font-medium text-slate-800">Status do Usuário</p>
              <p className="text-xs text-slate-500">Inativos não acessam o sistema</p>
            </div>
            <Switch
              checked={usuarioSelecionado.ativo !== false}
              onCheckedChange={(v) => atualizarUsuario("ativo", v)}
            />
          </div>
        </CardContent>
      </Card>



      {/* Perfis Rápidos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Perfis de Acesso Rápido
          </CardTitle>
          <CardDescription>Clique para aplicar automaticamente</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(PERFIS_RAPIDOS).map(([key, perfil]) => (
              <Button
                key={key}
                variant="outline"
                className={`h-auto flex-col items-start p-3 bg-gradient-to-br ${perfil.cor} text-white hover:text-white border-0`}
                onClick={() => {
                  // Aqui pode-se integrar aplicar preset se necessário
                }}
              >
                <div className="font-bold text-sm">{perfil.label}</div>
                <div className="text-[10px] opacity-90">{perfil.desc}</div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
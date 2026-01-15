import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCircle2, Zap, AlertCircle, Users } from 'lucide-react';

const SETORES = [
  { value: "vendas", label: "Vendas" },
  { value: "assistencia", label: "Assistência" },
  { value: "financeiro", label: "Financeiro" },
  { value: "fornecedor", label: "Fornecedor" },
  { value: "geral", label: "Geral" },
];

export default function SecaoComunicacaoUsuario({
  usuarioSelecionado,
  integracoesWhatsApp,
  atualizarUsuario
}) {
  if (!usuarioSelecionado) return null;

  return (
    <div className="space-y-4">
      {/* Atendente WhatsApp */}
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-5 h-5 text-green-600" />
            📱 Atendente WhatsApp
          </CardTitle>
          <CardDescription>Habilitar para receber conversas do WhatsApp</CardDescription>
        </CardHeader>
        <CardContent>
          <Switch
            checked={usuarioSelecionado.is_whatsapp_attendant || false}
            onCheckedChange={(v) => atualizarUsuario("is_whatsapp_attendant", v)}
          />
        </CardContent>
      </Card>

      {usuarioSelecionado.is_whatsapp_attendant && (
        <>
          {/* Pode Transferir */}
          <Card className="border-amber-200 bg-amber-50">
            <CardHeader>
              <CardTitle className="text-base">🔄 Pode Transferir Conversas</CardTitle>
              <CardDescription>Permitir transferir conversas para outros atendentes</CardDescription>
            </CardHeader>
            <CardContent>
              <Switch
                checked={usuarioSelecionado.permissoes_comunicacao?.pode_transferir_conversas || false}
                onCheckedChange={(v) => atualizarUsuario("permissoes_comunicacao", { 
                  ...usuarioSelecionado.permissoes_comunicacao, 
                  pode_transferir_conversas: v 
                })}
              />
            </CardContent>
          </Card>

          {/* Conexões WhatsApp */}
          {integracoesWhatsApp.length > 0 && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-base">📞 Conexões WhatsApp Permitidas</CardTitle>
                <CardDescription>Selecione quais conexões este usuário pode acessar</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {integracoesWhatsApp.map(int => {
                  const perms = usuarioSelecionado.whatsapp_permissions || [];
                  const perm = perms.find(p => p.integration_id === int.id);
                  const habilitado = !!perm;
                  
                  const toggleConexao = () => {
                    let novasPerms = [...perms];
                    if (habilitado) {
                      novasPerms = novasPerms.filter(p => p.integration_id !== int.id);
                    } else {
                      novasPerms.push({
                        integration_id: int.id,
                        integration_name: int.nome_instancia,
                        can_view: true,
                        can_receive: true,
                        can_send: true
                      });
                    }
                    atualizarUsuario("whatsapp_permissions", novasPerms);
                  };

                  const togglePermissao = (campo) => {
                    if (!habilitado) return;
                    const novasPerms = perms.map(p => {
                      if (p.integration_id === int.id) {
                        return { ...p, [campo]: !p[campo] };
                      }
                      return p;
                    });
                    atualizarUsuario("whatsapp_permissions", novasPerms);
                  };
                  
                  return (
                    <div key={int.id} className="p-3 bg-white rounded-lg border border-blue-200">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={habilitado}
                            onCheckedChange={toggleConexao}
                          />
                          <span className="text-sm font-medium">{int.nome_instancia}</span>
                          <Badge variant="outline" className="text-[9px]">{int.numero_telefone}</Badge>
                        </div>
                        <Badge className={int.status === 'conectado' ? 'bg-green-500' : 'bg-red-500'}>
                          {int.status}
                        </Badge>
                      </div>
                      {habilitado && (
                        <div className="flex gap-4 pl-6 text-xs mt-2">
                          <label className="flex items-center gap-1 cursor-pointer">
                            <Checkbox
                              checked={perm?.can_view !== false}
                              onCheckedChange={() => togglePermissao("can_view")}
                            />
                            <span>Ver</span>
                          </label>
                          <label className="flex items-center gap-1 cursor-pointer">
                            <Checkbox
                              checked={perm?.can_receive !== false}
                              onCheckedChange={() => togglePermissao("can_receive")}
                            />
                            <span>Receber</span>
                          </label>
                          <label className="flex items-center gap-1 cursor-pointer">
                            <Checkbox
                              checked={perm?.can_send !== false}
                              onCheckedChange={() => togglePermissao("can_send")}
                            />
                            <span>Enviar</span>
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Setores & Capacidade */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Setores Atendidos */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">🎯 Setores Atendidos</CardTitle>
                <CardDescription>Selecione os setores que este atendente cobre</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {SETORES.map(s => {
                    const setores = usuarioSelecionado.whatsapp_setores || [];
                    const ativo = setores.includes(s.value);
                    return (
                      <Badge
                        key={s.value}
                        variant={ativo ? "default" : "outline"}
                        className={`cursor-pointer text-xs px-3 py-2 ${ativo ? 'bg-blue-500' : ''}`}
                        onClick={() => {
                          const novos = ativo 
                            ? setores.filter(x => x !== s.value)
                            : [...setores, s.value];
                          atualizarUsuario("whatsapp_setores", novos);
                        }}
                      >
                        {s.label}
                      </Badge>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Máx. Conversas */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">⚡ Capacidade</CardTitle>
                <CardDescription>Máximo de conversas simultâneas</CardDescription>
              </CardHeader>
              <CardContent>
                <Input
                  type="number"
                  min="1"
                  max="50"
                  value={usuarioSelecionado.max_concurrent_conversations || 5}
                  onChange={(e) => atualizarUsuario("max_concurrent_conversations", parseInt(e.target.value) || 5)}
                  className="h-9"
                />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
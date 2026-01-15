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
                        can_send: true,
                        can_transfer: false,
                        setores_cobertura: []
                      });
                    }
                    atualizarUsuario("whatsapp_permissions", novasPerms);
                  };

                  const updatePerm = (campo, valor) => {
                    if (!habilitado) return;
                    const novasPerms = perms.map(p => {
                      if (p.integration_id === int.id) {
                        return { ...p, [campo]: valor };
                      }
                      return p;
                    });
                    atualizarUsuario("whatsapp_permissions", novasPerms);
                  };

                  const toggleSetor = (setorValue) => {
                    const setoresAtualmente = perm?.setores_cobertura || [];
                    const novosSetores = setoresAtualmente.includes(setorValue)
                      ? setoresAtualmente.filter(s => s !== setorValue)
                      : [...setoresAtualmente, setorValue];
                    updatePerm("setores_cobertura", novosSetores);
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
                         <div className="space-y-3 pl-6 mt-2">
                           {/* Permissões: Ver/Receber/Enviar/Transferir */}
                           <div className="flex gap-3 text-xs">
                             {[
                               { key: 'can_view', label: 'Ver' },
                               { key: 'can_receive', label: 'Receber' },
                               { key: 'can_send', label: 'Enviar' },
                               { key: 'can_transfer', label: 'Transferir' }
                             ].map(({ key, label }) => (
                               <label key={key} className="flex items-center gap-1 cursor-pointer">
                                 <Checkbox
                                   checked={perm?.[key] !== false}
                                   onCheckedChange={(v) => updatePerm(key, v)}
                                 />
                                 <span>{label}</span>
                               </label>
                             ))}
                           </div>

                           {/* Setores de Cobertura por Instância */}
                           <div>
                             <p className="text-[10px] font-bold text-slate-600 mb-1">🎯 Setores</p>
                             <div className="flex flex-wrap gap-1">
                               {SETORES.map(s => {
                                 const setoresInstancia = perm?.setores_cobertura || [];
                                 const ativo = setoresInstancia.includes(s.value);
                                 return (
                                   <Badge
                                     key={s.value}
                                     variant={ativo ? "default" : "outline"}
                                     className={`cursor-pointer text-[10px] px-2 py-0.5 ${ativo ? 'bg-blue-500' : ''}`}
                                     onClick={() => toggleSetor(s.value)}
                                   >
                                     {s.label}
                                   </Badge>
                                 );
                               })}
                             </div>
                           </div>
                         </div>
                       )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}


        </>
      )}
    </div>
  );
}
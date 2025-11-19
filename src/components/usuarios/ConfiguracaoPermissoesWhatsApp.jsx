import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Phone, Eye, UserPlus, Send, CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function ConfiguracaoPermissoesWhatsApp({ 
  whatsappPermissions = [], 
  onChange 
}) {
  const [integracoes, setIntegracoes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarIntegracoes();
  }, []);

  const carregarIntegracoes = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.WhatsAppIntegration.list();
      setIntegracoes(data);

      // Inicializar permissões para novas instâncias
      const novasPermissoes = [...whatsappPermissions];
      data.forEach(integracao => {
        if (!novasPermissoes.find(p => p.integration_id === integracao.id)) {
          novasPermissoes.push({
            integration_id: integracao.id,
            integration_name: integracao.nome_instancia,
            can_view: true,
            can_receive: true,
            can_send: true
          });
        }
      });

      if (novasPermissoes.length !== whatsappPermissions.length) {
        onChange(novasPermissoes);
      }
    } catch (error) {
      console.error("Erro ao carregar integrações:", error);
    }
    setLoading(false);
  };

  const handleTogglePermission = (integrationId, permissionKey) => {
    const novasPermissoes = whatsappPermissions.map(p => {
      if (p.integration_id === integrationId) {
        return {
          ...p,
          [permissionKey]: !p[permissionKey]
        };
      }
      return p;
    });
    onChange(novasPermissoes);
  };

  const getPermissao = (integrationId, permissionKey) => {
    const perm = whatsappPermissions.find(p => p.integration_id === integrationId);
    return perm ? perm[permissionKey] : true;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (integracoes.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          Nenhuma instância WhatsApp configurada. Configure uma conexão na Central de Comunicação primeiro.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <Alert className="bg-blue-50 border-blue-200">
        <Phone className="w-4 h-4 text-blue-600" />
        <AlertDescription className="text-sm text-blue-800">
          Configure quais instâncias de WhatsApp este usuário pode acessar e quais ações ele pode realizar em cada uma.
        </AlertDescription>
      </Alert>

      <div className="space-y-3">
        {integracoes.map(integracao => {
          const canView = getPermissao(integracao.id, 'can_view');
          const canReceive = getPermissao(integracao.id, 'can_receive');
          const canSend = getPermissao(integracao.id, 'can_send');

          return (
            <Card key={integracao.id} className={`transition-all ${
              canView ? 'border-green-200 bg-green-50/30' : 'border-slate-200 bg-slate-50/30 opacity-60'
            }`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      integracao.status === 'conectado' 
                        ? 'bg-gradient-to-br from-green-500 to-emerald-600' 
                        : 'bg-gradient-to-br from-slate-400 to-slate-600'
                    }`}>
                      <Phone className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{integracao.nome_instancia}</CardTitle>
                      <p className="text-xs text-slate-600">{integracao.numero_telefone}</p>
                    </div>
                  </div>
                  <Badge className={
                    integracao.status === 'conectado' 
                      ? 'bg-green-100 text-green-800 border-green-200' 
                      : 'bg-slate-100 text-slate-800 border-slate-200'
                  }>
                    {integracao.status === 'conectado' ? '🟢 Conectado' : '🔴 Desconectado'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  {/* Ver */}
                  <div className="flex flex-col items-center gap-2 p-3 bg-white rounded-lg border border-slate-200">
                    <div className="flex items-center gap-2">
                      <Eye className={`w-4 h-4 ${canView ? 'text-blue-600' : 'text-slate-400'}`} />
                      <Label className="text-sm font-medium cursor-pointer">Ver</Label>
                    </div>
                    <Switch
                      checked={canView}
                      onCheckedChange={() => handleTogglePermission(integracao.id, 'can_view')}
                    />
                    {canView ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-slate-300" />
                    )}
                  </div>

                  {/* Receber */}
                  <div className="flex flex-col items-center gap-2 p-3 bg-white rounded-lg border border-slate-200">
                    <div className="flex items-center gap-2">
                      <UserPlus className={`w-4 h-4 ${canReceive ? 'text-purple-600' : 'text-slate-400'}`} />
                      <Label className="text-sm font-medium cursor-pointer">Receber</Label>
                    </div>
                    <Switch
                      checked={canReceive}
                      onCheckedChange={() => handleTogglePermission(integracao.id, 'can_receive')}
                      disabled={!canView}
                    />
                    {canReceive ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-slate-300" />
                    )}
                  </div>

                  {/* Enviar */}
                  <div className="flex flex-col items-center gap-2 p-3 bg-white rounded-lg border border-slate-200">
                    <div className="flex items-center gap-2">
                      <Send className={`w-4 h-4 ${canSend ? 'text-green-600' : 'text-slate-400'}`} />
                      <Label className="text-sm font-medium cursor-pointer">Enviar</Label>
                    </div>
                    <Switch
                      checked={canSend}
                      onCheckedChange={() => handleTogglePermission(integracao.id, 'can_send')}
                      disabled={!canView}
                    />
                    {canSend ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-slate-300" />
                    )}
                  </div>
                </div>

                <div className="mt-3 p-2 bg-slate-50 rounded text-xs text-slate-600">
                  <p><strong>Ver:</strong> Visualizar conversas desta instância</p>
                  <p><strong>Receber:</strong> Receber atribuições automáticas ou da fila</p>
                  <p><strong>Enviar:</strong> Enviar mensagens por este canal</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
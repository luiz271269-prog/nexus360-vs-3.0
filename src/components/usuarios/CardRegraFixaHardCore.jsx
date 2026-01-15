import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Lock, Zap } from 'lucide-react';

export default function CardRegraFixaHardCore({ usuario, integracoes = [] }) {
  if (!usuario) return null;

  // Setores permitidos (whatsapp_setores)
  const setoresPermitidos = usuario.whatsapp_setores || [];
  const ALL_SETORES = ['vendas', 'assistencia', 'financeiro', 'fornecedor', 'geral'];
  const setoresBloqueados = ALL_SETORES.filter(s => !setoresPermitidos.includes(s));

  // Integrações permitidas (whatsapp_conexoes)
  const conexoesPermitidas = usuario.whatsapp_conexoes || [];
  const conexoesBloqueadas = integracoes.filter(i => !conexoesPermitidas.includes(i.id));

  // Canais ativos (P9)
  const canaisPermitidos = usuario.pode_ver_conversas ? ['whatsapp'] : [];
  const canaisBloqueados = usuario.pode_ver_conversas ? [] : ['whatsapp'];

  return (
    <Card className="border-2 border-red-300 bg-gradient-to-r from-red-50 to-orange-50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-600 rounded-lg">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">🔒 Regras Fixas de Segurança (Hard Core)</CardTitle>
              <CardDescription className="text-xs">
                Bloqueios automáticos baseados em perfil e permissões legadas (P1/P9/P10/P11)
              </CardDescription>
            </div>
          </div>
          <Badge variant="destructive" className="px-3 py-1">
            NÃO EDITÁVEL
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Alerta informativo */}
        <Alert className="bg-yellow-50 border-yellow-200">
          <Zap className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-xs">
            Estas são as <strong>regras de segurança automáticas</strong> derivadas de seus dados legados. 
            Para adicionar bloqueios/liberações extras, use o painel <strong>Nexus360</strong> abaixo.
          </AlertDescription>
        </Alert>

        {/* Setores Permitidos / Bloqueados (P11) */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-red-600" />
            <span className="text-sm font-semibold">P11: Setores</span>
          </div>
          {setoresPermitidos.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">✅ Permitidos:</p>
              <div className="flex flex-wrap gap-2">
                {setoresPermitidos.map(s => (
                  <Badge key={s} variant="outline" className="bg-green-50 text-green-700 border-green-300 capitalize">
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {setoresBloqueados.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">❌ Bloqueados:</p>
              <div className="flex flex-wrap gap-2">
                {setoresBloqueados.map(s => (
                  <Badge key={s} variant="destructive" className="capitalize">
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Integrações / Conexões Permitidas (P10) */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-orange-600" />
            <span className="text-sm font-semibold">P10: Integrações WhatsApp</span>
          </div>
          {conexoesPermitidas.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">✅ Permitidas:</p>
              <div className="flex flex-wrap gap-2">
                {integracoes
                  .filter(i => conexoesPermitidas.includes(i.id))
                  .map(i => (
                    <Badge key={i.id} variant="outline" className="bg-green-50 text-green-700 border-green-300 text-xs">
                      {i.nome_instancia} ({i.numero_telefone})
                    </Badge>
                  ))}
              </div>
            </div>
          )}
          {conexoesBloqueadas.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">❌ Bloqueadas:</p>
              <div className="flex flex-wrap gap-2">
                {conexoesBloqueadas.map(i => (
                  <Badge key={i.id} variant="destructive" className="text-xs">
                    {i.nome_instancia}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Canais Ativos (P9) */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold">P9: Canais</span>
          </div>
          {canaisPermitidos.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">✅ Permitidos:</p>
              <div className="flex flex-wrap gap-2">
                {canaisPermitidos.map(c => (
                  <Badge key={c} variant="outline" className="bg-green-50 text-green-700 border-green-300 capitalize">
                    {c}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {canaisBloqueados.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">❌ Bloqueados:</p>
              <div className="flex flex-wrap gap-2">
                {canaisBloqueados.map(c => (
                  <Badge key={c} variant="destructive" className="capitalize">
                    {c}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Nota de segurança */}
        <Alert className="bg-blue-50 border-blue-200 mt-4">
          <Shield className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-xs text-blue-700">
            <strong>💡 Dica:</strong> Se precisa bloquear/liberar ALÉM destas regras fixas, 
            configure bloqueios extras ou liberações especiais no painel <strong>Nexus360</strong> abaixo.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
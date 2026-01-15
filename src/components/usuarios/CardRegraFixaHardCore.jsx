import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Lock, Zap, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function CardRegraFixaHardCore({ usuario, integracoes = [] }) {
  if (!usuario) return null;

  // Setores permitidos (whatsapp_setores)
  const setoresPermitidos = usuario.whatsapp_setores || [];
  const ALL_SETORES = ['vendas', 'assistencia', 'financeiro', 'fornecedor', 'geral'];
  const setoresBloqueados = ALL_SETORES.filter(s => !setoresPermitidos.includes(s));

  // Integrações permitidas (whatsapp_conexoes)
  const conexoesPermitidas = usuario.whatsapp_conexoes || [];
  const integracoesPermitidas = integracoes.filter(i => conexoesPermitidas.includes(i.id));
  const conexoesBloqueadas = integracoes.filter(i => !conexoesPermitidas.includes(i.id));

  // Canais ativos (P9)
  const canaisPermitidos = usuario.pode_ver_conversas ? ['whatsapp'] : [];
  const canaisBloqueados = usuario.pode_ver_conversas ? [] : ['whatsapp'];

  // Validação de conflitos lógicos
  const temSetoresPermitidos = setoresPermitidos.length > 0;
  const temConexoesPermitidas = conexoesPermitidas.length > 0;
  const temCanaisPermitidos = canaisPermitidos.length > 0;
  
  const acessoBloqueado = !temSetoresPermitidos || !temConexoesPermitidas || !temCanaisPermitidos;
  const acessoTotalmenteBloqueado = !temSetoresPermitidos && !temConexoesPermitidas && !temCanaisPermitidos;

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
         {/* ALERTA CRÍTICO: Acesso totalmente bloqueado */}
         {acessoTotalmenteBloqueado && (
           <Alert className="bg-red-100 border-2 border-red-500">
             <AlertTriangle className="h-4 w-4 text-red-600" />
             <AlertDescription className="text-xs text-red-800 font-semibold">
               🚨 <strong>CONFLITO CRÍTICO:</strong> Nenhum setor, integração ou canal permitido. 
               Este usuário NÃO pode acessar NADA na Comunicação! Revise as configurações legadas.
             </AlertDescription>
           </Alert>
         )}

         {/* ALERTA: Acesso parcialmente bloqueado */}
         {acessoBloqueado && !acessoTotalmenteBloqueado && (
           <Alert className="bg-orange-100 border-2 border-orange-500">
             <AlertTriangle className="h-4 w-4 text-orange-600" />
             <AlertDescription className="text-xs text-orange-800 font-semibold">
               ⚠️ <strong>CONFLITO PARCIAL:</strong> Alguns bloqueios podem limitar acesso. 
               Verifique se as permissões abaixo fazem sentido.
             </AlertDescription>
           </Alert>
         )}

         {/* Alerta informativo padrão */}
         <Alert className="bg-yellow-50 border-yellow-200">
           <Zap className="h-4 w-4 text-yellow-600" />
           <AlertDescription className="text-xs">
             Estas são as <strong>regras de segurança automáticas</strong> derivadas de seus dados legados. 
             Para adicionar bloqueios/liberações extras, use o painel <strong>Nexus360</strong> abaixo.
           </AlertDescription>
         </Alert>

        {/* Setores Permitidos / Bloqueados (P11) */}
        <div className={`space-y-2 p-3 rounded-lg border-2 ${!temSetoresPermitidos ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-300'}`}>
          <div className="flex items-center gap-2">
            {temSetoresPermitidos ? (
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600" />
            )}
            <span className="text-sm font-semibold">P11: Setores</span>
            <Badge variant={temSetoresPermitidos ? 'outline' : 'destructive'} className="text-xs">
              {temSetoresPermitidos ? '✅ OK' : '❌ BLOQUEADO'}
            </Badge>
          </div>
          {setoresPermitidos.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">✅ Permitidos ({setoresPermitidos.length}):</p>
              <div className="flex flex-wrap gap-2">
                {setoresPermitidos.map(s => (
                  <Badge key={s} variant="outline" className="bg-white text-green-700 border-green-400 capitalize font-medium">
                    ✓ {s}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {setoresBloqueados.length > 0 && (
            <div className={setoresPermitidos.length > 0 ? 'mt-2 pt-2 border-t border-green-200' : ''}>
              <p className="text-xs text-muted-foreground mb-1">❌ Bloqueados ({setoresBloqueados.length}):</p>
              <div className="flex flex-wrap gap-2">
                {setoresBloqueados.map(s => (
                  <Badge key={s} variant="outline" className="bg-red-100 text-red-700 border-red-300 capitalize text-xs">
                    ✕ {s}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Integrações / Conexões Permitidas (P10) */}
        <div className={`space-y-2 p-3 rounded-lg border-2 ${!temConexoesPermitidas ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-300'}`}>
          <div className="flex items-center gap-2">
            {temConexoesPermitidas ? (
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600" />
            )}
            <span className="text-sm font-semibold">P10: Integrações WhatsApp</span>
            <Badge variant={temConexoesPermitidas ? 'outline' : 'destructive'} className="text-xs">
              {temConexoesPermitidas ? '✅ OK' : '❌ BLOQUEADO'}
            </Badge>
          </div>
          {integracoesPermitidas.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">✅ Permitidas ({integracoesPermitidas.length}):</p>
              <div className="flex flex-wrap gap-2">
                {integracoesPermitidas.map(i => (
                  <Badge key={i.id} variant="outline" className="bg-white text-green-700 border-green-400 text-xs font-medium">
                    ✓ {i.nome_instancia}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {conexoesBloqueadas.length > 0 && (
            <div className={integracoesPermitidas.length > 0 ? 'mt-2 pt-2 border-t border-green-200' : ''}>
              <p className="text-xs text-muted-foreground mb-1">❌ Bloqueadas ({conexoesBloqueadas.length}):</p>
              <div className="flex flex-wrap gap-2">
                {conexoesBloqueadas.map(i => (
                  <Badge key={i.id} variant="outline" className="bg-red-100 text-red-700 border-red-300 text-xs">
                    ✕ {i.nome_instancia}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Canais Ativos (P9) */}
        <div className={`space-y-2 p-3 rounded-lg border-2 ${!temCanaisPermitidos ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-300'}`}>
          <div className="flex items-center gap-2">
            {temCanaisPermitidos ? (
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600" />
            )}
            <span className="text-sm font-semibold">P9: Canais</span>
            <Badge variant={temCanaisPermitidos ? 'outline' : 'destructive'} className="text-xs">
              {temCanaisPermitidos ? '✅ OK' : '❌ BLOQUEADO'}
            </Badge>
          </div>
          {canaisPermitidos.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">✅ Permitidos ({canaisPermitidos.length}):</p>
              <div className="flex flex-wrap gap-2">
                {canaisPermitidos.map(c => (
                  <Badge key={c} variant="outline" className="bg-white text-green-700 border-green-400 capitalize font-medium">
                    ✓ {c}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {canaisBloqueados.length > 0 && (
            <div className={canaisPermitidos.length > 0 ? 'mt-2 pt-2 border-t border-green-200' : ''}>
              <p className="text-xs text-muted-foreground mb-1">❌ Bloqueados ({canaisBloqueados.length}):</p>
              <div className="flex flex-wrap gap-2">
                {canaisBloqueados.map(c => (
                  <Badge key={c} variant="outline" className="bg-red-100 text-red-700 border-red-300 capitalize text-xs">
                    ✕ {c}
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
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail } from 'lucide-react';
import ConfiguracaoPermissoesEmail from './ConfiguracaoPermissoesEmail';

// Padrão "Conexões WhatsApp Permitidas" para e-mail: o usuário marca quais
// caixas EmailAccount pode Ver / Receber / Enviar e define a caixa padrão.
export default function SecaoEmailUsuario({ usuarioSelecionado, atualizarUsuario }) {
  if (!usuarioSelecionado) return null;

  return (
    <Card className="border-indigo-200 bg-indigo-50">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="w-5 h-5 text-indigo-600" />
          ✉️ Contas de E-mail Permitidas
        </CardTitle>
        <CardDescription>
          Selecione quais caixas este usuário pode acessar e por qual ele envia/recebe na Central.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ConfiguracaoPermissoesEmail
          usuarioSelecionado={usuarioSelecionado}
          atualizarUsuario={atualizarUsuario}
        />
      </CardContent>
    </Card>
  );
}
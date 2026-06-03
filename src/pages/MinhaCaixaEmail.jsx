import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mail, Server, Loader2 } from 'lucide-react';
import GmailConnectionCard from '@/components/configuracao/GmailConnectionCard';
import MinhaCaixaZimbra from '@/components/emails/MinhaCaixaZimbra';

export default function MinhaCaixaEmail() {
  const [usuario, setUsuario] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me()
      .then(setUsuario)
      .catch(() => setUsuario(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando...
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Mail className="h-6 w-6 text-orange-500" />
          Minha Caixa de E-mail
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Conecte sua própria caixa de e-mail. Os e-mails recebidos aparecem na Central de
          Comunicação para os atendentes do seu setor.
        </p>
      </div>

      <Tabs defaultValue="gmail">
        <TabsList className="grid grid-cols-2 w-full max-w-sm">
          <TabsTrigger value="gmail" className="flex items-center gap-2">
            <Mail className="h-4 w-4" /> Gmail
          </TabsTrigger>
          <TabsTrigger value="zimbra" className="flex items-center gap-2">
            <Server className="h-4 w-4" /> Zimbra / IMAP
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gmail" className="mt-4">
          <GmailConnectionCard />
        </TabsContent>

        <TabsContent value="zimbra" className="mt-4">
          <MinhaCaixaZimbra usuario={usuario} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
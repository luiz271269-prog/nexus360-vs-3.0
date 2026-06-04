import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Mail, Inbox, Send, Loader2 } from 'lucide-react';
import CaixaAprovacaoEmails from '@/components/emails/CaixaAprovacaoEmails';
import AbaNovoEmail from '@/components/emails/AbaNovoEmail';
import GmailConnectionCard from '@/components/configuracao/GmailConnectionCard';

// Central de E-mail unificada — 3 abas:
// 1) Caixa de entrada (recebidos/pendentes) · 2) Novo e-mail · 3) Conectar Gmail
// A configuração de caixa (Zimbra/IMAP) é feita no cadastro do usuário (Contas de E-mail Permitidas).
export default function Emails() {
  const [aba, setAba] = useState('entrada');
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
      <div className="flex items-center justify-center h-64 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando...
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-lg">
          <Mail className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Central de E-mail</h1>
          <p className="text-sm text-slate-500">
            Receba, aprove e envie e-mails, e conecte sua própria caixa. Os e-mails recebidos
            aparecem na Central de Comunicação para os atendentes do seu setor.
          </p>
        </div>
      </div>

      <Tabs value={aba} onValueChange={setAba}>
        <TabsList className="mb-6 flex-wrap h-auto">
          <TabsTrigger value="entrada" className="gap-2">
            <Inbox className="w-4 h-4" /> Caixa de entrada
          </TabsTrigger>
          <TabsTrigger value="novo" className="gap-2">
            <Send className="w-4 h-4" /> Novo e-mail
          </TabsTrigger>
          <TabsTrigger value="gmail" className="gap-2">
            <Mail className="w-4 h-4" /> Conectar Gmail
          </TabsTrigger>
        </TabsList>

        <TabsContent value="entrada">
          <CaixaAprovacaoEmails />
        </TabsContent>

        <TabsContent value="novo">
          <AbaNovoEmail />
        </TabsContent>

        <TabsContent value="gmail">
          <GmailConnectionCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Mail, Inbox, MailQuestion, Send } from 'lucide-react';
import AbaCaixaEntradaImap from '@/components/emails/AbaCaixaEntradaImap';
import CaixaAprovacaoEmails from '@/components/emails/CaixaAprovacaoEmails';
import AbaNovoEmail from '@/components/emails/AbaNovoEmail';

// Central de E-mail — 3 abas:
// 1) Caixa de entrada (IMAP) · 2) Pendentes de aprovação · 3) Novo e-mail
export default function Emails() {
  const [aba, setAba] = useState('entrada');

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-lg">
          <Mail className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Central de E-mail</h1>
          <p className="text-sm text-slate-500">Caixa de entrada, aprovações e envio de e-mails.</p>
        </div>
      </div>

      <Tabs value={aba} onValueChange={setAba}>
        <TabsList className="mb-6">
          <TabsTrigger value="entrada" className="gap-2">
            <Inbox className="w-4 h-4" /> Caixa de entrada
          </TabsTrigger>
          <TabsTrigger value="pendentes" className="gap-2">
            <MailQuestion className="w-4 h-4" /> Pendentes de aprovação
          </TabsTrigger>
          <TabsTrigger value="novo" className="gap-2">
            <Send className="w-4 h-4" /> Novo e-mail
          </TabsTrigger>
        </TabsList>

        <TabsContent value="entrada">
          <AbaCaixaEntradaImap />
        </TabsContent>

        <TabsContent value="pendentes">
          <CaixaAprovacaoEmails />
        </TabsContent>

        <TabsContent value="novo">
          <AbaNovoEmail />
        </TabsContent>
      </Tabs>
    </div>
  );
}
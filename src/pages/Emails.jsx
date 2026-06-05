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

  const TABS = [
    { value: 'entrada', label: 'Caixa de entrada', icon: Inbox },
    { value: 'novo', label: 'Novo e-mail', icon: Send },
    { value: 'gmail', label: 'Conectar Gmail', icon: Mail },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-2xl mx-auto px-3 md:px-4 pt-4 pb-10">
        {/* Header limpo estilo Gmail/Superhuman */}
        <div className="flex items-center gap-2 mb-0.5">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Central de E-mail</h1>
        </div>
        <p className="text-xs text-slate-500 mb-3 max-w-xl">
          Receba, aprove e envie e-mails. Os recebidos aparecem na Central de Comunicação para o seu setor.
        </p>

        <Tabs value={aba} onValueChange={setAba}>
          {/* Abas com underline ativo (estilo Gmail) */}
          <div className="border-b border-slate-200 mb-4">
            <TabsList className="bg-transparent p-0 h-auto gap-1">
              {TABS.map(({ value, label, icon: Icon }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="relative gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-3 py-2 text-[13px] font-medium text-slate-500 shadow-none data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-700 data-[state=active]:shadow-none hover:text-slate-700 transition-colors"
                >
                  <Icon className="w-4 h-4" /> {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="entrada" className="mt-0">
            <CaixaAprovacaoEmails />
          </TabsContent>

          <TabsContent value="novo" className="mt-0">
            <AbaNovoEmail />
          </TabsContent>

          <TabsContent value="gmail" className="mt-0">
            <GmailConnectionCard />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
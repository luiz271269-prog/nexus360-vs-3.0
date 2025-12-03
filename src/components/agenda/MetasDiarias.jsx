import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Phone, Mail, MessageSquare } from 'lucide-react';

export default function MetasDiarias({ metas }) {
  const calcularProgresso = (feito, meta) => {
    if (meta === 0) return 0;
    return Math.min((feito / meta) * 100, 100);
  };

  const getCorProgresso = (percentual) => {
    if (percentual >= 100) return 'bg-green-500';
    if (percentual >= 70) return 'bg-amber-500';
    return 'bg-blue-500';
  };

  return (
    <Card className="shadow-xl border-slate-200 bg-gradient-to-r from-white to-slate-50">
      <CardContent className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Meta de Ligações */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Phone className="w-4 h-4 text-blue-600" /> Ligações
              </span>
              <span className="text-sm font-bold text-slate-900">
                {metas.ligacoes.feitas}/{metas.ligacoes.meta}
              </span>
            </div>
            <Progress 
              value={calcularProgresso(metas.ligacoes.feitas, metas.ligacoes.meta)} 
              className="h-3" 
            />
            <p className="text-xs text-slate-500 mt-1">
              {metas.ligacoes.meta - metas.ligacoes.feitas > 0 
                ? `Faltam ${metas.ligacoes.meta - metas.ligacoes.feitas} ligações` 
                : '🎉 Meta atingida!'}
            </p>
          </div>

          {/* Meta de WhatsApp */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-green-600" /> WhatsApp
              </span>
              <span className="text-sm font-bold text-slate-900">
                {metas.whatsapp.feitos}/{metas.whatsapp.meta}
              </span>
            </div>
            <Progress 
              value={calcularProgresso(metas.whatsapp.feitos, metas.whatsapp.meta)} 
              className="h-3" 
            />
            <p className="text-xs text-slate-500 mt-1">
              {metas.whatsapp.meta - metas.whatsapp.feitos > 0 
                ? `Faltam ${metas.whatsapp.meta - metas.whatsapp.feitos} mensagens` 
                : '🎉 Meta atingida!'}
            </p>
          </div>

          {/* Meta de E-mails */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Mail className="w-4 h-4 text-purple-600" /> E-mails
              </span>
              <span className="text-sm font-bold text-slate-900">
                {metas.emails.feitos}/{metas.emails.meta}
              </span>
            </div>
            <Progress 
              value={calcularProgresso(metas.emails.feitos, metas.emails.meta)} 
              className="h-3" 
            />
            <p className="text-xs text-slate-500 mt-1">
              {metas.emails.meta - metas.emails.feitos > 0 
                ? `Faltam ${metas.emails.meta - metas.emails.feitos} e-mails` 
                : '🎉 Meta atingida!'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
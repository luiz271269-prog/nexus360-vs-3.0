import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { User, Calendar, DollarSign, MessageSquare, Mic, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function OrcamentoCard({ orcamento, onEdit, onDelete, onDuplicar, onWhatsApp }) {
  const navigate = useNavigate();
  const formatCurrency = (value) => (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-';

  const temTelefone = orcamento.cliente_telefone || orcamento.cliente_celular;
  const origemChat = orcamento.origem_chat;

  return (
    <Card className="hover:shadow-lg transition-all cursor-pointer group">
      {/* ✅ PREVIEW MÍDIA DO CHAT */}
      {origemChat?.media_url && origemChat.media_type === 'image' && (
        <div className="relative overflow-hidden rounded-t-lg">
          <img
            src={origemChat.media_url}
            className="w-full h-28 object-cover cursor-pointer"
            onClick={(e) => { e.stopPropagation(); window.open(origemChat.media_url, '_blank'); }}
            onError={(e) => { e.target.parentElement.style.display = 'none'; }}
          />
          <Badge className="absolute top-2 right-2 bg-green-600 text-[10px]">💬 Chat</Badge>
        </div>
      )}
      {origemChat?.media_type === 'audio' && (
        <div className="relative h-16 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-t-lg flex items-center justify-center gap-2 text-white">
          <Mic className="w-6 h-6" />
          <span className="text-sm font-medium">Áudio do Cliente</span>
          <Badge className="absolute top-2 right-2 bg-green-600 text-[10px]">💬 Chat</Badge>
        </div>
      )}
      {origemChat?.media_type === 'document' && (
        <div className="relative h-16 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-t-lg flex items-center justify-center gap-2 text-white">
          <FileText className="w-6 h-6" />
          <span className="text-sm font-medium">Documento</span>
          <Badge className="absolute top-2 right-2 bg-green-600 text-[10px]">💬 Chat</Badge>
        </div>
      )}
      {origemChat && !origemChat.media_url && (
        <div className="px-3 pt-2">
          <Badge className="bg-green-100 text-green-700 text-[10px]">💬 Criado via Chat</Badge>
        </div>
      )}

      <CardHeader className="p-3">
        <CardTitle className="text-sm font-bold">{orcamento.cliente_nome}</CardTitle>
        <Badge variant="outline" className="w-fit">{orcamento.numero_orcamento || 'Sem código'}</Badge>
      </CardHeader>
      <CardContent className="p-3 space-y-2 text-xs text-slate-600">
        <div className="flex items-center gap-1"><User className="w-3 h-3" /> <span>{orcamento.vendedor}</span></div>
        <div className="flex items-center gap-1"><Calendar className="w-3 h-3" /> <span>{formatDate(orcamento.data_orcamento)}</span></div>
        <div className="flex items-center gap-1 font-bold text-slate-800"><DollarSign className="w-3 h-3" /> <span>{formatCurrency(orcamento.valor_total)}</span></div>
        <Button size="sm" variant="secondary" className="w-full h-8 mt-2" onClick={() => navigate(createPageUrl(`OrcamentoDetalhes?id=${orcamento.id}`))}>
          Detalhes
        </Button>
      </CardContent>
      <CardFooter className="p-3 bg-slate-50 flex justify-between items-center">
        <div className="flex gap-1">
          {/* ✅ BOTÃO WHATSAPP INTELIGENTE */}
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              if (onWhatsApp) {
                onWhatsApp(orcamento);
              }
            }}
            className={`h-8 w-8 ${
              temTelefone 
                ? 'text-green-600 hover:text-green-700 hover:bg-green-50' 
                : 'text-slate-300 cursor-not-allowed'
            }`}
            disabled={!temTelefone}
            title={temTelefone ? 'Abrir WhatsApp com contexto do orçamento' : 'Telefone não cadastrado'}
          >
            <MessageSquare className="w-4 h-4" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
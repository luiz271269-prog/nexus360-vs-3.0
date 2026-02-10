import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  AlertTriangle, 
  MessageSquare, 
  Copy, 
  Clock,
  TrendingUp,
  TrendingDown,
  Activity
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function ClienteCard({ cliente }) {
  const navigate = useNavigate();
  
  const getPrioridadeCor = (label) => {
    switch (label) {
      case 'CRITICO': return 'bg-red-500 text-white';
      case 'ALTO': return 'bg-orange-500 text-white';
      case 'MEDIO': return 'bg-yellow-500 text-white';
      default: return 'bg-blue-500 text-white';
    }
  };
  
  const getScoreCor = (score) => {
    if (score >= 70) return 'text-red-600';
    if (score >= 50) return 'text-orange-600';
    if (score >= 30) return 'text-yellow-600';
    return 'text-green-600';
  };

  const handleResponder = () => {
    navigate(createPageUrl('Comunicacao') + `?contact=${cliente.contact_id}`);
  };

  const handleCopiarMsg = () => {
    if (cliente.suggested_message) {
      navigator.clipboard.writeText(cliente.suggested_message);
      toast.success('✅ Mensagem copiada para a área de transferência!');
    }
  };

  return (
    <Card className="hover:shadow-lg transition-all duration-300 border-l-4" 
          style={{ borderLeftColor: cliente.prioridadeLabel === 'CRITICO' ? '#ef4444' : 
                                     cliente.prioridadeLabel === 'ALTO' ? '#f97316' : '#eab308' }}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-base font-bold text-slate-800 mb-1">
              {cliente.empresa || cliente.nome}
            </CardTitle>
            <p className="text-xs text-slate-500">
              {cliente.telefone}
            </p>
          </div>
          
          <Badge className={`${getPrioridadeCor(cliente.prioridadeLabel)} text-xs font-bold`}>
            {cliente.prioridadeLabel}
          </Badge>
        </div>
        
        {/* Badges de info */}
        <div className="flex gap-1 flex-wrap mt-2">
          <Badge variant="outline" className="text-xs">
            {cliente.stage_current || 'N/A'}
          </Badge>
          
          {cliente.days_stalled > 0 && (
            <Badge variant="outline" className="text-xs flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {cliente.days_stalled}d parado
            </Badge>
          )}
          
          {cliente.tipo_contato && (
            <Badge variant="outline" className="text-xs capitalize">
              {cliente.tipo_contato}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Scores */}
        <div className="grid grid-cols-4 gap-2">
          {cliente.deal_risk > 0 && (
            <div className="text-center">
              <p className="text-xs text-slate-500 mb-1">Risco</p>
              <p className={`text-sm font-bold ${getScoreCor(cliente.deal_risk)}`}>
                {cliente.deal_risk}
              </p>
            </div>
          )}
          
          {cliente.buy_intent > 0 && (
            <div className="text-center">
              <p className="text-xs text-slate-500 mb-1">Intenção</p>
              <p className={`text-sm font-bold ${getScoreCor(100 - cliente.buy_intent)}`}>
                {cliente.buy_intent}
              </p>
            </div>
          )}
          
          {cliente.engagement > 0 && (
            <div className="text-center">
              <p className="text-xs text-slate-500 mb-1">Engaj.</p>
              <p className={`text-sm font-bold ${getScoreCor(100 - cliente.engagement)}`}>
                {cliente.engagement}
              </p>
            </div>
          )}
          
          {cliente.health > 0 && (
            <div className="text-center">
              <p className="text-xs text-slate-500 mb-1">Saúde</p>
              <p className={`text-sm font-bold text-green-600`}>
                {cliente.health}
              </p>
            </div>
          )}
        </div>

        {/* Causas raiz */}
        {cliente.root_causes && cliente.root_causes.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 mb-1 font-medium">Causas:</p>
            <div className="flex gap-1 flex-wrap">
              {cliente.root_causes.slice(0, 3).map((causa, idx) => (
                <Badge key={idx} variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                  {causa}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Próxima ação */}
        {cliente.next_action && (
          <div className="bg-blue-50 rounded-lg p-2">
            <p className="text-xs font-medium text-blue-900 mb-1">
              💡 Ação Recomendada:
            </p>
            <p className="text-xs text-blue-700">
              {cliente.next_action}
            </p>
          </div>
        )}

        {/* Botões de ação */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={handleResponder}
            size="sm"
            className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Responder
          </Button>
          
          {cliente.suggested_message && (
            <Button
              onClick={handleCopiarMsg}
              size="sm"
              variant="outline"
              className="flex-1"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copiar Msg
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
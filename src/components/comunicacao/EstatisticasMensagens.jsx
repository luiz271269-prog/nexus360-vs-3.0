import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  MessageSquare, 
  Image, 
  Video, 
  Mic, 
  FileText,
  TrendingUp,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function EstatisticasMensagens() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const carregarEstatisticas = async () => {
    setLoading(true);
    try {
      // Buscar todas as mensagens recentes
      const mensagens = await base44.entities.Message.list('-created_date', 200);
      
      // Agrupar por tipo
      const porTipo = mensagens.reduce((acc, msg) => {
        const tipo = msg.media_type || 'none';
        if (!acc[tipo]) acc[tipo] = 0;
        acc[tipo]++;
        return acc;
      }, {});
      
      // Agrupar por status
      const porStatus = mensagens.reduce((acc, msg) => {
        const status = msg.status || 'enviando';
        if (!acc[status]) acc[status] = 0;
        acc[status]++;
        return acc;
      }, {});
      
      // Calcular taxas
      const totalEnviadas = mensagens.filter(m => m.sender_type === 'user').length;
      const totalRecebidas = mensagens.filter(m => m.sender_type === 'contact').length;
      const totalLidas = mensagens.filter(m => m.status === 'lida' && m.sender_type === 'user').length;
      const taxaLeitura = totalEnviadas > 0 ? ((totalLidas / totalEnviadas) * 100).toFixed(1) : 0;
      
      setStats({
        porTipo,
        porStatus,
        totalEnviadas,
        totalRecebidas,
        taxaLeitura,
        total: mensagens.length
      });
      
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    carregarEstatisticas();
  }, []);

  const tiposConfig = {
    none: { icon: MessageSquare, label: "Texto", color: "bg-blue-100 text-blue-700" },
    image: { icon: Image, label: "Imagens", color: "bg-green-100 text-green-700" },
    video: { icon: Video, label: "Vídeos", color: "bg-purple-100 text-purple-700" },
    audio: { icon: Mic, label: "Áudios", color: "bg-orange-100 text-orange-700" },
    document: { icon: FileText, label: "Documentos", color: "bg-indigo-100 text-indigo-700" }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-40">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumo Geral */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Estatísticas de Mensagens
            </span>
            <Button 
              size="sm" 
              variant="outline"
              onClick={carregarEstatisticas}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
              <div className="text-sm text-slate-600">Total de Mensagens</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{stats.totalRecebidas}</div>
              <div className="text-sm text-slate-600">Recebidas</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600">{stats.totalEnviadas}</div>
              <div className="text-sm text-slate-600">Enviadas</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">{stats.taxaLeitura}%</div>
              <div className="text-sm text-slate-600">Taxa de Leitura</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Por Tipo de Mensagem */}
      <Card>
        <CardHeader>
          <CardTitle>Mensagens por Tipo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {Object.entries(tiposConfig).map(([tipo, config]) => {
              const Icon = config.icon;
              const quantidade = stats.porTipo[tipo] || 0;
              const percentual = stats.total > 0 ? ((quantidade / stats.total) * 100).toFixed(1) : 0;
              
              return (
                <div key={tipo} className="text-center">
                  <div className={`w-16 h-16 rounded-full ${config.color} flex items-center justify-center mx-auto mb-2`}>
                    <Icon className="w-8 h-8" />
                  </div>
                  <div className="text-2xl font-bold text-slate-800">{quantidade}</div>
                  <div className="text-sm text-slate-600">{config.label}</div>
                  <Badge variant="outline" className="mt-1">{percentual}%</Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Por Status */}
      <Card>
        <CardHeader>
          <CardTitle>Status de Mensagens Enviadas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {Object.entries(stats.porStatus).map(([status, quantidade]) => {
              const statusColors = {
                enviando: "bg-yellow-100 text-yellow-800 border-yellow-200",
                enviada: "bg-blue-100 text-blue-800 border-blue-200",
                entregue: "bg-green-100 text-green-800 border-green-200",
                lida: "bg-purple-100 text-purple-800 border-purple-200",
                falhou: "bg-red-100 text-red-800 border-red-200"
              };
              
              return (
                <Badge 
                  key={status} 
                  className={`${statusColors[status] || 'bg-slate-100 text-slate-800'} text-sm px-4 py-2 border-2`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}: {quantidade}
                </Badge>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
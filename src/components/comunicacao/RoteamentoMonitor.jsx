import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Activity
} from "lucide-react";

export default function RoteamentoMonitor() {
  const { data: atendentes = [], isLoading } = useQuery({
    queryKey: ['atendentes-status'],
    queryFn: async () => {
      const users = await base44.entities.User.filter({ is_whatsapp_attendant: true });
      return users;
    },
    refetchInterval: 10000,
    initialData: []
  });

  const { data: threads = [] } = useQuery({
    queryKey: ['threads-status'],
    queryFn: () => base44.entities.MessageThread.filter({ status: 'aberta' }),
    refetchInterval: 10000,
    initialData: []
  });

  const atendentesOnline = atendentes.filter(a => a.availability_status === 'online');
  const conversasAguardando = threads.filter(t => !t.assigned_user_id);
  const conversasAtivas = threads.filter(t => t.assigned_user_id);

  const getStatusColor = (status) => {
    switch(status) {
      case 'online': return 'bg-green-100 text-green-800';
      case 'ocupado': return 'bg-yellow-100 text-yellow-800';
      case 'em_pausa': return 'bg-orange-100 text-orange-800';
      case 'offline': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'online': return <CheckCircle className="w-4 h-4" />;
      case 'ocupado': return <Clock className="w-4 h-4" />;
      case 'em_pausa': return <Clock className="w-4 h-4" />;
      case 'offline': return <AlertCircle className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getSetorIcon = (setor) => {
    switch(setor) {
      case 'vendas': return '💼';
      case 'assistencia': return '🔧';
      case 'financeiro': return '💰';
      case 'fornecedor': return '🏭';
      default: return '📋';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* CARDS DE MÉTRICAS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-2 border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Atendentes Online</p>
                <p className="text-3xl font-bold text-green-900">{atendentesOnline.length}</p>
              </div>
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-600">Aguardando Atribuição</p>
                <p className="text-3xl font-bold text-yellow-900">{conversasAguardando.length}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center">
                <Clock className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Conversas Ativas</p>
                <p className="text-3xl font-bold text-blue-900">{conversasAtivas.length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                <Activity className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* LISTA DE ATENDENTES */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Status dos Atendentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {atendentes.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>Nenhum atendente configurado</p>
              <p className="text-sm mt-1">Configure usuários como atendentes em Usuários</p>
            </div>
          ) : (
            <div className="space-y-3">
              {atendentes.map(atendente => {
                const conversasDoAtendente = threads.filter(t => t.assigned_user_id === atendente.id);
                const capacidade = atendente.max_concurrent_conversations || 5;
                const utilizacao = Math.round((conversasDoAtendente.length / capacidade) * 100);

                return (
                  <div
                    key={atendente.id}
                    className="flex items-center justify-between p-4 bg-white border-2 rounded-lg hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                        {atendente.full_name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-slate-900">{atendente.full_name}</p>
                          <Badge className={getStatusColor(atendente.availability_status)}>
                            {getStatusIcon(atendente.availability_status)}
                            <span className="ml-1 capitalize">{atendente.availability_status}</span>
                          </Badge>
                          <Badge variant="outline">
                            {getSetorIcon(atendente.attendant_sector)} {atendente.attendant_sector}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-600">
                          <span>📊 {conversasDoAtendente.length}/{capacidade} conversas</span>
                          <span>⚡ {utilizacao}% utilização</span>
                          <span className="capitalize">🎯 {atendente.attendant_role}</span>
                        </div>
                      </div>
                    </div>

                    {/* BARRA DE CAPACIDADE */}
                    <div className="w-32">
                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            utilizacao >= 100 ? 'bg-red-500' :
                            utilizacao >= 80 ? 'bg-yellow-500' :
                            'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(utilizacao, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* CONVERSAS AGUARDANDO */}
      {conversasAguardando.length > 0 && (
        <Card className="border-2 border-orange-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <AlertCircle className="w-5 h-5" />
              Conversas Aguardando Atribuição ({conversasAguardando.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {conversasAguardando.slice(0, 5).map(thread => (
                <div
                  key={thread.id}
                  className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {thread.contact_id}
                    </p>
                    <p className="text-sm text-slate-600">
                      {thread.last_message_content?.substring(0, 50)}...
                    </p>
                  </div>
                  <Badge className="bg-orange-500 text-white">
                    Aguardando
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
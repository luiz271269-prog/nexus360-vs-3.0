import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  User, 
  MessageCircle, 
  AlertCircle,
  Activity
} from "lucide-react";
import { toast } from "sonner";

export default function DashboardAtendentes() {
  const [atendentes, setAtendentes] = useState([]);
  const [conversasNaoAtribuidas, setConversasNaoAtribuidas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usuarioAtual, setUsuarioAtual] = useState(null);

  useEffect(() => {
    carregarDados();
    const interval = setInterval(carregarDados, 30000); // Atualizar a cada 30s
    return () => clearInterval(interval);
  }, []);

  const carregarDados = async () => {
    try {
      const user = await base44.auth.me();
      setUsuarioAtual(user);

      // Buscar atendentes
      const atendentesData = await base44.entities.User.filter({
        is_whatsapp_attendant: true
      });

      // Buscar conversas de cada atendente
      const atendentesComConversas = await Promise.all(
        atendentesData.map(async (atendente) => {
          const conversas = await base44.entities.MessageThread.filter({
            assigned_user_id: atendente.id,
            status: { $in: ['aberta', 'aguardando_cliente'] }
          });

          return {
            ...atendente,
            conversas_ativas: conversas.length,
            conversas: conversas
          };
        })
      );

      setAtendentes(atendentesComConversas);

      // Buscar conversas não atribuídas
      const naoAtribuidas = await base44.entities.MessageThread.filter({
        assigned_user_id: null,
        status: 'aberta'
      });

      setConversasNaoAtribuidas(naoAtribuidas);

    } catch (error) {
      console.error('[DASHBOARD] Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dashboard de atendentes');
    } finally {
      setLoading(false);
    }
  };

  const atribuirConversa = async (threadId, atendenteId) => {
    try {
      // Chamar função de roteamento
      const response = await base44.functions.invoke('roteamentoInteligente', {
        thread_id: threadId,
        force_attendant_id: atendenteId
      });

      if (response.data.success) {
        toast.success(`Conversa atribuída a ${response.data.assigned_to_name}`);
        carregarDados();
      } else {
        toast.error(response.data.message || 'Erro ao atribuir conversa');
      }
    } catch (error) {
      console.error('[DASHBOARD] Erro ao atribuir:', error);
      toast.error('Erro ao atribuir conversa');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'ocupado': return 'bg-yellow-500';
      case 'em_pausa': return 'bg-orange-500';
      case 'offline': return 'bg-slate-400';
      default: return 'bg-slate-400';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'online': return 'Online';
      case 'ocupado': return 'Ocupado';
      case 'em_pausa': return 'Em Pausa';
      case 'offline': return 'Offline';
      default: return 'Desconhecido';
    }
  };

  const getCargaColor = (carga, capacidade) => {
    const percentual = (carga / capacidade) * 100;
    if (percentual >= 90) return 'text-red-600 bg-red-50';
    if (percentual >= 70) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Total Atendentes</p>
                <p className="text-3xl font-bold">{atendentes.length}</p>
              </div>
              <Users className="w-10 h-10 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Online Agora</p>
                <p className="text-3xl font-bold">
                  {atendentes.filter(a => a.availability_status === 'online').length}
                </p>
              </div>
              <Activity className="w-10 h-10 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-pink-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Conversas Ativas</p>
                <p className="text-3xl font-bold">
                  {atendentes.reduce((sum, a) => sum + (a.conversas_ativas || 0), 0)}
                </p>
              </div>
              <MessageCircle className="w-10 h-10 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500 to-red-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Não Atribuídas</p>
                <p className="text-3xl font-bold">{conversasNaoAtribuidas.length}</p>
              </div>
              <AlertCircle className="w-10 h-10 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Atendentes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Status dos Atendentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {atendentes.map((atendente) => (
              <div
                key={atendente.id}
                className="p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-indigo-300 transition-all"
              >
                <div className="flex items-center justify-between">
                  {/* Info do Atendente */}
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-white" />
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${getStatusColor(atendente.availability_status)}`} />
                    </div>

                    <div>
                      <h3 className="font-semibold text-slate-900">{atendente.full_name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {atendente.attendant_sector || 'Geral'}
                        </Badge>
                        <Badge className={`text-xs ${getStatusColor(atendente.availability_status)} text-white`}>
                          {getStatusText(atendente.availability_status)}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Métricas */}
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <p className={`text-2xl font-bold ${getCargaColor(atendente.conversas_ativas || 0, atendente.max_concurrent_conversations || 5)}`}>
                        {atendente.conversas_ativas || 0}
                      </p>
                      <p className="text-xs text-slate-600">
                        de {atendente.max_concurrent_conversations || 5}
                      </p>
                    </div>

                    {atendente.estatisticas_atendimento && (
                      <>
                        <div className="text-center">
                          <p className="text-lg font-semibold text-slate-700">
                            {atendente.estatisticas_atendimento.tempo_medio_resposta_minutos || 0}min
                          </p>
                          <p className="text-xs text-slate-600">Tempo Resp.</p>
                        </div>

                        <div className="text-center">
                          <p className="text-lg font-semibold text-slate-700">
                            {atendente.estatisticas_atendimento.taxa_resolucao || 0}%
                          </p>
                          <p className="text-xs text-slate-600">Resolução</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Conversas Não Atribuídas */}
      {conversasNaoAtribuidas.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-900">
              <AlertCircle className="w-5 h-5" />
              Conversas Aguardando Atendente ({conversasNaoAtribuidas.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {conversasNaoAtribuidas.map((conversa) => (
                <div
                  key={conversa.id}
                  className="p-4 bg-white rounded-lg border border-orange-200"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900">
                        Conversa #{conversa.id.slice(0, 8)}
                      </p>
                      <p className="text-sm text-slate-600 mt-1">
                        Setor: {conversa.sector_id || 'Não definido'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Aguardando desde: {new Date(conversa.created_date).toLocaleString('pt-BR')}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      {atendentes
                        .filter(a => a.availability_status === 'online')
                        .map(atendente => (
                          <Button
                            key={atendente.id}
                            size="sm"
                            onClick={() => atribuirConversa(conversa.id, atendente.id)}
                            className="bg-indigo-600 hover:bg-indigo-700"
                          >
                            Atribuir a {atendente.full_name.split(' ')[0]}
                          </Button>
                        ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
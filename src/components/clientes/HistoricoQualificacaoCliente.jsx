import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Clock,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  User,
  Calendar,
  FileText,
  Phone,
  Mail,
  Building2,
  Users,
  DollarSign,
  Package,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const getStatusIcon = (status) => {
  const icons = {
    novo_lead: '🆕',
    primeiro_contato: '📞',
    em_conversa: '💬',
    levantamento_dados: '📋',
    pre_qualificado: '✅',
    qualificacao_tecnica: '🔍',
    em_aquecimento: '🔥',
    lead_qualificado: '🎯',
    desqualificado: '❌'
  };
  return icons[status] || '📌';
};

const getStatusColor = (status) => {
  const colors = {
    novo_lead: 'bg-slate-100 text-slate-700',
    primeiro_contato: 'bg-blue-100 text-blue-700',
    em_conversa: 'bg-cyan-100 text-cyan-700',
    levantamento_dados: 'bg-indigo-100 text-indigo-700',
    pre_qualificado: 'bg-purple-100 text-purple-700',
    qualificacao_tecnica: 'bg-violet-100 text-violet-700',
    em_aquecimento: 'bg-amber-100 text-amber-700',
    lead_qualificado: 'bg-green-100 text-green-700',
    desqualificado: 'bg-red-100 text-red-700'
  };
  return colors[status] || 'bg-gray-100 text-gray-700';
};

const EventoTimeline = ({ evento, index, isLast }) => {
  const [expanded, setExpanded] = useState(false);
  const { dados_evento, timestamp, created_date } = evento;
  const { status_anterior, status_novo, dados_atualizados } = dados_evento || {};

  const dataEvento = timestamp || created_date;
  const dataFormatada = dataEvento 
    ? format(new Date(dataEvento), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })
    : 'Data não disponível';

  // Identificar campos que foram alterados/adicionados
  const camposAlterados = dados_atualizados ? Object.keys(dados_atualizados).filter(campo => 
    !['id', 'created_date', 'updated_date', 'created_by'].includes(campo)
  ) : [];

  const getCampoIcon = (campo) => {
    const icons = {
      telefone: <Phone className="w-4 h-4" />,
      email: <Mail className="w-4 h-4" />,
      contato_principal_nome: <User className="w-4 h-4" />,
      contato_principal_cargo: <User className="w-4 h-4" />,
      numero_maquinas: <Building2 className="w-4 h-4" />,
      numero_funcionarios: <Users className="w-4 h-4" />,
      valor_recorrente_mensal: <DollarSign className="w-4 h-4" />,
      interesses_produtos: <Package className="w-4 h-4" />,
      classificacao: <TrendingUp className="w-4 h-4" />,
      segmento: <Building2 className="w-4 h-4" />,
      observacoes: <FileText className="w-4 h-4" />
    };
    return icons[campo] || <FileText className="w-4 h-4" />;
  };

  const formatarValorCampo = (campo, valor) => {
    if (valor === null || valor === undefined || valor === '') return '-';
    
    if (campo === 'valor_recorrente_mensal') {
      return `R$ ${Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    }
    
    if (campo === 'interesses_produtos' && Array.isArray(valor)) {
      return valor.join(', ');
    }
    
    if (typeof valor === 'boolean') {
      return valor ? '✅ Sim' : '❌ Não';
    }
    
    return valor.toString();
  };

  const getNomeCampo = (campo) => {
    const nomes = {
      razao_social: 'Razão Social',
      nome_fantasia: 'Nome Fantasia',
      telefone: 'Telefone',
      email: 'E-mail',
      contato_principal_nome: 'Nome do Contato',
      contato_principal_cargo: 'Cargo do Contato',
      numero_maquinas: 'Nº de Máquinas',
      numero_funcionarios: 'Nº de Funcionários',
      valor_recorrente_mensal: 'Valor Recorrente Mensal',
      interesses_produtos: 'Produtos de Interesse',
      classificacao: 'Classificação',
      segmento: 'Segmento',
      vendedor_responsavel: 'Vendedor Responsável',
      necessidade_verificada: 'Necessidade Verificada',
      capacidade_compra_verificada: 'Capacidade de Compra Verificada',
      motivo_desqualificacao: 'Motivo da Desqualificação',
      observacoes: 'Observações'
    };
    return nomes[campo] || campo;
  };

  return (
    <div className="relative flex gap-4 pb-8">
      {/* Linha vertical da timeline */}
      {!isLast && (
        <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-gradient-to-b from-indigo-300 to-purple-200" />
      )}

      {/* Ícone do evento */}
      <div className={`relative z-10 flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-lg ${getStatusColor(status_novo)} border-4 border-white`}>
        {getStatusIcon(status_novo)}
      </div>

      {/* Conteúdo do evento */}
      <div className="flex-1">
        <Card className="shadow-md hover:shadow-lg transition-all duration-300">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <span>Lead movido para</span>
                  <Badge className={`${getStatusColor(status_novo)}`}>
                    {status_novo?.replace(/_/g, ' ').toUpperCase()}
                  </Badge>
                </CardTitle>
                <div className="flex items-center gap-2 mt-2 text-sm text-slate-500">
                  <Clock className="w-4 h-4" />
                  <span>{dataFormatada}</span>
                </div>
              </div>

              {camposAlterados.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpanded(!expanded)}
                  className="text-slate-600 hover:text-slate-800"
                >
                  {expanded ? (
                    <>
                      <ChevronUp className="w-4 h-4 mr-1" />
                      Ocultar
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4 mr-1" />
                      Ver Dados ({camposAlterados.length})
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardHeader>

          {expanded && camposAlterados.length > 0 && (
            <CardContent>
              <div className="border-t pt-3">
                <p className="text-sm font-semibold text-slate-700 mb-3">
                  📝 Dados preenchidos/atualizados nesta etapa:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {camposAlterados.map((campo, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200"
                    >
                      <div className="text-slate-600 mt-0.5">
                        {getCampoIcon(campo)}
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-medium text-slate-600">
                          {getNomeCampo(campo)}
                        </p>
                        <p className="text-sm font-semibold text-slate-800 mt-0.5">
                          {formatarValorCampo(campo, dados_atualizados[campo])}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
};

export default function HistoricoQualificacaoCliente({ clienteId, clienteNome }) {
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarHistorico();
  }, [clienteId]);

  const carregarHistorico = async () => {
    try {
      setLoading(true);

      // Buscar todos os eventos de atualização do cliente
      const eventosData = await base44.entities.EventoSistema.filter({
        tipo_evento: 'cliente_atualizado',
        entidade_id: clienteId
      });

      // Ordenar por data (mais recente primeiro)
      const eventosOrdenados = (eventosData || []).sort((a, b) => {
        const dataA = new Date(a.timestamp || a.created_date);
        const dataB = new Date(b.timestamp || b.created_date);
        return dataB - dataA;
      });

      setEventos(eventosOrdenados);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center">
            <Clock className="w-12 h-12 text-slate-400 animate-spin mb-4" />
            <p className="text-slate-600">Carregando histórico...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (eventos.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-center">
            <AlertCircle className="w-12 h-12 text-slate-400 mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">
              Nenhum histórico registrado
            </h3>
            <p className="text-sm text-slate-500 max-w-md">
              Este lead ainda não possui um histórico de qualificação. O histórico será criado automaticamente quando o lead for movido entre as etapas do funil.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-indigo-600" />
          Histórico de Qualificação
        </CardTitle>
        <p className="text-sm text-slate-500 mt-1">
          Acompanhe toda a jornada de <strong>{clienteNome}</strong> pelo funil de vendas
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-0">
          {eventos.map((evento, index) => (
            <EventoTimeline
              key={evento.id || index}
              evento={evento}
              index={index}
              isLast={index === eventos.length - 1}
            />
          ))}
        </div>

        <div className="mt-6 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-indigo-600 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-indigo-900">
                Total de {eventos.length} evento{eventos.length > 1 ? 's' : ''} registrado{eventos.length > 1 ? 's' : ''}
              </p>
              <p className="text-xs text-indigo-700 mt-1">
                Cada mudança de status e atualização de dados é automaticamente registrada para análise futura
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { base44 } from '@/api/base44Client';
import { 
  ArrowRightLeft, 
  X, 
  Clock, 
  CheckCircle2, 
  XCircle,
  MessageSquare,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import UsuarioDisplay from './UsuarioDisplay';

export default function AlertaPedidoTransferencia({ 
  thread, 
  atendentes = [], 
  onTransferirAgora,
  onCancelar,
  usuarioAtual
}) {
  const [processando, setProcessando] = useState(false);

  if (!thread?.transfer_pending) return null;

  const atendenteDestino = thread.transfer_requested_user_id 
    ? atendentes.find(a => a.id === thread.transfer_requested_user_id)
    : null;

  const setorDestino = thread.transfer_requested_sector_id || thread.transfer_requested_text;
  const aguardandoCliente = !thread.transfer_confirmed;
  const expirado = thread.transfer_expires_at && new Date(thread.transfer_expires_at) < new Date();

  const handleTransferirAgora = async () => {
    if (!thread.transfer_confirmed && !confirm('Cliente ainda não confirmou. Transferir mesmo assim?')) {
      return;
    }
    
    setProcessando(true);
    try {
      await onTransferirAgora();
    } finally {
      setProcessando(false);
    }
  };

  const handleCancelar = async () => {
    setProcessando(true);
    try {
      await base44.entities.MessageThread.update(thread.id, {
        transfer_pending: false,
        transfer_requested_sector_id: null,
        transfer_requested_user_id: null,
        transfer_requested_text: null,
        transfer_confirmed: false
      });
      
      toast.success('Pedido de transferência cancelado');
      if (onCancelar) onCancelar();
    } catch (error) {
      toast.error('Erro ao cancelar pedido');
    } finally {
      setProcessando(false);
    }
  };

  const getStatusConfig = () => {
    if (expirado) {
      return {
        icon: XCircle,
        color: 'bg-red-50 border-red-200',
        textColor: 'text-red-700',
        iconColor: 'text-red-500',
        label: 'Expirado'
      };
    }
    if (thread.transfer_confirmed) {
      return {
        icon: CheckCircle2,
        color: 'bg-green-50 border-green-200',
        textColor: 'text-green-700',
        iconColor: 'text-green-500',
        label: 'Confirmado'
      };
    }
    return {
      icon: Clock,
      color: 'bg-amber-50 border-amber-200',
      textColor: 'text-amber-700',
      iconColor: 'text-amber-500',
      label: 'Aguardando cliente'
    };
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="mb-3"
      >
        <Alert className={`${statusConfig.color} border shadow-sm`}>
          <div className="flex items-start gap-3">
            <div className={`${statusConfig.iconColor} mt-0.5`}>
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className={`font-semibold text-sm ${statusConfig.textColor}`}>
                  Pedido de Transferência
                </h4>
                <Badge variant="outline" className="text-xs">
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {statusConfig.label}
                </Badge>
              </div>
              
              <div className="text-sm text-slate-600 space-y-1">
                <p>
                  <span className="font-medium">Cliente solicitou:</span>{' '}
                  {setorDestino && <span className="text-orange-600 font-semibold">{setorDestino}</span>}
                  {atendenteDestino && (
                    <span className="ml-1">
                      (<UsuarioDisplay usuario={atendenteDestino} variant="compact" />)
                    </span>
                  )}
                </p>
                
                {thread.transfer_requested_text && (
                  <p className="text-xs text-slate-500 italic">
                    <MessageSquare className="w-3 h-3 inline mr-1" />
                    "{thread.transfer_requested_text}"
                  </p>
                )}
                
                {thread.transfer_requested_at && (
                  <p className="text-xs text-slate-400">
                    Solicitado há {format(new Date(thread.transfer_requested_at), 'HH:mm')}
                  </p>
                )}
              </div>

              <div className="flex gap-2 mt-3">
                {thread.transfer_confirmed && !expirado && (
                  <Button
                    onClick={handleTransferirAgora}
                    disabled={processando}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {processando ? (
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    ) : (
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                    )}
                    Transferir Agora
                  </Button>
                )}
                
                {aguardandoCliente && !expirado && (
                  <Button
                    onClick={handleTransferirAgora}
                    disabled={processando}
                    size="sm"
                    variant="outline"
                    className="border-orange-300 text-orange-700 hover:bg-orange-50"
                  >
                    {processando ? (
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    ) : (
                      <ArrowRightLeft className="w-3 h-3 mr-1" />
                    )}
                    Transferir (sem confirmação)
                  </Button>
                )}
                
                <Button
                  onClick={handleCancelar}
                  disabled={processando}
                  size="sm"
                  variant="ghost"
                  className="text-slate-600 hover:text-slate-900"
                >
                  <X className="w-3 h-3 mr-1" />
                  Cancelar Pedido
                </Button>
              </div>
            </div>
          </div>
        </Alert>
      </motion.div>
    </AnimatePresence>
  );
}
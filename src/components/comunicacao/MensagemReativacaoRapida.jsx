import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, Copy, Loader2, RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

/**
 * 🚀 Mensagem de Reativação Rápida
 * Gera sugestão instantânea de reengajamento baseada em:
 * - Dias de inatividade
 * - Tipo de contato (lead/cliente)
 * - Última conversa (se disponível)
 * - Contexto do negócio
 */
export default function MensagemReativacaoRapida({ 
  contato, 
  analise, 
  onUsarMensagem,
  variant = 'inline' // inline | badge
}) {
  const [mensagemSugerida, setMensagemSugerida] = useState(null);
  const [gerando, setGerando] = useState(false);

  const diasInativo = analise?.days_inactive_inbound || 0;
  const tipoContato = contato?.tipo_contato || 'lead';
  const empresa = contato?.empresa || contato?.nome;
  const primeiroNome = empresa?.split(' ')[0] || 'Cliente';

  // ✅ Gerar mensagem automática ao montar
  useEffect(() => {
    if (diasInativo >= 30 && !mensagemSugerida && !gerando) {
      gerarMensagemRapida();
    }
  }, [diasInativo]);

  const gerarMensagemRapida = async () => {
    setGerando(true);
    
    try {
      // 🎯 Templates inteligentes baseados no perfil
      const templates = [];

      // Lead inativo 30-60 dias
      if (tipoContato === 'lead' && diasInativo >= 30 && diasInativo < 60) {
        templates.push(
          `Oi ${primeiroNome}! Tudo bem? 😊\n\nVi que conversamos há um tempo... Surgiu alguma novidade por aí? Posso ajudar em algo?`,
          `E aí ${primeiroNome}, como vão as coisas? 🚀\n\nAqui temos algumas novidades que podem te interessar. Quer dar uma olhada?`,
          `Olá ${primeiroNome}! 👋\n\nQueria retomar nossa conversa... Ainda tem interesse no que conversamos?`
        );
      }

      // Lead inativo 60-90 dias (urgente)
      if (tipoContato === 'lead' && diasInativo >= 60 && diasInativo < 90) {
        templates.push(
          `Oi ${primeiroNome}! 🎯\n\nFaz tempo que não conversamos... Como posso ajudar a tirar seu projeto do papel hoje?`,
          `${primeiroNome}, tudo bem? ⚡\n\nVi que temos uma conversa pendente. Que tal retomarmos? Tenho algumas ideias pra você!`,
          `E aí ${primeiroNome}! 💡\n\nNotei que ficamos um tempo sem falar... Quer marcar uma call rápida pra alinharmos?`
        );
      }

      // Lead inativo 90+ dias (crítico - reativar)
      if (tipoContato === 'lead' && diasInativo >= 90) {
        templates.push(
          `Oi ${primeiroNome}! 🔥\n\nFaz tempo mesmo que não conversamos... Vale a pena retomarmos? Pode ser que eu consiga ajudar agora!`,
          `${primeiroNome}, tudo bem por aí? 🌟\n\nSei que já passou um tempo, mas gostaria muito de retomar nossa conversa. Topas?`,
          `E aí ${primeiroNome}! 🚀\n\nLembrei de você hoje... Como estão as coisas? Ainda posso ser útil de alguma forma?`
        );
      }

      // Cliente inativo 30-60 dias
      if (tipoContato === 'cliente' && diasInativo >= 30 && diasInativo < 60) {
        templates.push(
          `Oi ${primeiroNome}! Tudo certo por aí? 😊\n\nEstava pensando em vocês... Precisando de algo? Estamos aqui!`,
          `E aí ${primeiroNome}, como vão as coisas? 🤝\n\nFaz um tempo que não conversamos... Tudo ok com vocês?`,
          `Olá ${primeiroNome}! 👋\n\nPassando aqui pra saber notícias... Como podemos ajudar hoje?`
        );
      }

      // Cliente inativo 60+ dias (atenção - risco churn)
      if (tipoContato === 'cliente' && diasInativo >= 60) {
        templates.push(
          `Oi ${primeiroNome}! 🎯\n\nSentimos sua falta por aqui... Está tudo bem? Como podemos melhorar nosso atendimento?`,
          `${primeiroNome}, tudo certo? 💙\n\nFaz um tempo que não temos notícias suas... Gostaria de saber se precisam de alguma coisa!`,
          `E aí ${primeiroNome}! 🌟\n\nNotamos que ficamos sem conversar... Quer agendar uma call pra vermos como estão as coisas?`
        );
      }

      // Se não tem template específico, usar genérico
      if (templates.length === 0) {
        templates.push(
          `Oi ${primeiroNome}! Tudo bem? 😊\n\nGostaria de retomar nossa conversa... Posso ajudar em algo?`,
          `E aí ${primeiroNome}, como vai? 👋\n\nFaz um tempo que não conversamos... Surgiu alguma novidade?`
        );
      }

      // Escolher aleatoriamente um template
      const mensagem = templates[Math.floor(Math.random() * templates.length)];
      setMensagemSugerida(mensagem);
      
    } catch (error) {
      console.error('[REATIVACAO] Erro ao gerar mensagem:', error);
      setMensagemSugerida(`Oi ${primeiroNome}! Tudo bem? 😊\n\nGostaria de retomar nossa conversa... Posso ajudar em algo?`);
    } finally {
      setGerando(false);
    }
  };

  const copiarMensagem = () => {
    if (mensagemSugerida) {
      navigator.clipboard.writeText(mensagemSugerida);
      toast.success('✅ Mensagem copiada!');
      if (onUsarMensagem) {
        onUsarMensagem(mensagemSugerida);
      }
    }
  };

  // Não mostrar se não tem inatividade significativa
  if (diasInativo < 30) return null;

  // ═══════════════════════════════════════════════════════════════
  // VERSÃO BADGE (compacta para sidebar)
  // ═══════════════════════════════════════════════════════════════
  if (variant === 'badge') {
    return (
      <button
        onClick={copiarMensagem}
        disabled={gerando || !mensagemSugerida}
        className="inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-full text-[9px] font-semibold shadow-sm hover:shadow-md transition-all hover:from-purple-600 hover:to-indigo-700 disabled:opacity-50"
        title={mensagemSugerida || "Gerando sugestão..."}
      >
        {gerando ? (
          <Loader2 className="w-2.5 h-2.5 animate-spin" />
        ) : (
          <Zap className="w-2.5 h-2.5" />
        )}
        Reativar IA
      </button>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // VERSÃO INLINE (expandida para chat)
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-3">
      <div className="flex items-start gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-xs font-bold text-purple-900">
              ⚡ Reativação Instantânea
            </p>
            <Badge className="bg-blue-500 text-white text-[8px] px-1 py-0 font-bold">
              SEM ANÁLISE
            </Badge>
          </div>
          <p className="text-[10px] text-purple-700">
            {diasInativo} dias sem resposta • Sugestão baseada em perfil
          </p>
        </div>
        <Badge className={`text-[9px] px-1.5 py-0.5 font-bold ${
          diasInativo >= 90 ? 'bg-red-600 text-white' : 
          diasInativo >= 60 ? 'bg-orange-500 text-white' : 
          'bg-yellow-500 text-white'
        }`}>
          {diasInativo >= 90 ? '🔴 CRÍTICO' : diasInativo >= 60 ? '🟠 URGENTE' : '🟡 ALERTA'}
        </Badge>
      </div>

      {gerando ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-purple-600 mr-2" />
          <span className="text-sm text-purple-700">Gerando mensagem...</span>
        </div>
      ) : mensagemSugerida ? (
        <>
          <div className="bg-white rounded-lg p-2 mb-2 border border-purple-200">
            <p className="text-sm text-slate-700 whitespace-pre-line">
              {mensagemSugerida}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={copiarMensagem}
              size="sm"
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs flex-1"
            >
              <Copy className="w-3 h-3 mr-1" />
              Copiar e Usar
            </Button>
            
            <Button
              onClick={gerarMensagemRapida}
              size="sm"
              variant="outline"
              className="border-purple-300 text-purple-700 hover:bg-purple-50 text-xs"
            >
              <RefreshCw className="w-3 h-3" />
            </Button>
          </div>
        </>
      ) : (
        <Button
          onClick={gerarMensagemRapida}
          size="sm"
          variant="outline"
          className="w-full border-purple-300 text-purple-700 hover:bg-purple-50 text-xs"
        >
          <Zap className="w-3 h-3 mr-1" />
          Gerar Mensagem de Reativação
        </Button>
      )}
    </div>
  );
}
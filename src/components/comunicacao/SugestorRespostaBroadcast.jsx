import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Send, Copy, Check, Zap, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function SugestorRespostaBroadcast({
  thread,
  ultimaMensagemCliente,
  onSugerirResposta,
  contato,
  usuario
}) {
  const [sugestoes, setSugestoes] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [copiada, setCopiada] = useState(null);
  const [mostrarIACompleta, setMostrarIACompleta] = useState(false);
  const [carregandoIA, setCarregandoIA] = useState(false);

  // ✅ DETECÇÃO: Verificar se há broadcast recente
  const temBroadcastRecente = () => {
    if (!thread?.metadata?.broadcast_data) return false;
    const broadcastTime = new Date(thread.metadata.broadcast_data);
    const agora = new Date();
    const diasDecorridos = (agora - broadcastTime) / (1000 * 60 * 60 * 24);
    return diasDecorridos <= 3; // Janela de 72h
  };

  useEffect(() => {
    if (!ultimaMensagemCliente || !temBroadcastRecente()) {
      return;
    }
    gerarSugestoesRapidas();
  }, [ultimaMensagemCliente, thread?.id]);

  // ✅ CLASSIFICAÇÃO LEVE (sem IA)
  const classificarIntencao = (mensagem) => {
    const msg = mensagem.toLowerCase();
    
    // Interesse
    if (/interesse|quero|preciso|cota|cotar|valor|preço|quanto|pode|tem|enviá|manda/i.test(msg)) {
      return { tipo: 'interesse', emoji: '👍', descricao: 'Interesse confirmado' };
    }
    
    // Rejeição
    if (/não|nao|n preciso|de repente|depois|outro momento|agora não|não agora|não tenho|desculpe|obrigado mas|tá bom/i.test(msg)) {
      return { tipo: 'rejeicao', emoji: '👎', descricao: 'Possível rejeição' };
    }
    
    // Dúvida
    if (/como|qual|quando|onde|o que|quais|dúvida|duvida|questao|info|mais info|esclarecer|entendi|o quê|pra quê|por quê/i.test(msg)) {
      return { tipo: 'duvida', emoji: '❓', descricao: 'Dúvida ou pergunta' };
    }

    // Disponibilidade/Prazo
    if (/quando|prazo|entrega|disponíveis|tem em estoque|já chega|quanto tempo|demora/i.test(msg)) {
      return { tipo: 'disponibilidade', emoji: '⏰', descricao: 'Pergunta sobre prazo' };
    }
    
    return { tipo: 'generico', emoji: '💬', descricao: 'Mensagem genérica' };
  };

  // ✅ SUGESTÕES RÁPIDAS (templates sem IA)
  const gerarSugestoesRapidas = () => {
    const intencao = classificarIntencao(ultimaMensagemCliente);
    const nome = contato?.nome || 'Cliente';
    
    let suegsBase = [];

    if (intencao.tipo === 'interesse') {
      suegsBase = [
        {
          resposta: `Ótimo ${nome}! 😊 Fico feliz com seu interesse. Posso enviar um orçamento personalizado para você avaliar. Qual seria o melhor horário para conversarmos sobre os detalhes?`,
          tipo: 'engagement',
          prioridade: 'alta'
        },
        {
          resposta: `Excelente! Vou preparar uma proposta especial para você. Podemos agendar uma chamada esta semana para discutir suas necessidades com mais detalhes?`,
          tipo: 'qualificacao',
          prioridade: 'alta'
        },
        {
          resposta: `Perfeito! 🎯 Vou coletar algumas informações e envio um orçamento em no máximo 24h. Pode ser?`,
          tipo: 'efficiency',
          prioridade: 'media'
        }
      ];
    } else if (intencao.tipo === 'rejeicao') {
      suegsBase = [
        {
          resposta: `Sem problema ${nome}! Se mudar de ideia ou tiver dúvidas no futuro, é só chamar. Fico à disposição! 😊`,
          tipo: 'follow_up',
          prioridade: 'media'
        },
        {
          resposta: `Tudo bem! Às vezes o timing não é o ideal. Posso te adicionar a uma lista para reacionar em uma melhor oportunidade?`,
          tipo: 'nurture',
          prioridade: 'media'
        },
        {
          resposta: `Entendo perfeitamente. Mas fico curioso - existe algo que você gostaria que fosse diferente? Adoraria seus comentários.`,
          tipo: 'feedback',
          prioridade: 'baixa'
        }
      ];
    } else if (intencao.tipo === 'duvida') {
      suegsBase = [
        {
          resposta: `Ótima pergunta ${nome}! Deixa eu te esclarecer isso direitinho. [Escrever explicação clara e concisa aqui]. Ficou claro?`,
          tipo: 'education',
          prioridade: 'alta'
        },
        {
          resposta: `Entendo sua dúvida! Vou enviar um documento explicativo que aborda exatamente isso. Você consegue revisar e a gente conversa depois?`,
          tipo: 'support',
          prioridade: 'alta'
        },
        {
          resposta: `Boa pergunta! Acho melhor agendarmos uma breve chamada para eu explicar melhor. Você tem 15 minutos nesta semana?`,
          tipo: 'scheduling',
          prioridade: 'media'
        }
      ];
    } else if (intencao.tipo === 'disponibilidade') {
      suegsBase = [
        {
          resposta: `Temos disponibilidade! O prazo padrão é de [X dias], mas para você posso tentar acelerar. Deixa eu verificar com o time.`,
          tipo: 'commitment',
          prioridade: 'alta'
        },
        {
          resposta: `Ótima pergunta! Nos primeiros [X dias] você já tem a solução funcionando. Quer que eu reserve uma data para você?`,
          tipo: 'closing',
          prioridade: 'alta'
        },
        {
          resposta: `Entendo a urgência. Deixa eu ver aqui a disponibilidade exata... qual data limite você precisa?`,
          tipo: 'negotiation',
          prioridade: 'media'
        }
      ];
    } else {
      suegsBase = [
        {
          resposta: `Entendi ${nome}! Me conta mais - qual é sua principal necessidade neste momento?`,
          tipo: 'discovery',
          prioridade: 'media'
        },
        {
          resposta: `Que legal! Para te atender melhor, gostaria de saber um pouco mais. Qual é o seu maior desafio agora?`,
          tipo: 'qualification',
          prioridade: 'media'
        },
        {
          resposta: `Agradeço o retorno! Vamos ver como posso ajudar. Pode me detalhar melhor o que você está procurando?`,
          tipo: 'engagement',
          prioridade: 'baixa'
        }
      ];
    }

    setSugestoes(suegsBase);
    setCarregando(false);
  };

  // ✅ IA COMPLETA: Usar análise V3.1 + insights
  const gerarSuguestaoIACompleta = async () => {
    setCarregandoIA(true);
    try {
      const intencao = classificarIntencao(ultimaMensagemCliente);
      
      const prompt = `Você é um especialista em vendas B2B respondendo a uma resposta a broadcast/campanha.

📊 CONTEXTO DO CLIENTE:
- Nome: ${contato?.nome || 'Cliente'}
- Empresa: ${contato?.empresa || 'Não informado'}
- Tipo: ${contato?.tipo_contato || 'Não informado'}

💬 MENSAGEM DO CLIENTE:
"${ultimaMensagemCliente}"

🎯 INTENÇÃO DETECTADA: ${intencao.descricao} (${intencao.tipo})

📈 TAREFA:
Gere 1 resposta PROFISSIONAL, NATURAL e PERSUASIVA que:
1. Reconheça genuinamente a mensagem do cliente
2. Mostre entendimento real da intenção dele
3. Avance o relacionamento de forma natural
4. Inclua um CTA claro mas não invasivo
5. Mantenha tom conversacional (não venda dura)

A resposta deve ter 2-3 frases no máximo e soar como um humano real, não um template.`;

      const resultado = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            resposta: { type: 'string' },
            rationale: { type: 'string' },
            temperatura: { type: 'string', enum: ['quente', 'morna', 'fria'] }
          }
        }
      });

      if (resultado?.resposta) {
        setSugestoes([{
          resposta: resultado.resposta,
          tipo: 'ia_full',
          prioridade: 'alta',
          rationale: resultado.rationale
        }]);
        setMostrarIACompleta(true);
      }
    } catch (error) {
      console.error('[SugestorBroadcast] Erro IA completa:', error);
      toast.error('❌ Erro ao gerar sugestão com IA');
    } finally {
      setCarregandoIA(false);
    }
  };

  const copiarResposta = (texto) => {
    navigator.clipboard.writeText(texto);
    setCopiada(texto);
    toast.success('✅ Copiada!');
    setTimeout(() => setCopiada(null), 2000);
  };

  if (!ultimaMensagemCliente || !temBroadcastRecente()) {
    return null;
  }

  const intencaoAtual = classificarIntencao(ultimaMensagemCliente);

  return (
    <div className="bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2 mb-2 justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-600" />
          <h4 className="text-sm font-semibold text-cyan-900">
            {intencaoAtual.emoji} Respostas Inteligentes para Broadcast
          </h4>
        </div>
        <Badge className="text-[10px] bg-cyan-100 text-cyan-700">
          {intencaoAtual.descricao}
        </Badge>
      </div>

      {/* Sugestões Rápidas */}
      <div className="space-y-2">
        {sugestoes.map((sug, idx) => (
          <div
            key={idx}
            className="bg-white rounded border border-cyan-100 p-2 space-y-1.5 hover:border-cyan-300 transition"
          >
            <p className="text-xs text-slate-700 leading-relaxed">
              {sug.resposta}
            </p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 bg-cyan-50">
                {sug.tipo}
              </Badge>
              {sug.prioridade === 'alta' && (
                <Badge className="text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-700">
                  ⭐ Prioritária
                </Badge>
              )}
              <div className="flex-1" />
              <Button
                size="xs"
                variant="ghost"
                className="h-6 px-1.5 text-[10px]"
                onClick={() => copiarResposta(sug.resposta)}
              >
                {copiada === sug.resposta ? (
                  <>
                    <Check className="w-3 h-3 mr-0.5 text-green-600" />
                    OK
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 mr-0.5" />
                    Copiar
                  </>
                )}
              </Button>
              <Button
                size="xs"
                className="h-6 px-1.5 text-[10px] bg-cyan-600 hover:bg-cyan-700"
                onClick={() => {
                  if (onSugerirResposta) {
                    onSugerirResposta(sug.resposta);
                  }
                }}
              >
                <Send className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Botão IA Completa */}
      {!mostrarIACompleta && (
        <div className="flex gap-2 pt-1">
          <Button
            size="xs"
            className="flex-1 text-[10px] bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 h-7"
            onClick={gerarSuguestaoIACompleta}
            disabled={carregandoIA}
          >
            {carregandoIA ? (
              <>
                <div className="animate-spin">⚙️</div>
                <span className="ml-1">Gerando IA...</span>
              </>
            ) : (
              <>
                <Zap className="w-3 h-3 mr-1" />
                Gerar IA Completa
              </>
            )}
          </Button>
        </div>
      )}

      {/* Indicador de Janela */}
      <div className="flex items-center gap-1 text-[10px] text-slate-500 pt-1">
        <Clock className="w-3 h-3" />
        <span>Janela de broadcast: 72h após envio</span>
      </div>
    </div>
  );
}
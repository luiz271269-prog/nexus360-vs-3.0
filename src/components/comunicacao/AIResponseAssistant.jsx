import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles, Loader2, X, RefreshCw, ChevronDown, ChevronUp, Zap, Edit3, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const TONS = [
  { id: 'auto', label: '✨ Automático', desc: 'Adaptado ao estilo do contato' },
  { id: 'formal', label: '👔 Formal', desc: 'Profissional e respeitoso' },
  { id: 'amigavel', label: '😊 Amigável', desc: 'Caloroso e próximo' },
  { id: 'direto', label: '⚡ Direto', desc: 'Conciso e objetivo' },
  { id: 'empatico', label: '💙 Empático', desc: 'Compreensivo e acolhedor' },
];

export default function AIResponseAssistant({
  thread,
  mensagens = [],
  nomeContato,
  ultimaMensagemCliente, // pode ser string ou objeto Message
  onSugestaoSelecionada,
  onClose,
  visible,
}) {
  const [sugestoes, setSugestoes] = useState([]);
  const [rascunho, setRascunho] = useState('');
  const [palavrasChave, setPalavrasChave] = useState('');
  const [tonSelecionado, setTonSelecionado] = useState('auto');
  const [carregando, setCarregando] = useState(false);
  const [carregandoRascunho, setCarregandoRascunho] = useState(false);
  const [mostrarTons, setMostrarTons] = useState(false);
  const [aba, setAba] = useState('sugestoes'); // 'sugestoes' | 'rascunho'
  const [rascunhoEditado, setRascunhoEditado] = useState('');
  const [ultimaThreadId, setUltimaThreadId] = useState(null);
  const gerandoRef = useRef(false);

  // Gerar sugestões automaticamente quando chega nova mensagem do cliente
  useEffect(() => {
    if (!visible || !ultimaMensagemCliente || !thread?.id) return;
    if (gerandoRef.current) return;
    // Só regera se mudou a thread ou a última mensagem
    const key = `${thread.id}-${ultimaMensagemCliente?.id}`;
    if (ultimaThreadId === key) return;
    setUltimaThreadId(key);
    gerarSugestoes();
  }, [visible, ultimaMensagemCliente?.id, thread?.id]);

  const buildContext = useCallback(() => {
    // Pega as últimas 20 mensagens para contexto
    const ultimas = mensagens.slice(-20);
    return ultimas.map(m => {
      const quem = m.sender_type === 'contact' ? (nomeContato || 'Cliente') : 'Atendente';
      return `${quem}: ${m.content || ''}`;
    }).join('\n');
  }, [mensagens, nomeContato]);

  const detectarEstiloContato = useCallback(() => {
    // Analisa o estilo das mensagens do contato para adaptar o tom
    const msgContato = mensagens
      .filter(m => m.sender_type === 'contact')
      .slice(-10)
      .map(m => m.content || '')
      .join(' ');

    const temEmoji = /[\u{1F300}-\u{1F9FF}]/u.test(msgContato);
    const temGiriasInformais = /vc|blz|oi|ola|obg|vlw|tô|né|td|tudo/i.test(msgContato);
    const temPontuacaoFormal = /[.!?]{1}$/.test(msgContato.trim());

    if (temEmoji || temGiriasInformais) return 'amigavel';
    if (temPontuacaoFormal && msgContato.length > 100) return 'formal';
    return 'direto';
  }, [mensagens]);

  const gerarSugestoes = useCallback(async () => {
    if (gerandoRef.current || !thread?.id) return;
    gerandoRef.current = true;
    setCarregando(true);
    setSugestoes([]);

    try {
      const contexto = buildContext();
      const estiloDetectado = tonSelecionado === 'auto' ? detectarEstiloContato() : tonSelecionado;
      const tonDesc = TONS.find(t => t.id === estiloDetectado)?.desc || '';

      const ultimaMsg = typeof ultimaMensagemCliente === 'string'
      ? ultimaMensagemCliente
      : (ultimaMensagemCliente?.content || '');

    const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Você é um assistente de vendas e atendimento ao cliente. Analise a conversa abaixo e gere 3 sugestões de resposta curtas e objetivas para o atendente.

CONVERSA (contexto):
${contexto}

ÚLTIMA MENSAGEM DO CLIENTE:
${ultimaMsg}

NOME DO CLIENTE: ${nomeContato || 'Cliente'}

TOM DESEJADO: ${tonDesc || estiloDetectado}

INSTRUÇÕES:
- Gere exatamente 3 sugestões de resposta
- Cada sugestão deve ser curta (1-3 frases), natural e adequada ao contexto
- Adapte o tom/estilo baseado no histórico de mensagens do cliente
- As sugestões devem ser variadas (ex: confirmar algo, pedir mais info, oferecer solução)
- Não use placeholders como [nome] ou [produto], use o que está no contexto
- Responda APENAS com o JSON abaixo`,
        response_json_schema: {
          type: 'object',
          properties: {
            sugestoes: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      });

      if (result?.sugestoes?.length) {
        setSugestoes(result.sugestoes.slice(0, 3));
      }
    } catch (err) {
      console.error('[AIAssistant] Erro ao gerar sugestões:', err);
    } finally {
      setCarregando(false);
      gerandoRef.current = false;
    }
  }, [thread?.id, ultimaMensagemCliente, tonSelecionado, buildContext, detectarEstiloContato]);

  const gerarRascunho = useCallback(async () => {
    if (!thread?.id) return;
    setCarregandoRascunho(true);
    setRascunho('');
    setRascunhoEditado('');

    try {
      const contexto = buildContext();
      const estiloDetectado = tonSelecionado === 'auto' ? detectarEstiloContato() : tonSelecionado;
      const tonDesc = TONS.find(t => t.id === estiloDetectado)?.desc || '';

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Você é um assistente de vendas. Gere um rascunho de resposta completo para o atendente enviar ao cliente.

CONVERSA (contexto):
${contexto}

ÚLTIMA MENSAGEM DO CLIENTE:
${ultimaMensagemCliente?.content || ''}

PALAVRAS-CHAVE / TEMA: ${palavrasChave || 'Responder adequadamente ao contexto'}

NOME DO CLIENTE: ${nomeContato || 'Cliente'}
TOM: ${tonDesc || estiloDetectado}

INSTRUÇÕES:
- Gere um rascunho de resposta completo e profissional
- Use o tom/estilo adequado ao cliente
- Seja natural, não robótico
- Se tiver palavras-chave, incorpore-as na resposta
- Responda APENAS com o JSON`,
        response_json_schema: {
          type: 'object',
          properties: {
            rascunho: { type: 'string' },
          },
        },
      });

      if (result?.rascunho) {
        setRascunho(result.rascunho);
        setRascunhoEditado(result.rascunho);
      }
    } catch (err) {
      console.error('[AIAssistant] Erro ao gerar rascunho:', err);
    } finally {
      setCarregandoRascunho(false);
    }
  }, [thread?.id, ultimaMensagemCliente, palavrasChave, tonSelecionado, buildContext, detectarEstiloContato]);

  const handleSelecionarSugestao = useCallback((texto) => {
    onSugestaoSelecionada(texto);
    onClose();
  }, [onSugestaoSelecionada, onClose]);

  const handleUsarRascunho = useCallback(() => {
    onSugestaoSelecionada(rascunhoEditado || rascunho);
    onClose();
  }, [rascunho, rascunhoEditado, onSugestaoSelecionada, onClose]);

  if (!visible) return null;

  return (
    <div className="border-t border-purple-200 bg-gradient-to-b from-purple-50 to-white">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-purple-100">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-xs font-semibold text-purple-800">Assistente IA</span>
        </div>

        <div className="flex items-center gap-1">
          {/* Seletor de Tom */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMostrarTons(!mostrarTons)}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors"
            >
              <span>{TONS.find(t => t.id === tonSelecionado)?.label || '✨ Automático'}</span>
              {mostrarTons ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {mostrarTons && (
              <div className="absolute bottom-full mb-1 right-0 bg-white rounded-xl shadow-xl border border-purple-100 z-50 py-1 min-w-[200px]">
                {TONS.map(ton => (
                  <button
                    key={ton.id}
                    type="button"
                    onClick={() => { setTonSelecionado(ton.id); setMostrarTons(false); setSugestoes([]); setRascunho(''); }}
                    className={cn(
                      "w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-purple-50 transition-colors",
                      tonSelecionado === ton.id && "bg-purple-50"
                    )}
                  >
                    <div className="flex-1">
                      <div className={cn("text-xs font-medium", tonSelecionado === ton.id ? "text-purple-700" : "text-slate-700")}>
                        {ton.label}
                      </div>
                      <div className="text-xs text-slate-400">{ton.desc}</div>
                    </div>
                    {tonSelecionado === ton.id && <Check className="w-3.5 h-3.5 text-purple-600 mt-0.5" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Abas */}
      <div className="flex border-b border-purple-100">
        <button
          type="button"
          onClick={() => setAba('sugestoes')}
          className={cn(
            "flex-1 py-1.5 text-xs font-medium transition-colors",
            aba === 'sugestoes'
              ? "text-purple-700 border-b-2 border-purple-500 bg-purple-50/50"
              : "text-slate-500 hover:text-slate-700"
          )}
        >
          <Zap className="w-3 h-3 inline mr-1" />
          Sugestões Rápidas
        </button>
        <button
          type="button"
          onClick={() => setAba('rascunho')}
          className={cn(
            "flex-1 py-1.5 text-xs font-medium transition-colors",
            aba === 'rascunho'
              ? "text-purple-700 border-b-2 border-purple-500 bg-purple-50/50"
              : "text-slate-500 hover:text-slate-700"
          )}
        >
          <Edit3 className="w-3 h-3 inline mr-1" />
          Gerar Rascunho
        </button>
      </div>

      <div className="p-2">
        {/* ABA SUGESTÕES */}
        {aba === 'sugestoes' && (
          <div>
            {carregando ? (
              <div className="flex items-center justify-center gap-2 py-4 text-purple-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs">Analisando conversa...</span>
              </div>
            ) : sugestoes.length > 0 ? (
              <div className="space-y-1.5">
                {sugestoes.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSelecionarSugestao(s)}
                    className="w-full text-left px-3 py-2 rounded-lg bg-white border border-purple-100 hover:border-purple-400 hover:bg-purple-50 transition-all text-xs text-slate-700 shadow-sm group"
                  >
                    <span className="text-purple-400 font-bold mr-1 group-hover:text-purple-600">{i + 1}.</span>
                    {s}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={gerarSugestoes}
                  className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-purple-500 hover:text-purple-700 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  Gerar novas sugestões
                </button>
              </div>
            ) : (
              <div className="text-center py-3">
                <p className="text-xs text-slate-400 mb-2">Nenhuma sugestão gerada ainda</p>
                <button
                  type="button"
                  onClick={gerarSugestoes}
                  className="flex items-center gap-1 mx-auto px-3 py-1.5 rounded-full bg-purple-100 text-purple-700 hover:bg-purple-200 text-xs font-medium transition-colors"
                >
                  <Sparkles className="w-3 h-3" />
                  Gerar Sugestões
                </button>
              </div>
            )}
          </div>
        )}

        {/* ABA RASCUNHO */}
        {aba === 'rascunho' && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={palavrasChave}
                onChange={(e) => setPalavrasChave(e.target.value)}
                placeholder="Palavras-chave ou tema (ex: prazo entrega, desconto...)"
                className="flex-1 px-2 py-1.5 text-xs border border-purple-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-400 bg-white"
                onKeyDown={(e) => e.key === 'Enter' && gerarRascunho()}
              />
              <button
                type="button"
                onClick={gerarRascunho}
                disabled={carregandoRascunho}
                className="px-3 py-1.5 text-xs bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-purple-600 hover:to-indigo-700 transition-all disabled:opacity-60 flex items-center gap-1 font-medium"
              >
                {carregandoRascunho ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                Gerar
              </button>
            </div>

            {carregandoRascunho ? (
              <div className="flex items-center justify-center gap-2 py-4 text-purple-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs">Gerando rascunho...</span>
              </div>
            ) : rascunho ? (
              <div className="space-y-2">
                <textarea
                  value={rascunhoEditado}
                  onChange={(e) => setRascunhoEditado(e.target.value)}
                  rows={3}
                  className="w-full px-2 py-1.5 text-xs border border-purple-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-400 bg-white resize-none"
                />
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={handleUsarRascunho}
                    className="flex-1 py-1.5 text-xs bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-purple-600 hover:to-indigo-700 transition-all font-medium flex items-center justify-center gap-1"
                  >
                    <Check className="w-3 h-3" />
                    Usar Rascunho
                  </button>
                  <button
                    type="button"
                    onClick={gerarRascunho}
                    className="px-2 py-1.5 text-xs border border-purple-200 text-purple-600 rounded-lg hover:bg-purple-50 transition-colors flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Refazer
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-2">
                Digite palavras-chave e clique em Gerar para criar um rascunho completo
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
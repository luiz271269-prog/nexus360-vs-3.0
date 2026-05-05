import React from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, X, MessageSquare, Send, Mic, StopCircle, Phone, MapPin, Bell, Trash2, Play, Pause } from 'lucide-react';
import { toast } from 'sonner';
import { useAudioRecorder } from '@/components/comunicacao/useAudioRecorder';

/**
 * Drawer de Histórico Interno do Cliente.
 * Salva entradas em Cliente.observacoes (linhas estruturadas) +
 * cria registros em Interacao para auditoria/timeline cruzada.
 *
 * Como o schema do Cliente não tem campo dedicado, usamos a entidade
 * Interacao já existente (suporta cliente_id, vendedor, tipo, observacoes,
 * audio_url via metadata).
 */

const TIPOS = [
  { value: 'nota',     label: 'Nota',      icon: MessageSquare, cor: 'bg-amber-500',   tipoInteracao: 'outro' },
  { value: 'ligacao',  label: 'Ligação',   icon: Phone,         cor: 'bg-blue-500',    tipoInteracao: 'ligacao' },
  { value: 'visita',   label: 'Visita',    icon: MapPin,        cor: 'bg-emerald-500', tipoInteracao: 'visita' },
  { value: 'followup', label: 'Follow-up', icon: Bell,          cor: 'bg-purple-500',  tipoInteracao: 'outro' },
];

function AudioPlayer({ url }) {
  const audioRef = React.useRef(null);
  const [playing, setPlaying] = React.useState(false);
  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause();
    else audioRef.current.play();
  };
  return (
    <div className="flex items-center gap-2 bg-slate-700 rounded-lg px-2 py-1.5">
      <button onClick={toggle} className="w-7 h-7 rounded-full bg-amber-500 hover:bg-amber-600 flex items-center justify-center flex-shrink-0">
        {playing ? <Pause className="w-3.5 h-3.5 text-white" /> : <Play className="w-3.5 h-3.5 text-white ml-0.5" />}
      </button>
      <audio
        ref={audioRef}
        src={url}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        controls
        className="flex-1 h-8"
        style={{ filter: 'invert(1) hue-rotate(180deg)' }}
      />
    </div>
  );
}

export default function ClienteHistoricoDrawer({ cliente, isOpen, onClose, onSaved }) {
  const [historico, setHistorico] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [usuario, setUsuario] = React.useState(null);
  const [texto, setTexto] = React.useState('');
  const [tipo, setTipo] = React.useState('nota');
  const [salvando, setSalvando] = React.useState(false);
  const [enviandoAudio, setEnviandoAudio] = React.useState(false);

  const { gravando, iniciarGravacao, pararGravacao, audioBlob, duracaoSegundos } = useAudioRecorder();

  const carregar = React.useCallback(async () => {
    if (!cliente?.id) return;
    setLoading(true);
    try {
      const lista = await base44.entities.Interacao.filter(
        { cliente_id: cliente.id }, '-data_interacao', 100
      );
      setHistorico(Array.isArray(lista) ? lista : []);
    } catch (e) {
      console.error('[ClienteHistorico] Erro ao listar:', e);
      setHistorico([]);
    } finally {
      setLoading(false);
    }
  }, [cliente?.id]);

  React.useEffect(() => {
    if (!isOpen) return;
    base44.auth.me().then(setUsuario).catch(() => {});
    carregar();
  }, [isOpen, carregar]);

  const handleAdicionarNota = async () => {
    if (!texto.trim()) {
      toast.error('Escreva algo antes de salvar');
      return;
    }
    if (!cliente?.id) {
      toast.error('Cliente inválido');
      return;
    }
    setSalvando(true);
    try {
      const tipoCfg = TIPOS.find(t => t.value === tipo);
      await base44.entities.Interacao.create({
        cliente_id: cliente.id,
        cliente_nome: cliente.razao_social || cliente.nome_fantasia || '',
        vendedor: usuario?.full_name || usuario?.email || 'Sistema',
        tipo_interacao: tipoCfg?.tipoInteracao || 'outro',
        data_interacao: new Date().toISOString(),
        resultado: 'informacao_fornecida',
        observacoes: texto.trim(),
        categoria_interacao: 'informacao_geral',
      });
      setTexto('');
      setTipo('nota');
      toast.success('✅ Registro adicionado');
      await carregar();
      if (onSaved) onSaved();
    } catch (e) {
      console.error('[ClienteHistorico] Erro ao salvar:', e);
      toast.error('Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  React.useEffect(() => {
    if (!audioBlob || audioBlob.size === 0) return;
    let cancelado = false;
    (async () => {
      setEnviandoAudio(true);
      try {
        const file = new File([audioBlob], `historico-${Date.now()}.ogg`, { type: 'audio/ogg; codecs=opus' });
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        if (cancelado) return;
        await base44.entities.Interacao.create({
          cliente_id: cliente.id,
          cliente_nome: cliente.razao_social || cliente.nome_fantasia || '',
          vendedor: usuario?.full_name || usuario?.email || 'Sistema',
          tipo_interacao: 'outro',
          data_interacao: new Date().toISOString(),
          resultado: 'informacao_fornecida',
          observacoes: `[ÁUDIO] ${texto.trim() || ''}\n${file_url}`,
          categoria_interacao: 'informacao_geral',
        });
        setTexto('');
        toast.success('🎤 Áudio salvo');
        await carregar();
        if (onSaved) onSaved();
      } catch (e) {
        console.error('[ClienteHistorico] Erro upload áudio:', e);
        toast.error('Erro ao enviar áudio');
      } finally {
        if (!cancelado) setEnviandoAudio(false);
      }
    })();
    return () => { cancelado = true; };
  }, [audioBlob]);

  const handleRemover = async (entrada) => {
    if (!confirm('Remover esta entrada do histórico?')) return;
    try {
      await base44.entities.Interacao.delete(entrada.id);
      toast.success('Entrada removida');
      await carregar();
      if (onSaved) onSaved();
    } catch (e) {
      toast.error('Erro ao remover');
    }
  };

  const formatarData = (iso) => {
    const d = new Date(iso);
    const hoje = new Date();
    const ontem = new Date(hoje); ontem.setDate(ontem.getDate() - 1);
    const sameDay = (a, b) => a.toDateString() === b.toDateString();
    const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (sameDay(d, hoje)) return `Hoje ${hora}`;
    if (sameDay(d, ontem)) return `Ontem ${hora}`;
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const extrairAudio = (obs) => {
    if (!obs || !obs.startsWith('[ÁUDIO]')) return null;
    const m = obs.match(/(https?:\/\/\S+)/);
    return m ? m[1] : null;
  };

  const limparTexto = (obs) => {
    if (!obs) return '';
    if (obs.startsWith('[ÁUDIO]')) return obs.replace(/^\[ÁUDIO\]\s*/, '').replace(/https?:\/\/\S+/, '').trim();
    return obs;
  };

  const tipoVisualPorInteracao = (tipoInteracao, observacoes) => {
    if (observacoes && observacoes.startsWith('[ÁUDIO]')) {
      return { label: 'Áudio', icon: Mic, cor: 'bg-rose-500' };
    }
    if (tipoInteracao === 'ligacao') return TIPOS[1];
    if (tipoInteracao === 'visita') return TIPOS[2];
    return TIPOS[0];
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />

      <div className="fixed right-0 top-0 bottom-0 w-full md:w-[440px] bg-slate-900 shadow-2xl z-50 flex flex-col border-l border-slate-700">
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <MessageSquare className="w-4 h-4 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">Histórico do Cliente</p>
              <p className="text-[11px] text-white/80 truncate">
                {cliente?.razao_social || cliente?.nome_fantasia || 'Cliente'} • {historico.length} {historico.length === 1 ? 'registro' : 'registros'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
            </div>
          ) : historico.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4 py-12">
              <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mb-3">
                <MessageSquare className="w-5 h-5 text-slate-500" />
              </div>
              <p className="text-slate-300 font-semibold text-sm">Nenhum registro ainda</p>
              <p className="text-xs text-slate-500 mt-1 max-w-[260px]">
                Adicione notas, registre ligações, visitas ou follow-ups deste cliente abaixo.
              </p>
            </div>
          ) : (
            historico.map((entrada) => {
              const audioUrl = extrairAudio(entrada.observacoes);
              const txtLimpo = limparTexto(entrada.observacoes);
              const tipoInfo = tipoVisualPorInteracao(entrada.tipo_interacao, entrada.observacoes);
              const Icon = tipoInfo.icon;
              return (
                <div key={entrada.id} className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 group">
                  <div className="flex items-start gap-2">
                    <div className={`${tipoInfo.cor} w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0`}>
                      <Icon className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs font-semibold text-white truncate">{entrada.vendedor || 'Sistema'}</span>
                          <span className="text-[10px] text-slate-400 flex-shrink-0">• {tipoInfo.label}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 flex-shrink-0">{formatarData(entrada.data_interacao || entrada.created_date)}</span>
                      </div>
                      {txtLimpo && (
                        <p className="text-xs text-slate-200 whitespace-pre-wrap break-words leading-relaxed">{txtLimpo}</p>
                      )}
                      {audioUrl && (
                        <div className="mt-1.5">
                          <AudioPlayer url={audioUrl} />
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemover(entrada)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400"
                      title="Remover"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-slate-700 p-3 bg-slate-900 flex-shrink-0">
          <div className="flex items-center gap-1 mb-2">
            {TIPOS.map(t => {
              const Icon = t.icon;
              const ativo = tipo === t.value;
              return (
                <button
                  key={t.value}
                  onClick={() => setTipo(t.value)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-all ${
                    ativo ? `${t.cor} text-white shadow-md` : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-end gap-2">
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={gravando ? 'Gravando áudio…' : 'Escreva uma nota ou comentário interno…'}
              rows={2}
              disabled={gravando || enviandoAudio}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500 resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAdicionarNota();
                }
              }}
            />
            <div className="flex flex-col gap-1">
              {!gravando ? (
                <button
                  onClick={iniciarGravacao}
                  disabled={enviandoAudio || salvando}
                  className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white disabled:opacity-50"
                  title="Gravar áudio"
                >
                  <Mic className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={pararGravacao}
                  className="w-9 h-9 rounded-lg bg-red-500 hover:bg-red-600 flex items-center justify-center text-white animate-pulse"
                  title="Parar gravação"
                >
                  <StopCircle className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={handleAdicionarNota}
                disabled={salvando || gravando || enviandoAudio || !texto.trim()}
                className="w-9 h-9 rounded-lg bg-amber-500 hover:bg-amber-600 flex items-center justify-center text-white disabled:opacity-40 disabled:cursor-not-allowed"
                title="Salvar nota"
              >
                {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {enviandoAudio && (
            <div className="mt-2 flex items-center gap-2 text-[11px] text-amber-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              Enviando áudio…
            </div>
          )}
          {gravando && (
            <div className="mt-2 flex items-center gap-2 text-[11px] text-red-400">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              Gravando… clique em parar para salvar.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
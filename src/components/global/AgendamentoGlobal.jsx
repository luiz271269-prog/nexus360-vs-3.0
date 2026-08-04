import React, { useState, useEffect } from 'react';
import NovoAgendamentoDialog from '@/components/agenda/NovoAgendamentoDialog';

/**
 * Monta o diálogo de agendamento uma única vez no Layout, disponível em toda tela.
 * Qualquer componente abre com:
 *   window.dispatchEvent(new CustomEvent('nexus:novo-agendamento', { detail: { titulo, threadId, contactId } }))
 */
export default function AgendamentoGlobal() {
  const [aberto, setAberto] = useState(false);
  const [contexto, setContexto] = useState({});

  useEffect(() => {
    const abrir = (e) => {
      setContexto(e.detail || {});
      setAberto(true);
    };
    window.addEventListener('nexus:novo-agendamento', abrir);
    return () => window.removeEventListener('nexus:novo-agendamento', abrir);
  }, []);

  return (
    <NovoAgendamentoDialog
      aberto={aberto}
      contexto={contexto}
      onFechar={() => setAberto(false)}
    />
  );
}
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

// Página migrada: Contatos Inteligentes agora vive como aba dentro do CRM (Central de Qualificação)
export default function ContatosInteligentes() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate(createPageUrl('LeadsQualificados') + '?tab=contatos_ia', { replace: true });
  }, [navigate]);

  return null;
}
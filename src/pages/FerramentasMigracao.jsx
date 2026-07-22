import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

// Página migrada: Ferramentas de Migração agora vive como aba dentro da Biblioteca de Automações
export default function FerramentasMigracao() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate(createPageUrl('Automacoes') + '?tab=migracao', { replace: true });
  }, [navigate]);

  return null;
}
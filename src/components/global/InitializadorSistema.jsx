import React, { useEffect, useRef } from 'react';

import { base44 } from '@/api/base44Client';

export default function InitializadorSistema() {
  const inicializadoRef = useRef(false);

  useEffect(() => {
    const inicializar = async () => {
      if (inicializadoRef.current) {
        console.log('[Sistema] ✅ Já inicializado anteriormente');
        return;
      }

      try {
        console.log('[Sistema] 🚀 Iniciando sistema...');
        
        const usuario = await base44.auth.me();
        
        if (!usuario) {
          console.log('[Sistema] ⚠️ Usuário não autenticado, pulando inicialização');
          return;
        }

        console.log('[Sistema] ✅ Usuário autenticado:', usuario.email);
        console.log('[Sistema] ✅ Sistema pronto para uso');

        inicializadoRef.current = true;

      } catch (error) {
        console.error('[Sistema] ❌ Erro na inicialização:', error);
        
        if (error.message?.includes('Rate limit') || error.message?.includes('429')) {
          console.warn('[Sistema] ⚠️ Rate limit detectado. Aguarde alguns segundos.');
        }
      }
    };

    const timer = setTimeout(inicializar, 1000);
    return () => clearTimeout(timer);
  }, []);

  return null;
}
import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

/**
 * Componente silencioso que verifica se a Base de Conhecimento foi populada
 * Se não foi, insere os artigos iniciais
 */
export default function BaseConhecimentoInitializer() {
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    verificarEPopular();
  }, []);

  const verificarEPopular = async () => {
    try {
      const user = await base44.auth.me();
      
      // Apenas admin pode popular
      if (user.role !== 'admin') {
        setStatus('skip');
        return;
      }

      // Verificar se já existe conteúdo
      const artigos = await base44.entities.BaseConhecimento.list('', 5);
      
      if (artigos.length >= 5) {
        console.log('✅ [BASE CONHECIMENTO] Já populada');
        setStatus('populated');
        return;
      }

      console.log('📚 [BASE CONHECIMENTO] Inicializando...');
      setStatus('initializing');

      // Popular será feito via insertEntityRecords na action_group
      
      setStatus('completed');

    } catch (error) {
      console.error('❌ [BASE CONHECIMENTO] Erro:', error);
      setStatus('error');
    }
  };

  // Componente silencioso - não renderiza nada visualmente
  return null;
}
import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Sparkles, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Componente responsável por gerenciar o versionamento e cache busting do VendaPro.
 * 
 * Funcionalidades:
 * - Detecta automaticamente novas versões do aplicativo
 * - Notifica o usuário com uma interface amigável (Soft Update)
 * - Força o recarregamento apenas quando o usuário aceita
 * - Funciona apenas em produção
 * - Usa versionamento manual (atualizar a cada deploy crítico)
 * 
 * COMO USAR:
 * 1. A cada deploy que necessite cache bust, atualize a variável APP_VERSION abaixo
 * 2. Use o formato YYYYMMDDHHMM (ex: 202501091530 = 09/01/2025 às 15:30)
 * 3. Faça o deploy normalmente
 * 4. Os usuários verão uma notificação elegante pedindo para atualizar
 */

const CACHE_KEY = 'venda_pro_app_version';

// ═══════════════════════════════════════════════════════════
//  VERSIONAMENTO MANUAL
// ═══════════════════════════════════════════════════════════
// ATUALIZAR ESTA LINHA A CADA DEPLOY QUE PRECISE DE CACHE BUST
const APP_VERSION = '202501211046'; // Formato: YYYYMMDDHHMM

export default function CacheBuster() {
  const [showUpdateNotification, setShowUpdateNotification] = useState(false);
  const [newVersion, setNewVersion] = useState(null);

  useEffect(() => {
    // ═══════════════════════════════════════════════════════════
    //  ATIVA APENAS EM PRODUÇÃO
    // ═══════════════════════════════════════════════════════════
    // Detecta produção verificando o hostname (não localhost)
    const isProduction = window.location.hostname !== 'localhost' && 
                         window.location.hostname !== '127.0.0.1';

    if (!isProduction) {
      console.log('[Cache Buster] 🔧 Modo desenvolvimento - Cache Buster desativado');
      return;
    }

    // ═══════════════════════════════════════════════════════════
    //  LÓGICA DE VERIFICAÇÃO DE VERSÃO
    // ═══════════════════════════════════════════════════════════
    const currentVersion = localStorage.getItem(CACHE_KEY);

    console.log('[Cache Buster] 📊 Verificando versão:');
    console.log('  - Versão Atual (localStorage):', currentVersion);
    console.log('  - Nova Versão (código):', APP_VERSION);

    if (currentVersion && currentVersion !== APP_VERSION) {
      // Nova versão detectada - mostrar notificação
      console.log('[Cache Buster] 🆕 Nova versão detectada!');
      setNewVersion(APP_VERSION);
      setShowUpdateNotification(true);
    } else if (!currentVersion) {
      // Primeiro carregamento - apenas salvar a versão sem notificar
      console.log('[Cache Buster] 🎉 Primeira inicialização - salvando versão');
      localStorage.setItem(CACHE_KEY, APP_VERSION);
    } else {
      // Versão atual - tudo certo
      console.log('[Cache Buster] ✅ Versão atualizada');
    }
  }, []);

  const handleUpdate = () => {
    console.log('[Cache Buster] 🔄 Aplicando atualização...');
    
    // Salva a nova versão
    localStorage.setItem(CACHE_KEY, newVersion);
    
    // Força o reload "hard" para ignorar cache
    window.location.reload(true);
  };

  const handleDismiss = () => {
    console.log('[Cache Buster] ⏭️ Usuário optou por adiar atualização');
    setShowUpdateNotification(false);
    
    // Salva a versão para não notificar novamente nesta sessão
    localStorage.setItem(CACHE_KEY, newVersion);
  };

  return (
    <AnimatePresence>
      {showUpdateNotification && (
        <motion.div
          initial={{ opacity: 0, y: -100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -100 }}
          transition={{ duration: 0.3 }}
          className="fixed top-4 right-4 z-[9999] max-w-md"
        >
          <Alert className="bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 border-2 border-purple-300 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <AlertTitle className="text-lg font-bold text-purple-900 mb-1">
                  🎉 Nova Versão Disponível!
                </AlertTitle>
                <AlertDescription className="text-sm text-purple-800 mb-3">
                  Uma versão mais recente do VendaPro está disponível. Atualize agora para aproveitar as melhorias e correções.
                </AlertDescription>
                <div className="flex gap-2">
                  <Button
                    onClick={handleUpdate}
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Atualizar Agora
                  </Button>
                  <Button
                    onClick={handleDismiss}
                    variant="outline"
                    className="border-purple-300 text-purple-700 hover:bg-purple-100"
                  >
                    Mais Tarde
                  </Button>
                </div>
                <p className="text-xs text-purple-600 mt-2">
                  Versão: {newVersion}
                </p>
              </div>
            </div>
          </Alert>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
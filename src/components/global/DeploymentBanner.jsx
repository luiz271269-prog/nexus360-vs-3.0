import { useState, useEffect } from 'react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Banner para comunicar status de deploy, manutenção ou avisos importantes.
 * Integra com o sistema de Cache Buster para uma experiência coesa.
 */

export default function DeploymentBanner() {
  const [bannerConfig, setBannerConfig] = useState(null);

  useEffect(() => {
    // ═══════════════════════════════════════════════════════════
    //  CONFIGURAÇÃO DO BANNER
    // ═══════════════════════════════════════════════════════════
    // Você pode controlar isso via:
    // 1. Variável de ambiente (process.env.REACT_APP_BANNER_MESSAGE)
    // 2. Entidade no banco (BannerConfig)
    // 3. Hardcoded temporário (como abaixo)
    
    const config = {
      show: false, // Alterar para true quando houver aviso
      type: 'info', // 'info', 'warning', 'success'
      message: 'Sistema funcionando normalmente',
      // message: '🚀 Nova versão implantada com sucesso! Recarregue a página se necessário.',
    };

    if (config.show) {
      setBannerConfig(config);
    }
  }, []);

  if (!bannerConfig) return null;

  const getIcon = () => {
    switch(bannerConfig.type) {
      case 'warning':
        return <AlertTriangle className="w-5 h-5" />;
      case 'success':
        return <CheckCircle className="w-5 h-5" />;
      default:
        return <Info className="w-5 h-5" />;
    }
  };

  const getStyles = () => {
    switch(bannerConfig.type) {
      case 'warning':
        return 'bg-yellow-50 border-yellow-300 text-yellow-900';
      case 'success':
        return 'bg-green-50 border-green-300 text-green-900';
      default:
        return 'bg-blue-50 border-blue-300 text-blue-900';
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -50 }}
        className="fixed top-0 left-0 right-0 z-[9998]"
      >
        <Alert className={`rounded-none border-b-2 ${getStyles()}`}>
          <div className="flex items-center justify-center gap-2">
            {getIcon()}
            <AlertDescription className="font-medium">
              {bannerConfig.message}
            </AlertDescription>
          </div>
        </Alert>
      </motion.div>
    </AnimatePresence>
  );
}
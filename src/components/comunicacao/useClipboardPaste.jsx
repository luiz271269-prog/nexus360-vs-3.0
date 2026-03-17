import { useEffect } from 'react';

/**
 * Hook que adiciona listener de 'paste' no documento e detecta imagens no clipboard.
 * @param {function} onImageDetected - Callback chamado com (file: File) quando imagem é colada
 */
export function useClipboardPaste(onImageDetected) {
  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            onImageDetected(file);
          }
          break;
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [onImageDetected]);
}
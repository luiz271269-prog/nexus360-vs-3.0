// Utilitários de figurinhas (WhatsApp): conversão para .webp 512x512 e limites

export const LIMITE_PESSOAL = 60;
export const LIMITE_EQUIPE = 80;
export const LIMITE_KB = 300;
export const MAX_RECENTES = 8;
const RECENTES_KEY = 'nexus360:stickersRecentes';

// Converte qualquer imagem em .webp 512x512 (fundo transparente, sem cortar)
export async function imagemParaStickerWebp(file) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const escala = Math.min(512 / bitmap.width, 512 / bitmap.height);
  const w = bitmap.width * escala;
  const h = bitmap.height * escala;
  ctx.drawImage(bitmap, (512 - w) / 2, (512 - h) / 2, w, h);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85));
  if (!blob) throw new Error('Falha ao converter a imagem');
  if (blob.size > LIMITE_KB * 1024) {
    throw new Error(`Figurinha ficou com ${(blob.size / 1024).toFixed(0)} KB (limite ${LIMITE_KB} KB)`);
  }
  return new File([blob], `sticker-${Date.now()}.webp`, { type: 'image/webp' });
}

// Baixa a figurinha salva e devolve como File para o fluxo de envio de mídia
export async function urlParaStickerFile(url) {
  const resp = await fetch(url);
  const blob = await resp.blob();
  return new File([blob], `sticker-${Date.now()}.webp`, { type: 'image/webp' });
}

export function lerRecentes() {
  try {
    return JSON.parse(localStorage.getItem(RECENTES_KEY) || '[]');
  } catch {
    return [];
  }
}

export function registrarRecente(sticker) {
  const atual = lerRecentes().filter((s) => s.id !== sticker.id);
  const novo = [{ id: sticker.id, file_url: sticker.file_url }, ...atual].slice(0, MAX_RECENTES);
  localStorage.setItem(RECENTES_KEY, JSON.stringify(novo));
}
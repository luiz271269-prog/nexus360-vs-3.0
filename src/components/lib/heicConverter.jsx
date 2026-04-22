/**
 * Detecta se o arquivo é HEIC/HEIF (formato Apple/Samsung).
 * Checa MIME type e extensão do nome.
 */
export function isHeic(file) {
  if (!file) return false;
  const mime = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  return (
    mime === 'image/heic' ||
    mime === 'image/heif' ||
    mime === 'image/heic-sequence' ||
    mime === 'image/heif-sequence' ||
    name.endsWith('.heic') ||
    name.endsWith('.heif')
  );
}

/**
 * Converte um File HEIC/HEIF em JPEG.
 * Se não for HEIC, retorna o arquivo original inalterado.
 * Retorna sempre um File com nome/ext .jpg quando convertido.
 */
export async function ensureJpegIfHeic(file) {
  if (!file || !isHeic(file)) return file;

  try {
    // Lazy import: carrega heic2any só quando realmente precisa (arquivo HEIC)
    // Evita entrar no bundle principal e conflitar com outras libs.
    const mod = await import('heic2any');
    const heic2any = mod.default || mod;
    const blob = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.85
    });
    // heic2any pode retornar Blob ou Blob[]
    const jpegBlob = Array.isArray(blob) ? blob[0] : blob;
    const baseName = (file.name || 'foto').replace(/\.(heic|heif)$/i, '');
    return new File([jpegBlob], `${baseName}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now()
    });
  } catch (e) {
    console.warn('[heicConverter] Falha ao converter HEIC, enviando original:', e?.message);
    return file;
  }
}
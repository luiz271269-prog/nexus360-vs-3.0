import * as lamejs from '@breezystack/lamejs';

/**
 * W-API só aceita áudio em .mp3 ou .ogg (por URL).
 * Celulares Samsung/iPhone gravam em audio/mp4 (.m4a) ou webm — que são rejeitados.
 * Esta função converte qualquer áudio gravado para MP3 no navegador
 * (decodifica via Web Audio API + codifica via lamejs).
 * Se o áudio já for ogg/mp3, retorna o blob original sem tocar nele.
 */
export async function converterAudioParaMp3SeNecessario(blob) {
  const tipo = (blob.type || '').toLowerCase();
  if (tipo.includes('ogg') || tipo.includes('mpeg') || tipo.includes('mp3')) {
    return blob;
  }

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    const audioBuffer = await ctx.decodeAudioData(await blob.arrayBuffer());
    const canais = audioBuffer.numberOfChannels;
    const len = audioBuffer.length;

    // Mixdown para mono
    const mono = new Float32Array(len);
    for (let c = 0; c < canais; c++) {
      const dados = audioBuffer.getChannelData(c);
      for (let i = 0; i < len; i++) mono[i] += dados[i] / canais;
    }

    // Float32 → Int16 PCM
    const samples = new Int16Array(len);
    for (let i = 0; i < len; i++) {
      const s = Math.max(-1, Math.min(1, mono[i]));
      samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    // Codificar MP3 mono 64kbps (suficiente para voz)
    const encoder = new lamejs.Mp3Encoder(1, audioBuffer.sampleRate, 64);
    const blocos = [];
    const PASSO = 1152;
    for (let i = 0; i < samples.length; i += PASSO) {
      const chunk = samples.subarray(i, i + PASSO);
      const encoded = encoder.encodeBuffer(chunk);
      if (encoded.length > 0) blocos.push(encoded);
    }
    const fim = encoder.flush();
    if (fim.length > 0) blocos.push(fim);

    return new Blob(blocos, { type: 'audio/mpeg' });
  } finally {
    ctx.close().catch(() => {});
  }
}
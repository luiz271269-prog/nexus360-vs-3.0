// ============================================================================
// FONTE ÚNICA DE HORÁRIO COMERCIAL — Nexus360
// ============================================================================
// Esta é a ÚNICA função que decide se um instante está DENTRO ou FORA do
// expediente. Toda a base (horários, almoço, fim de semana, feriados) vem do
// banco via BroadcastConfig (nome_config='default', ativo=true).
//
// REGRA: nenhuma camada/skill pode recalcular horário por conta própria.
// Camada 4 e Camada 6 do skillPreAtendimentos consomem ESTE módulo — antes
// a Camada 4 usava um cálculo inline (só hora) que ignorava fim de semana e
// feriado, divergindo da Camada 6 e mandando o menu de Setores fora de horário.
//
// Timezone fixo: America/Sao_Paulo (BRT, UTC-3, sem horário de verão).
// ============================================================================

// Feriados nacionais — 100% dinâmicos via BroadcastConfig (NADA hardcoded).
// feriados_nacionais_fixos: array de "MM-DD" (repetem todo ano)
// feriados_extras: array de "YYYY-MM-DD" ou "MM-DD" (datas específicas)
export function ehFeriadoNacional(date, feriadosExtras = [], feriadosFixos = []) {
  const brt = new Date(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const mm = String(brt.getMonth() + 1).padStart(2, '0');
  const dd = String(brt.getDate()).padStart(2, '0');
  const yyyy = brt.getFullYear();
  const isoCompleto = `${yyyy}-${mm}-${dd}`;
  const mmdd = `${mm}-${dd}`;
  if (Array.isArray(feriadosFixos) && feriadosFixos.includes(mmdd)) return true;
  if (Array.isArray(feriadosExtras) && (feriadosExtras.includes(isoCompleto) || feriadosExtras.includes(mmdd))) return true;
  return false;
}

// Avaliação completa do expediente. Retorna { dentro: boolean, motivo: string }.
// motivo: 'horario_comercial' | 'feriado' | 'fim_de_semana' | 'almoco' | 'noite'
// cfg deve conter: manha_inicio, almoco_inicio, almoco_fim, tarde_fim,
// feriados_extras, feriados_nacionais_fixos, enviar_fim_semana.
export function avaliarHorarioComercial(date = new Date(), cfg) {
  if (!cfg) throw new Error('avaliarHorarioComercial requer cfg do BroadcastConfig');
  if (ehFeriadoNacional(date, cfg.feriados_extras, cfg.feriados_nacionais_fixos)) {
    return { dentro: false, motivo: 'feriado' };
  }
  const brt = new Date(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const dow = brt.getDay(); // 0=dom, 6=sab
  if (!cfg.enviar_fim_semana && (dow === 0 || dow === 6)) return { dentro: false, motivo: 'fim_de_semana' };
  const minutosAgora = brt.getHours() * 60 + brt.getMinutes();
  const m = (h) => Math.round(h * 60); // hora decimal -> minutos
  const manha = minutosAgora >= m(cfg.manha_inicio) && minutosAgora < m(cfg.almoco_inicio);
  const tarde = minutosAgora >= m(cfg.almoco_fim) && minutosAgora < m(cfg.tarde_fim);
  if (manha || tarde) return { dentro: true, motivo: 'horario_comercial' };
  if (minutosAgora >= m(cfg.almoco_inicio) && minutosAgora < m(cfg.almoco_fim)) return { dentro: false, motivo: 'almoco' };
  return { dentro: false, motivo: 'noite' };
}
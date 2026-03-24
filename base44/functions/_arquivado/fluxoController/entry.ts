// ARQUIVADO em 2026-03-24 — substituído pelo pipeline Skills
// Conteúdo original: functions/preAtendimento/fluxoController.ts
// Motivo: FluxoController nunca foi chamado por ninguém após migração para Skills.
// Deploy estava quebrado por import './menuBuilder.js' (extensão inválida no Deno).
// Decisão arquitetural: manter pipeline Skills (ACK → Router → Queue) sem menu interativo.
import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║  SISTEMA DE BACKUP AUTOMÁTICO V2                              ║
 * ║  Backup inteligente com compressão e versionamento            ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

Deno.serve(async (req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { action } = payload;

    console.log('[BACKUP] 💾 Action:', action);

    switch (action) {
      case 'create_backup':
        return Response.json(await criarBackup(base44, payload), { headers });
      
      case 'list_backups':
        return Response.json(await listarBackups(base44, payload), { headers });
      
      case 'restore_backup':
        return Response.json(await restaurarBackup(base44, payload), { headers });
      
      case 'delete_backup':
        return Response.json(await deletarBackup(base44, payload), { headers });
      
      default:
        throw new Error(`Ação desconhecida: ${action}`);
    }

  } catch (error) {
    console.error('[BACKUP] ❌ Erro:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500, headers });
  }
});

async function criarBackup(base44, payload) {
  const { 
    tipo_backup = 'manual',
    entidades = ['Contact', 'FlowTemplate', 'FlowExecution', 'BaseConhecimento', 'Tag', 'Cliente', 'Orcamento'],
    notas = ''
  } = payload;

  console.log('[BACKUP] 🎯 Criando backup:', tipo_backup);
  const startTime = Date.now();

  const snapshotData = {};
  let totalRegistros = 0;
  const erros = [];

  // Coletar dados de cada entidade
  for (const entidade of entidades) {
    try {
      console.log(`[BACKUP] 📦 Coletando ${entidade}...`);
      
      const registros = await base44.asServiceRole.entities[entidade].list();
      snapshotData[entidade] = registros;
      totalRegistros += registros.length;

      console.log(`[BACKUP] ✅ ${entidade}: ${registros.length} registros`);
    } catch (error) {
      console.error(`[BACKUP] ❌ Erro ao coletar ${entidade}:`, error);
      erros.push({ entidade, erro: error.message });
    }
  }

  // Calcular hash para integridade
  const jsonString = JSON.stringify(snapshotData);
  const encoder = new TextEncoder();
  const data = encoder.encode(jsonString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // Calcular tamanho
  const tamanhoBytes = new Blob([jsonString]).size;

  // Calcular data de expiração (90 dias)
  const expiraEm = new Date();
  expiraEm.setDate(expiraEm.getDate() + 90);

  // Salvar backup
  const backup = await base44.asServiceRole.entities.BackupSnapshot.create({
    tipo_backup,
    entidades_incluidas: entidades,
    data_backup: new Date().toISOString(),
    snapshot_data: snapshotData,
    total_registros: totalRegistros,
    tamanho_bytes: tamanhoBytes,
    hash_integridade: hashHex,
    status: erros.length === 0 ? 'sucesso' : 'parcial',
    erro_detalhes: erros.length > 0 ? JSON.stringify(erros) : null,
    pode_restaurar: erros.length === 0,
    expira_em: expiraEm.toISOString(),
    criado_por: (await base44.auth.me())?.id || 'sistema',
    notas
  });

  const tempoTotal = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`[BACKUP] ✅ Backup criado: ${backup.id} (${tempoTotal}s)`);

  return {
    success: true,
    backup_id: backup.id,
    total_registros: totalRegistros,
    tamanho_mb: (tamanhoBytes / 1024 / 1024).toFixed(2),
    tempo_execucao_segundos: parseFloat(tempoTotal),
    entidades_incluidas: entidades,
    erros: erros.length > 0 ? erros : null
  };
}

async function listarBackups(base44, payload) {
  const { limit = 20, tipo_backup = null } = payload;

  console.log('[BACKUP] 📋 Listando backups...');

  const filtros = {};
  if (tipo_backup) {
    filtros.tipo_backup = tipo_backup;
  }

  const backups = await base44.asServiceRole.entities.BackupSnapshot.filter(
    filtros,
    '-data_backup',
    limit
  );

  // Remover snapshot_data da listagem (muito grande)
  const backupsResumo = backups.map(b => ({
    id: b.id,
    tipo_backup: b.tipo_backup,
    data_backup: b.data_backup,
    total_registros: b.total_registros,
    tamanho_bytes: b.tamanho_bytes,
    tamanho_mb: (b.tamanho_bytes / 1024 / 1024).toFixed(2),
    status: b.status,
    pode_restaurar: b.pode_restaurar,
    expira_em: b.expira_em,
    entidades_incluidas: b.entidades_incluidas,
    notas: b.notas
  }));

  return {
    success: true,
    backups: backupsResumo,
    total: backups.length
  };
}

async function restaurarBackup(base44, payload) {
  const { backup_id } = payload;

  if (!backup_id) {
    throw new Error('backup_id é obrigatório');
  }

  console.log('[BACKUP] 🔄 Restaurando backup:', backup_id);

  const backup = await base44.asServiceRole.entities.BackupSnapshot.get(backup_id);

  if (!backup.pode_restaurar) {
    throw new Error('Este backup não pode ser restaurado (status: ' + backup.status + ')');
  }

  const startTime = Date.now();
  const resultados = [];

  // Restaurar cada entidade
  for (const [entidade, registros] of Object.entries(backup.snapshot_data)) {
    try {
      console.log(`[BACKUP] 📥 Restaurando ${entidade}...`);
      
      // ATENÇÃO: Isso vai criar registros duplicados se já existirem
      // Em produção, considere adicionar lógica de merge/upsert
      
      for (const registro of registros) {
        // Remover id e timestamps para criar novo
        const { id, created_date, updated_date, ...dadosLimpos } = registro;
        
        await base44.asServiceRole.entities[entidade].create(dadosLimpos);
      }

      resultados.push({
        entidade,
        sucesso: true,
        registros_restaurados: registros.length
      });

      console.log(`[BACKUP] ✅ ${entidade}: ${registros.length} registros restaurados`);
    } catch (error) {
      console.error(`[BACKUP] ❌ Erro ao restaurar ${entidade}:`, error);
      resultados.push({
        entidade,
        sucesso: false,
        erro: error.message
      });
    }
  }

  const tempoTotal = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`[BACKUP] ✅ Restauração concluída em ${tempoTotal}s`);

  return {
    success: true,
    backup_id,
    tempo_execucao_segundos: parseFloat(tempoTotal),
    resultados
  };
}

async function deletarBackup(base44, payload) {
  const { backup_id } = payload;

  if (!backup_id) {
    throw new Error('backup_id é obrigatório');
  }

  console.log('[BACKUP] 🗑️ Deletando backup:', backup_id);

  await base44.asServiceRole.entities.BackupSnapshot.delete(backup_id);

  return {
    success: true,
    message: 'Backup deletado com sucesso'
  };
}
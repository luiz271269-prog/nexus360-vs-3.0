import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const CHAVE_MENU_ORDEM = 'menu_ordem_global';

/**
 * Ordem global dos itens do menu lateral (vale para todos os usuários).
 * A permissão de QUAIS itens aparecem continua 100% com getMenuItemsParaPerfil —
 * este hook apenas reordena o resultado já filtrado.
 */
export function useMenuOrdemGlobal() {
  const [ordem, setOrdem] = useState(null); // array de páginas (strings)
  const [configId, setConfigId] = useState(null);

  useEffect(() => {
    let ativo = true;
    base44.entities.ConfiguracaoSistema.filter({ chave: CHAVE_MENU_ORDEM })
      .then((configs) => {
        if (!ativo) return;
        const cfg = configs?.[0];
        if (cfg) {
          setConfigId(cfg.id);
          setOrdem(Array.isArray(cfg.valor?.ordem) ? cfg.valor.ordem : null);
        }
      })
      .catch((error) => {
        console.warn('[MENU] Não foi possível carregar a ordem global do menu:', error);
      });
    return () => { ativo = false; };
  }, []);

  const salvarOrdem = useCallback(async (novaOrdem) => {
    setOrdem(novaOrdem);
    try {
      if (configId) {
        await base44.entities.ConfiguracaoSistema.update(configId, {
          valor: { ordem: novaOrdem },
          ultima_atualizacao: new Date().toISOString()
        });
      } else {
        const criado = await base44.entities.ConfiguracaoSistema.create({
          chave: CHAVE_MENU_ORDEM,
          categoria: 'geral',
          valor: { ordem: novaOrdem },
          descricao: 'Ordem global dos itens do menu lateral (definida por arrastar-e-soltar)'
        });
        setConfigId(criado.id);
      }
    } catch (error) {
      console.error('[MENU] Erro ao salvar ordem global do menu:', error);
    }
  }, [configId]);

  // Aplica a ordem salva sobre a lista JÁ filtrada por permissões.
  // Itens sem posição salva (novos menus) vão para o final, na ordem original.
  const aplicarOrdem = useCallback((itens) => {
    if (!ordem || ordem.length === 0) return itens;
    const idx = new Map(ordem.map((page, i) => [page, i]));
    return [...itens].sort((a, b) => {
      const ia = idx.has(a.page) ? idx.get(a.page) : 999 + itens.indexOf(a);
      const ib = idx.has(b.page) ? idx.get(b.page) : 999 + itens.indexOf(b);
      return ia - ib;
    });
  }, [ordem]);

  return { aplicarOrdem, salvarOrdem };
}
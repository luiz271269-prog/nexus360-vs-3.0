import { useState, useEffect, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { chavesIdentidade, isMinhaTarefa } from "./tarefaHelpers";

const STATUS_ABERTOS = ["pendente", "em_andamento"];

/**
 * Carrega e opera as tarefas abertas da agenda.
 * Admin enxerga a fila inteira; atendente enxerga apenas as suas
 * (match por full_name, e-mail, prefixo do e-mail ou atendente_user_id).
 */
export default function useTarefasAgenda(usuario) {
  const [tarefas, setTarefas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [ocupadaId, setOcupadaId] = useState(null);

  const chaves = useMemo(() => chavesIdentidade(usuario), [usuario]);

  const carregar = useCallback(async () => {
    if (!usuario) return;
    setCarregando(true);
    try {
      const abertas = await base44.entities.TarefaInteligente.filter(
        { status: { $in: STATUS_ABERTOS } },
        "data_prazo",
        300
      );
      const visiveis = usuario.role === "admin"
        ? abertas
        : abertas.filter(t => isMinhaTarefa(t, chaves, usuario.id));
      setTarefas(visiveis);
    } catch (e) {
      console.error("[AGENDA] erro ao carregar tarefas:", e);
      toast.error("Não foi possível carregar as tarefas");
    } finally {
      setCarregando(false);
    }
  }, [usuario, chaves]);

  useEffect(() => { carregar(); }, [carregar]);

  const aplicar = useCallback(async (tarefa, dados, mensagem) => {
    setOcupadaId(tarefa.id);
    const anterior = tarefas;
    setTarefas(prev => prev.filter(t => t.id !== tarefa.id));
    try {
      await base44.entities.TarefaInteligente.update(tarefa.id, dados);
      toast.success(mensagem);
    } catch (e) {
      console.error("[AGENDA] erro ao atualizar tarefa:", e);
      setTarefas(anterior);
      toast.error("Não foi possível atualizar a tarefa");
    } finally {
      setOcupadaId(null);
    }
  }, [tarefas]);

  const concluir = useCallback((tarefa) => aplicar(tarefa, {
    status: "concluida",
    resultado_execucao: { sucesso: true, resultado: "conversao", data_execucao: new Date().toISOString() }
  }, "Tarefa concluída"), [aplicar]);

  const cancelar = useCallback((tarefa) => aplicar(tarefa, {
    status: "cancelada"
  }, "Tarefa cancelada"), [aplicar]);

  const adiar = useCallback((tarefa, dias) => {
    const base = tarefa.data_prazo && new Date(tarefa.data_prazo) > new Date()
      ? new Date(tarefa.data_prazo)
      : new Date();
    base.setDate(base.getDate() + dias);
    return aplicar(tarefa, { status: "adiada", data_prazo: base.toISOString() }, `Adiada para ${base.toLocaleDateString("pt-BR")}`);
  }, [aplicar]);

  return { tarefas, carregando, ocupadaId, recarregar: carregar, concluir, cancelar, adiar };
}
// components/usuarios/GerenciadorUsuariosUnificado.jsx
import React, { useMemo, useState, useEffect } from "react";
import { PAGINAS_E_ACOES_DO_SISTEMA, PERFIS_ACESSO_RAPIDO } from "@/utils/acessoConfig";
import UsuarioForm from "./UsuarioForm";

// Se você estiver usando shadcn/ui, adapte estes imports para os componentes reais.
// Aqui vou usar HTML básico + Tailwind para manter genérico.

function filtrarUsuarios(usuarios, termo) {
  if (!termo) return usuarios;
  const t = termo.toLowerCase();
  return usuarios.filter(
    (u) =>
      (u.nome && u.nome.toLowerCase().includes(t)) ||
      (u.email && u.email.toLowerCase().includes(t))
  );
}

function coletarPermissoesRecurso(recurso) {
  const itens = [];

  // o próprio menu/subtela pode ser permissionável
  if (recurso.identificador && recurso.tipo) {
    itens.push({
      identificador: recurso.identificador,
      nome: recurso.nome,
      tipo: recurso.tipo,
      description: recurso.description || "",
    });
  }

  // subtelas
  if (recurso.sub_recursos && recurso.sub_recursos.length) {
    recurso.sub_recursos.forEach((sub) => {
      itens.push({
        identificador: sub.identificador,
        nome: sub.nome,
        tipo: sub.tipo,
        description: sub.description || "",
      });

      // ações da subtela
      if (sub.permissoes_funcao && sub.permissoes_funcao.length) {
        sub.permissoes_funcao.forEach((acao) => {
          itens.push({
            identificador: acao.identificador,
            nome: `↳ ${acao.nome}`,
            tipo: acao.tipo,
            description: acao.description || "",
          });
        });
      }
    });
  }

  // ações diretas do menu (sem subtela)
  if (recurso.permissoes_funcao && recurso.permissoes_funcao.length) {
    recurso.permissoes_funcao.forEach((acao) => {
      itens.push({
        identificador: acao.identificador,
        nome: `↳ ${acao.nome}`,
        tipo: acao.tipo,
        description: acao.description || "",
      });
    });
  }

  return itens;
}

export default function GerenciadorUsuariosUnificado({
  // Opcional: você pode passar estes via props,
  // ou substituir internamente por hooks de backend/Base44.
  usuariosIniciais = [],
  carregarUsuarios,      // async () => lista
  salvarUsuario,         // async (usuario) => usuarioAtualizado
  salvarPermissoes,      // async (usuarioId, listaDePermissoes) => void
}) {
  const [usuarios, setUsuarios] = useState(usuariosIniciais);
  const [filtroUsuarios, setFiltroUsuarios] = useState("");
  const [usuarioSelecionado, setUsuarioSelecionado] = useState(null);

  const [recursoSelecionadoId, setRecursoSelecionadoId] = useState(null);
  const [perfilSelecionado, setPerfilSelecionado] = useState(null);

  const [permissoesUsuario, setPermissoesUsuario] = useState([]); // array de identificadores
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Carregar usuários ao montar, se função fornecida
  useEffect(() => {
    if (!carregarUsuarios) return;

    let ativo = true;
    (async () => {
      try {
        setCarregando(true);
        const lista = await carregarUsuarios();
        if (!ativo) return;
        setUsuarios(lista || []);
      } catch (err) {
        console.error("Erro ao carregar usuários:", err);
      } finally {
        if (ativo) setCarregando(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, [carregarUsuarios]);

  // Quando selecionar usuário, carregar permissões (a partir do próprio user ou de uma fonte externa)
  useEffect(() => {
    if (!usuarioSelecionado) {
      setPermissoesUsuario([]);
      setPerfilSelecionado(null);
      return;
    }

    // Aqui assumo que o usuário tem um campo permissoes (array de strings).
    // Adapte para o seu modelo real.
    setPermissoesUsuario(usuarioSelecionado.permissoes || []);
    setPerfilSelecionado(usuarioSelecionado.perfilAcesso || null);
  }, [usuarioSelecionado]);

  const usuariosFiltrados = useMemo(
    () => filtrarUsuarios(usuarios, filtroUsuarios),
    [usuarios, filtroUsuarios]
  );

  const recursoSelecionado = useMemo(() => {
    if (!recursoSelecionadoId) return null;

    // procure em menus
    for (const menu of PAGINAS_E_ACOES_DO_SISTEMA) {
      if (menu.identificador === recursoSelecionadoId) return menu;
      if (menu.sub_recursos) {
        for (const sub of menu.sub_recursos) {
          if (sub.identificador === recursoSelecionadoId) return sub;
        }
      }
      if (menu.permissoes_funcao) {
        for (const acao of menu.permissoes_funcao) {
          if (acao.identificador === recursoSelecionadoId) return acao;
        }
      }
    }
    return null;
  }, [recursoSelecionadoId]);

  const permissoesDoRecurso = useMemo(() => {
    if (!recursoSelecionado) return [];
    // Se for menu completo, queremos todo o "galho" dele
    if (recursoSelecionado.tipo === "menu") {
      return coletarPermissoesRecurso(recursoSelecionado);
    }
    // Se for subtela / ação individual
    if (recursoSelecionado.identificador) {
      return [
        {
          identificador: recursoSelecionado.identificador,
          nome: recursoSelecionado.nome,
          tipo: recursoSelecionado.tipo,
          description: recursoSelecionado.description || "",
        },
      ];
    }
    return [];
  }, [recursoSelecionado]);

  function togglePermissao(identificador) {
    setPermissoesUsuario((prev) =>
      prev.includes(identificador)
        ? prev.filter((p) => p !== identificador)
        : [...prev, identificador]
    );
  }

  function isMarcado(identificador) {
    return permissoesUsuario.includes(identificador);
  }

  async function handleSalvarTudo() {
    if (!usuarioSelecionado) return;
    try {
      setSalvando(true);

      const payloadUsuario = {
        ...usuarioSelecionado,
        permissoes: permissoesUsuario,
        perfilAcesso: perfilSelecionado,
      };

      // TODO: integrar com seu backend/Base44
      if (salvarUsuario) {
        const atualizado = await salvarUsuario(payloadUsuario);
        // atualiza lista local
        setUsuarios((prev) =>
          prev.map((u) => (u.id === atualizado.id ? atualizado : u))
        );
        setUsuarioSelecionado(atualizado);
      }

      if (salvarPermissoes) {
        await salvarPermissoes(usuarioSelecionado.id, permissoesUsuario);
      }

      console.log("Permissões salvas:", permissoesUsuario);
    } catch (err) {
      console.error("Erro ao salvar usuário/permissões:", err);
    } finally {
      setSalvando(false);
    }
  }

  function aplicarPerfil(perfilKey) {
    setPerfilSelecionado(perfilKey);
    const perfil = PERFIS_ACESSO_RAPIDO[perfilKey];
    if (!perfil) return;

    // Para administradores, perfil.permissoes já é a lista completa de identificadores
    setPermissoesUsuario(perfil.permissoes || []);
  }

  function handleNovoUsuario() {
    const novo = {
      id: `temp-${Date.now()}`,
      nome: "",
      email: "",
      setor: "",
      funcao: "",
      ativo: true,
      tipoAcesso: "user",
      permissoes: [],
      perfilAcesso: "personalizado",
      isNovo: true,
    };
    setUsuarios((prev) => [novo, ...prev]);
    setUsuarioSelecionado(novo);
    setPermissoesUsuario([]);
    setPerfilSelecionado("personalizado");
  }

  function handleChangeUsuario(camposAtualizados) {
    if (!usuarioSelecionado) return;
    const atualizado = { ...usuarioSelecionado, ...camposAtualizados };
    setUsuarioSelecionado(atualizado);
    setUsuarios((prev) =>
      prev.map((u) => (u.id === atualizado.id ? atualizado : u))
    );
  }

  return (
    <div className="flex h-[calc(100vh-120px)] gap-3">
      {/* COLUNA 1 - USUÁRIOS */}
      <section className="w-1/4 flex flex-col border rounded-xl bg-white/80 shadow-sm overflow-hidden">
        <header className="p-3 border-b flex items-center gap-2">
          <div className="flex-1">
            <h2 className="text-sm font-semibold">Usuários</h2>
            <p className="text-xs text-gray-500">
              Selecione um usuário para configurar permissões.
            </p>
          </div>
          <button
            onClick={handleNovoUsuario}
            className="text-xs px-2 py-1 rounded-md border hover:bg-gray-50"
          >
            + Novo
          </button>
        </header>

        <div className="p-2 border-b">
          <input
            type="text"
            placeholder="Buscar por nome ou e-mail..."
            className="w-full text-xs px-2 py-1 border rounded-md outline-none"
            value={filtroUsuarios}
            onChange={(e) => setFiltroUsuarios(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-auto text-sm">
          {carregando && (
            <div className="p-3 text-xs text-gray-500">Carregando usuários...</div>
          )}
          {!carregando && usuariosFiltrados.length === 0 && (
            <div className="p-3 text-xs text-gray-500">
              Nenhum usuário encontrado.
            </div>
          )}
          <ul>
            {usuariosFiltrados.map((u) => (
              <li
                key={u.id}
                onClick={() => setUsuarioSelecionado(u)}
                className={`px-3 py-2 cursor-pointer border-b text-xs ${
                  usuarioSelecionado?.id === u.id
                    ? "bg-indigo-50 border-indigo-200 font-semibold"
                    : "hover:bg-gray-50"
                }`}
              >
                <div className="flex justify-between items-center">
                  <span>{u.nome || "(sem nome)"}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full ${
                      u.ativo ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}
                  >
                    {u.ativo ? "Ativo" : "Inativo"}
                  </span>
                </div>
                <div className="text-[10px] text-gray-500 truncate">{u.email}</div>
                {u.setor && u.funcao && (
                  <div className="text-[10px] text-gray-500">
                    {u.setor} • {u.funcao}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* COLUNA 2 - RECURSOS / MENUS / AÇÕES */}
      <section className="w-1/3 flex flex-col border rounded-xl bg-white/80 shadow-sm overflow-hidden">
        <header className="p-3 border-b">
          <h2 className="text-sm font-semibold">Recursos & Páginas do Sistema</h2>
          <p className="text-xs text-gray-500">
            Selecione um menu ou subtela para ajustar as permissões.
          </p>
        </header>

        <div className="flex-1 overflow-auto text-sm">
          <ul className="p-2 space-y-1">
            {PAGINAS_E_ACOES_DO_SISTEMA.map((menu) => {
              const selecionado = recursoSelecionadoId === menu.identificador;
              return (
                <li key={menu.identificador}>
                  <button
                    onClick={() => setRecursoSelecionadoId(menu.identificador)}
                    className={`w-full text-left px-2 py-1 rounded-md text-xs flex flex-col ${
                      selecionado
                        ? "bg-indigo-50 border border-indigo-200"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <span className="font-semibold">
                      {menu.nome}{" "}
                      <span className="text-[10px] text-gray-400">
                        ({menu.categoria || "Sem categoria"})
                      </span>
                    </span>
                    <span className="text-[10px] text-gray-500">
                      {menu.description}
                    </span>
                  </button>

                  {/* Sub-recursos */}
                  {menu.sub_recursos && menu.sub_recursos.length > 0 && (
                    <ul className="ml-3 mt-1 space-y-0.5">
                      {menu.sub_recursos.map((sub) => {
                        const subSel = recursoSelecionadoId === sub.identificador;
                        return (
                          <li key={sub.identificador}>
                            <button
                              onClick={() =>
                                setRecursoSelecionadoId(sub.identificador)
                              }
                              className={`w-full text-left px-2 py-1 rounded-md text-[11px] flex flex-col ${
                                subSel
                                  ? "bg-indigo-50 border border-indigo-200"
                                  : "hover:bg-gray-50"
                              }`}
                            >
                              <span>{sub.nome}</span>
                              {sub.description && (
                                <span className="text-[10px] text-gray-500">
                                  {sub.description}
                                </span>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {/* Ações diretas do menu */}
                  {menu.permissoes_funcao && menu.permissoes_funcao.length > 0 && (
                    <ul className="ml-3 mt-1 space-y-0.5">
                      {menu.permissoes_funcao.map((acao) => {
                        const acaoSel = recursoSelecionadoId === acao.identificador;
                        return (
                          <li key={acao.identificador}>
                            <button
                              onClick={() =>
                                setRecursoSelecionadoId(acao.identificador)
                              }
                              className={`w-full text-left px-2 py-1 rounded-md text-[11px] flex flex-col ${
                                acaoSel
                                  ? "bg-indigo-50 border border-indigo-200"
                                  : "hover:bg-gray-50"
                              }`}
                            >
                              <span>↳ {acao.nome}</span>
                              {acao.description && (
                                <span className="text-[10px] text-gray-500">
                                  {acao.description}
                                </span>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* COLUNA 3 - DETALHES DO USUÁRIO + PERMISSÕES */}
      <section className="flex-1 flex flex-col border rounded-xl bg-white/80 shadow-sm overflow-hidden">
        <header className="p-3 border-b flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Detalhes & Permissões</h2>
            <p className="text-xs text-gray-500">
              Edite os dados do usuário e as permissões para o recurso selecionado.
            </p>
          </div>
          <button
            onClick={handleSalvarTudo}
            disabled={!usuarioSelecionado || salvando}
            className={`px-3 py-1.5 text-xs rounded-md ${
              !usuarioSelecionado || salvando
                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                : "bg-indigo-600 text-white hover:bg-indigo-700"
            }`}
          >
            {salvando ? "Salvando..." : "Salvar alterações"}
          </button>
        </header>

        {!usuarioSelecionado ? (
          <div className="flex-1 flex items-center justify-center text-xs text-gray-500">
            Selecione um usuário na coluna da esquerda para começar.
          </div>
        ) : (
          <div className="flex-1 grid grid-rows-[auto,auto,1fr] gap-2 overflow-hidden">
            {/* Dados básicos do usuário */}
            <div className="p-3 border-b overflow-auto">
              <UsuarioForm
                usuario={usuarioSelecionado}
                onChange={handleChangeUsuario}
              />
            </div>

            {/* Perfis de acesso rápido */}
            <div className="px-3 pb-2 border-b">
              <h3 className="text-xs font-semibold mb-2">
                Perfis de acesso rápido
              </h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(PERFIS_ACESSO_RAPIDO).map(([key, perfil]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => aplicarPerfil(key)}
                    className={`text-[11px] px-2 py-1 rounded-full border ${
                      perfilSelecionado === key
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {perfil.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Permissões do recurso selecionado */}
            <div className="p-3 overflow-auto">
              {!recursoSelecionado ? (
                <div className="text-xs text-gray-500">
                  Selecione um menu/subtela na coluna do meio para ver as permissões
                  disponíveis.
                </div>
              ) : (
                <>
                  <div className="mb-3">
                    <h3 className="text-xs font-semibold">
                      Permissões para:{" "}
                      <span className="text-indigo-700">
                        {recursoSelecionado.nome}
                      </span>
                    </h3>
                    {recursoSelecionado.description && (
                      <p className="text-[11px] text-gray-500">
                        {recursoSelecionado.description}
                      </p>
                    )}
                  </div>

                  {permissoesDoRecurso.length === 0 ? (
                    <div className="text-xs text-gray-500">
                      Nenhuma permissão configurável diretamente para este recurso.
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {permissoesDoRecurso.map((perm) => (
                        <label
                          key={perm.identificador}
                          className="flex items-start gap-2 text-xs border rounded-md px-2 py-1 hover:bg-gray-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={isMarcado(perm.identificador)}
                            onChange={() =>
                              togglePermissao(perm.identificador)
                            }
                          />
                          <div>
                            <div className="font-semibold">{perm.nome}</div>
                            {perm.description && (
                              <div className="text-[11px] text-gray-500">
                                {perm.description}
                              </div>
                            )}
                            <div className="text-[10px] text-gray-400 mt-0.5">
                              ID: {perm.identificador} • Tipo: {perm.tipo}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
// components/usuarios/UsuarioForm.jsx
import React from "react";

export default function UsuarioForm({ usuario, onChange }) {
  if (!usuario) return null;

  function handleChange(campo, valor) {
    onChange?.({ [campo]: valor });
  }

  return (
    <form className="grid grid-cols-2 gap-3 text-xs">
      <div className="col-span-2">
        <label className="block text-[11px] font-semibold mb-1">
          Nome completo
        </label>
        <input
          type="text"
          value={usuario.nome || ""}
          onChange={(e) => handleChange("nome", e.target.value)}
          className="w-full px-2 py-1 border rounded-md outline-none"
          placeholder="Nome do usuário"
        />
      </div>

      <div className="col-span-2">
        <label className="block text-[11px] font-semibold mb-1">
          E-mail
        </label>
        <input
          type="email"
          value={usuario.email || ""}
          onChange={(e) => handleChange("email", e.target.value)}
          className="w-full px-2 py-1 border rounded-md outline-none"
          placeholder="email@empresa.com"
        />
      </div>

      <div>
        <label className="block text-[11px] font-semibold mb-1">
          Setor
        </label>
        <input
          type="text"
          value={usuario.setor || ""}
          onChange={(e) => handleChange("setor", e.target.value)}
          className="w-full px-2 py-1 border rounded-md outline-none"
          placeholder="Ex.: Vendas, Suporte"
        />
      </div>

      <div>
        <label className="block text-[11px] font-semibold mb-1">
          Função
        </label>
        <input
          type="text"
          value={usuario.funcao || ""}
          onChange={(e) => handleChange("funcao", e.target.value)}
          className="w-full px-2 py-1 border rounded-md outline-none"
          placeholder="Ex.: Atendente, Gerente"
        />
      </div>

      <div>
        <label className="block text-[11px] font-semibold mb-1">
          Tipo de acesso (Role)
        </label>
        <select
          value={usuario.tipoAcesso || "user"}
          onChange={(e) => handleChange("tipoAcesso", e.target.value)}
          className="w-full px-2 py-1 border rounded-md outline-none"
        >
          <option value="admin">Administrador</option>
          <option value="user">Usuário</option>
          <option value="guest">Convidado</option>
        </select>
      </div>

      <div className="flex items-center gap-2 mt-5">
        <input
          id="usuario-ativo"
          type="checkbox"
          checked={usuario.ativo ?? true}
          onChange={(e) => handleChange("ativo", e.target.checked)}
          className="h-3 w-3"
        />
        <label
          htmlFor="usuario-ativo"
          className="text-[11px] font-semibold select-none"
        >
          Usuário ativo
        </label>
      </div>
    </form>
  );
}
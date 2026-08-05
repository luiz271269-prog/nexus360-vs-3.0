import React from 'react';

export default function AgendaResponsavelAvatar({ usuario, tamanho = 'h-6 w-6' }) {
  if (!usuario) return null;
  const foto = usuario.foto_url || usuario.foto_perfil_url;
  const nome = usuario.full_name || usuario.email || '?';
  return foto ? (
    <img src={foto} alt={nome} title={nome}
      className={`${tamanho} flex-shrink-0 rounded-full object-cover ring-1 ring-slate-200`} />
  ) : (
    <div title={nome} className={`${tamanho} flex flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-[10px] font-bold text-white`}>
      {nome.substring(0, 2).toUpperCase()}
    </div>
  );
}
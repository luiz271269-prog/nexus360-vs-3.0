import React, { useState, useEffect, useRef } from 'react';

/**
 * Carrega um HTML remoto via fetch e injeta no iframe via srcdoc,
 * contornando o Content-Disposition: attachment do servidor.
 */
export default function IframeHtmlLoader({ url, title, height = 'calc(100vh - 200px)' }) {
  const [htmlContent, setHtmlContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!url) return;
    setLoading(true);
    setError(null);
    setHtmlContent(null);

    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then(html => {
        setHtmlContent(html);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [url]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 flex items-center justify-center" style={{ height }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
          <span className="text-slate-500 text-sm">Carregando {title}...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-red-200 flex items-center justify-center" style={{ height }}>
        <div className="text-center">
          <p className="text-red-500 font-medium">Erro ao carregar</p>
          <p className="text-slate-400 text-xs mt-1">{error}</p>
          <button
            onClick={() => { setLoading(true); setError(null); fetch(url).then(r => r.text()).then(h => { setHtmlContent(h); setLoading(false); }).catch(e => { setError(e.message); setLoading(false); }); }}
            className="mt-3 px-4 py-1.5 bg-orange-500 text-white text-xs rounded-lg hover:bg-orange-600"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden" style={{ height }}>
      <iframe
        srcDoc={htmlContent}
        className="w-full h-full border-0"
        title={title}
        sandbox="allow-scripts allow-same-origin allow-forms"
      />
    </div>
  );
}
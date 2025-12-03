import { useState, useEffect, useCallback } from 'react';
import UploadZone from './UploadZone';
import GradeDadosEstruturados from './GradeDadosEstruturados';
import { processarArquivo } from './MotorImportacao';

export default function ModalImportacao({ contexto, onClose, onSuccess }) {
    const [loading, setLoading] = useState(false);
    const [dadosParaRevisao, setDadosParaRevisao] = useState(null);

    const handleFileUpload = useCallback(async (files) => {
        setLoading(true);
        const file = files[0];
        if (!file) {
            setLoading(false);
            return;
        }

        try {
            const resultado = await processarArquivo(file, contexto);

            if (resultado && resultado.dados && resultado.dados.length > 0) {
                setDadosParaRevisao(resultado);
            } else {
                throw new Error("Não foi possível extrair uma tabela de dados do arquivo.");
            }
        } catch (error) {
            console.error("Erro na importação contextual:", error);
            alert(`Erro na importação: ${error.message}`);
            onClose();
        } finally {
            setLoading(false);
        }
    }, [contexto, onClose]);
    
    useEffect(() => {
        const handlePaste = async (event) => {
            if (dadosParaRevisao) return;

            const items = event.clipboardData?.items;
            if (!items) return;

            for (const item of items) {
                if (item.type.indexOf('image') !== -1) {
                    event.preventDefault();
                    const file = item.getAsFile();
                    if (file) {
                        const fileName = `imagem-colada-${Date.now()}.png`;
                        const renamedFile = new File([file], fileName, { type: file.type });
                        await handleFileUpload([renamedFile]);
                    }
                }
            }
        };

        document.addEventListener('paste', handlePaste);
        
        return () => {
            document.removeEventListener('paste', handlePaste);
        };
    }, [dadosParaRevisao, handleFileUpload]);

    const handleSalvar = (dadosProcessados) => {
        // Passar os dados processados para a página que chamou o modal
        // A página Vendas/Orcamentos/etc vai receber e processar
        onSuccess(dadosProcessados);
    };

    return (
        <>
            {!dadosParaRevisao && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
                    <div className="bg-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl p-8" onClick={e => e.stopPropagation()}>
                        <h2 className="text-2xl font-bold text-white mb-2">Importar para <span className="capitalize text-amber-400">{contexto}</span></h2>
                        <p className="text-slate-400 mb-6">Arraste um arquivo, cole um print de tela (Ctrl+V) ou clique para selecionar.</p>
                        <UploadZone onFileSelect={handleFileUpload} loading={loading} />
                    </div>
                </div>
            )}

            {dadosParaRevisao && (
                <GradeDadosEstruturados
                    dadosIniciais={dadosParaRevisao.dados}
                    nomeImportacao={dadosParaRevisao.nomeImportacao}
                    destinoSugerido={dadosParaRevisao.destinoSugerido}
                    tiposDetectados={dadosParaRevisao.tiposDetectados}
                    processamentoId={dadosParaRevisao.processamentoId}
                    estruturaDocumento={dadosParaRevisao.estruturaDocumento}
                    onSalvar={handleSalvar}
                    onCancelar={onClose}
                    loading={loading}
                />
            )}
        </>
    );
}
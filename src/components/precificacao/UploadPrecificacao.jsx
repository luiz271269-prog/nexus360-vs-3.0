import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Upload, Brain, Loader2, File } from 'lucide-react';
import { UploadFile } from "@/integrations/Core";
import { toast } from 'sonner';

export default function UploadPrecificacao({ onProcess, loading }) {
  const [inputText, setInputText] = useState('');
  const [currentFile, setCurrentFile] = useState(null); // Para mostrar a prévia
  const [previewUrl, setPreviewUrl] = useState(null);

  const handleTextImport = () => {
    if (!inputText.trim()) {
      toast.error('Cole os dados comerciais para análise.');
      return;
    }
    onProcess(inputText, 'Dados Comerciais Colados', 'text');
  };

  const handleFileUpload = async (file) => {
    if (!file) return;

    // Mostrar prévia do arquivo
    setCurrentFile({
      name: file.name,
      size: file.size,
      type: file.type
    });

    // Se for imagem, criar preview
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreviewUrl(e.target.result);
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }

    try {
      const { file_url } = await UploadFile({ file });
      onProcess(file_url, file.name, 'file');
    } catch (error) {
      toast.error(`Erro no upload: ${error.message}`);
      setCurrentFile(null);
      setPreviewUrl(null);
    }
  };

  const clearPreview = () => {
    setCurrentFile(null);
    setPreviewUrl(null);
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded p-1" style={{ width: '4cm', height: '2cm' }}>
      <div className="flex items-center gap-1 mb-1">
        <Brain className="w-3 h-3 text-indigo-500" />
        <label className="text-xs font-medium text-slate-600">Análise IA</label>
      </div>
      
      {/* Prévia do Arquivo/Imagem */}
      {currentFile && (
        <div className="mb-1 p-1 bg-white border border-slate-300 rounded">
          <div className="flex items-center gap-1">
            {previewUrl ? (
              <img src={previewUrl} alt="Preview" className="w-6 h-6 object-cover rounded" />
            ) : (
              <File className="w-4 h-4 text-slate-500" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-700 truncate">{currentFile.name}</p>
              <p className="text-xs text-slate-500">{Math.round(currentFile.size/1024)}KB</p>
            </div>
            <Button 
              onClick={clearPreview}
              variant="ghost" 
              size="sm" 
              className="h-4 w-4 p-0 text-slate-400 hover:text-slate-600"
            >
              ×
            </Button>
          </div>
        </div>
      )}
      
      <Textarea
        placeholder="Cole catálogo, preços, listas..."
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        className="h-8 text-xs border-0 bg-transparent p-1 resize-none mb-1"
        style={{ fontSize: '9px', lineHeight: '1.1' }}
      />
      
      <div className="flex gap-1">
        <Button 
          onClick={handleTextImport} 
          disabled={loading || !inputText.trim()}
          size="sm"
          className="flex-1 h-4 text-xs py-0"
        >
          {loading ? <Loader2 className="w-2 h-2 animate-spin" /> : 'Analisar'}
        </Button>
        
        <Button 
          onClick={() => document.getElementById('file-upload-precificacao').click()}
          disabled={loading}
          variant="outline"
          size="sm"
          className="h-4 w-6 p-0"
          title="Upload arquivo"
        >
          <Upload className="w-2 h-2" />
        </Button>
      </div>

      <input
        id="file-upload-precificacao"
        type="file"
        className="hidden"
        onChange={(e) => handleFileUpload(e.target.files[0])}
        accept=".xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg,.txt"
      />
    </div>
  );
}
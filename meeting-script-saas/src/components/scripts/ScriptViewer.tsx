import * as React from 'react';
import { saveScript } from '@/lib/supabase';
const { useState } = React;

interface ScriptViewerProps {
  script: string;
  title: string;
  onBack: () => void;
  userId?: string;
}

const ScriptViewer: React.FC<ScriptViewerProps> = ({ script, title, onBack, userId }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  
  const handleSaveScript = async () => {
    if (!userId) {
      alert('Você precisa estar logado para salvar scripts.');
      return;
    }
    
    setIsSaving(true);
    try {
      await saveScript(userId, title, script);
      alert('Script salvo com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar script:', error);
      alert('Ocorreu um erro ao salvar o script. Por favor, tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(script);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };
  
  const handleDownloadScript = () => {
    setIsDownloading(true);
    try {
      const blob = new Blob([script], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro ao baixar script:', error);
      alert('Ocorreu um erro ao baixar o script. Por favor, tente novamente.');
    } finally {
      setIsDownloading(false);
    }
  };
  
  return (
    <div className="bg-dark-200 p-6 rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-primary">Script Gerado</h2>
        
        <div className="flex space-x-2">
          <button 
            onClick={handleCopyToClipboard}
            className="btn-secondary"
            disabled={isCopied}
          >
            {isCopied ? 'Copiado!' : 'Copiar'}
          </button>
          <button 
            onClick={handleDownloadScript}
            className="btn-secondary"
            disabled={isDownloading}
          >
            {isDownloading ? 'Baixando...' : 'Baixar'}
          </button>
          <button 
            onClick={handleSaveScript}
            className="btn-primary"
            disabled={isSaving}
          >
            {isSaving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
      
      <div className="mb-4">
        <button
          onClick={onBack}
          className="btn-secondary"
        >
          Voltar
        </button>
      </div>
      
      <div className="bg-dark-300 p-4 rounded-md overflow-auto max-h-[60vh]">
        <pre className="whitespace-pre-wrap text-gray-200 font-mono text-sm">
          {script}
        </pre>
      </div>
    </div>
  );
};

export default ScriptViewer;

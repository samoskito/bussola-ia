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
    <div style={{ 
      backgroundColor: '#1E1E1E', 
      padding: '2rem', 
      borderRadius: '1rem', 
      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
      border: '1px solid #333333',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* Efeito de gradiente no topo */}
      <div style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        right: 0, 
        height: '4px', 
        background: 'linear-gradient(90deg, #FF6B00, #FF9D5C)' 
      }}></div>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 107, 0, 0.1)',
            color: '#FF6B00'
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 3H8C9.06087 3 10.0783 3.42143 10.8284 4.17157C11.5786 4.92172 12 5.93913 12 7V21C12 20.2044 11.6839 19.4413 11.1213 18.8787C10.5587 18.3161 9.79565 18 9 18H2V3Z" stroke="#FF6B00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M22 3H16C14.9391 3 13.9217 3.42143 13.1716 4.17157C12.4214 4.92172 12 5.93913 12 7V21C12 20.2044 12.3161 19.4413 12.8787 18.8787C13.4413 18.3161 14.2044 18 15 18H22V3Z" stroke="#FF6B00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#FF6B00' }}>Script Gerado</h2>
        </div>
        
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button 
            onClick={handleCopyToClipboard}
            style={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.05)', 
              color: 'white', 
              border: '1px solid #3F3F46', 
              padding: '0.5rem 1rem', 
              borderRadius: '0.5rem', 
              cursor: isCopied ? 'not-allowed' : 'pointer',
              opacity: isCopied ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease',
            }}
            disabled={isCopied}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 9H11C9.89543 9 9 9.89543 9 11V20C9 21.1046 9.89543 22 11 22H20C21.1046 22 22 21.1046 22 20V11C22 9.89543 21.1046 9 20 9Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M5 15H4C3.46957 15 2.96086 14.7893 2.58579 14.4142C2.21071 14.0391 2 13.5304 2 13V4C2 3.46957 2.21071 2.96086 2.58579 2.58579C2.96086 2.21071 3.46957 2 4 2H13C13.5304 2 14.0391 2.21071 14.4142 2.58579C14.7893 2.96086 15 3.46957 15 4V5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {isCopied ? 'Copiado!' : 'Copiar'}
          </button>
          <button 
            onClick={handleDownloadScript}
            style={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.05)', 
              color: 'white', 
              border: '1px solid #3F3F46', 
              padding: '0.5rem 1rem', 
              borderRadius: '0.5rem', 
              cursor: isDownloading ? 'not-allowed' : 'pointer',
              opacity: isDownloading ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease',
            }}
            disabled={isDownloading}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M7 10L12 15L17 10" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 15V3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {isDownloading ? 'Baixando...' : 'Baixar'}
          </button>
          <button 
            onClick={handleSaveScript}
            style={{ 
              backgroundColor: '#FF6B00', 
              color: 'white', 
              border: 'none', 
              padding: '0.5rem 1rem', 
              borderRadius: '0.5rem', 
              fontWeight: '600',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              opacity: isSaving ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 6px -1px rgba(255, 107, 0, 0.2), 0 2px 4px -1px rgba(255, 107, 0, 0.1)',
            }}
            disabled={isSaving}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H16L21 8V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M17 21V13H7V21" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M7 3V8H15" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {isSaving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
      
      <div style={{ marginBottom: '1rem' }}>
        <button 
          onClick={onBack}
          style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.05)', 
            color: 'white', 
            border: '1px solid #3F3F46', 
            padding: '0.5rem 1rem', 
            borderRadius: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.2s ease'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 12H5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 19L5 12L12 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Voltar
        </button>
      </div>
      
      <div style={{ 
        backgroundColor: '#141414', 
        padding: '1.5rem', 
        borderRadius: '0.75rem', 
        marginTop: '1.5rem', 
        whiteSpace: 'pre-wrap',
        border: '1px solid #2A2A2A',
        boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.3)',
        position: 'relative',
        lineHeight: '1.6',
        fontSize: '0.95rem',
        color: '#E0E0E0',
        maxHeight: '60vh',
        overflowY: 'auto',
        scrollbarWidth: 'thin',
        scrollbarColor: '#FF6B00 #1A1A1A'
      }}>
        {/* Decoração de linhas de código */}
        <div style={{ 
          position: 'absolute', 
          top: '1.5rem', 
          left: '0.5rem', 
          bottom: '1.5rem', 
          width: '2px', 
          background: 'linear-gradient(to bottom, rgba(255, 107, 0, 0.5), rgba(255, 107, 0, 0))',
          borderRadius: '1px'
        }}></div>
        <div style={{ paddingLeft: '1rem' }}>
          {script}
        </div>
      </div>
    </div>
  );
};

export default ScriptViewer;

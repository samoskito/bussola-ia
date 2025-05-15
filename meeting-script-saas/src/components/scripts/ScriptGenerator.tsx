import * as React from 'react';
import { saveScript } from '@/lib/supabase';
const { useState } = React;

interface ScriptGeneratorProps {
  onScriptGenerated: (script: string, title: string) => void;
  userId?: string;
}

interface MeetingInfo {
  title: string;
  objective: string;
  participants: string;
  duration: string;
  topics: string;
  tone: string;
}

const ScriptGenerator: React.FC<ScriptGeneratorProps> = ({ onScriptGenerated, userId }) => {
  const [formData, setFormData] = useState({
    title: '',
    objective: '',
    participants: '',
    duration: '30',
    topics: '',
    tone: 'Profissional'
  });
  
  const [isGenerating, setIsGenerating] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    
    try {
      // Aqui seria a lógica para gerar o script com base nos dados do formulário
      // Por enquanto, vamos usar um script de exemplo
      const generatedScript = `# Script para Reunião: ${formData.title}

## Objetivo
${formData.objective}

## Participantes
${formData.participants.split(',').map(p => `- ${p.trim()}`).join('\n')}

## Duração
${formData.duration} minutos

## Tópicos
${formData.topics.split('\n').map(t => `- ${t.trim()}`).join('\n')}

## Roteiro

### Introdução (5 minutos)
- Agradecer a presença de todos
- Apresentar o objetivo da reunião
- Apresentar a agenda

### Desenvolvimento (${Number(formData.duration) - 10} minutos)
${formData.topics.split('\n').map(t => `- Discussão: ${t.trim()}`).join('\n')}

### Conclusão (5 minutos)
- Resumir os principais pontos discutidos
- Definir próximos passos e responsáveis
- Agradecer a participação de todos
`;
      
      // Se tivermos um userId, podemos salvar o script no Supabase
      if (userId) {
        await saveScript(userId, formData.title, generatedScript);
      }
      
      onScriptGenerated(generatedScript, formData.title);
    } catch (error) {
      console.error('Erro ao gerar script:', error);
      alert('Ocorreu um erro ao gerar o script. Por favor, tente novamente.');
    } finally {
      setIsGenerating(false);
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
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#FF6B00' }}>Gerar Script de Reunião</h2>
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
            <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke="#FF6B00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label htmlFor="title" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#9CA3AF', marginBottom: '0.25rem' }}>
              Título da Reunião
            </label>
            <input
              id="title"
              name="title"
              type="text"
              value={formData.title}
              onChange={handleChange}
              style={{ width: '100%', padding: '0.75rem', backgroundColor: '#2A2A2A', color: 'white', border: '1px solid #3F3F46', borderRadius: '0.375rem', outline: 'none' }}
              placeholder="Ex: Planejamento Estratégico Q3"
            />
          </div>
          
          <div>
            <label htmlFor="objective" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#9CA3AF', marginBottom: '0.25rem' }}>
              Objetivo da Reunião
            </label>
            <textarea
              id="objective"
              name="objective"
              value={formData.objective}
              onChange={handleChange}
              style={{ width: '100%', height: '6rem', padding: '0.75rem', backgroundColor: '#2A2A2A', color: 'white', border: '1px solid #3F3F46', borderRadius: '0.375rem', outline: 'none', resize: 'vertical' }}
              placeholder="Ex: Definir as metas e estratégias para o próximo trimestre"
            />
          </div>
          
          <div>
            <label htmlFor="participants" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#9CA3AF', marginBottom: '0.25rem' }}>
              Participantes
            </label>
            <textarea
              id="participants"
              name="participants"
              value={formData.participants}
              onChange={handleChange}
              style={{ width: '100%', height: '5rem', padding: '0.75rem', backgroundColor: '#2A2A2A', color: 'white', border: '1px solid #3F3F46', borderRadius: '0.375rem', outline: 'none', resize: 'vertical' }}
              placeholder="Ex: Equipe de Marketing, Gerente de Vendas, CEO"
            />
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label htmlFor="duration" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#9CA3AF', marginBottom: '0.25rem' }}>
                Duração
              </label>
              <select
                id="duration"
                name="duration"
                value={formData.duration}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.75rem', backgroundColor: '#2A2A2A', color: 'white', border: '1px solid #3F3F46', borderRadius: '0.375rem', outline: 'none' }}
              >
                <option value="15">15 minutos</option>
                <option value="30">30 minutos</option>
                <option value="45">45 minutos</option>
                <option value="60">1 hora</option>
                <option value="90">1 hora e 30 minutos</option>
                <option value="120">2 horas</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="tone" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#9CA3AF', marginBottom: '0.25rem' }}>
                Tom da Reunião
              </label>
              <select
                id="tone"
                name="tone"
                value={formData.tone}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.75rem', backgroundColor: '#2A2A2A', color: 'white', border: '1px solid #3F3F46', borderRadius: '0.375rem', outline: 'none' }}
              >
                <option value="Profissional">Profissional</option>
                <option value="Casual">Casual</option>
                <option value="Motivacional">Motivacional</option>
                <option value="Formal">Formal</option>
                <option value="Colaborativo">Colaborativo</option>
              </select>
            </div>
          </div>
          
          <div>
            <label htmlFor="topics" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#9CA3AF', marginBottom: '0.25rem' }}>
              Tópicos a Serem Discutidos
            </label>
            <textarea
              id="topics"
              name="topics"
              value={formData.topics}
              onChange={handleChange}
              style={{ width: '100%', height: '8rem', padding: '0.75rem', backgroundColor: '#2A2A2A', color: 'white', border: '1px solid #3F3F46', borderRadius: '0.375rem', outline: 'none', resize: 'vertical' }}
              placeholder="Ex: Resultados do trimestre anterior&#10;Metas para o próximo trimestre&#10;Desafios e oportunidades"
            />
          </div>
          
          <div style={{ paddingTop: '1.5rem' }}>
            <button
              type="submit"
              style={{ 
                width: '100%', 
                backgroundColor: '#FF6B00', 
                color: 'white', 
                fontWeight: '600', 
                padding: '0.75rem', 
                borderRadius: '0.75rem',
                cursor: isGenerating ? 'not-allowed' : 'pointer', 
                opacity: isGenerating ? 0.7 : 1,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 6px -1px rgba(255, 107, 0, 0.2), 0 2px 4px -1px rgba(255, 107, 0, 0.1)',
                position: 'relative',
                overflow: 'hidden'
              }}
              disabled={isGenerating}
            >
              {!isGenerating && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 16L12 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M9 11L12 8 15 11" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" stroke="white" strokeWidth="2"/>
                </svg>
              )}
              {isGenerating ? (
                <>
                  <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="60" strokeDashoffset="60"/>
                  </svg>
                  Gerando Script...
                </>
              ) : 'Gerar Script'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default ScriptGenerator;

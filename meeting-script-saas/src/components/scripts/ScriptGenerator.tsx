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
    <div className="bg-dark-200 p-6 rounded-lg">
      <h2 className="text-2xl font-bold text-primary mb-6">Gerar Script de Reunião</h2>
      
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-300 mb-1">
              Título da Reunião
            </label>
            <input
              id="title"
              name="title"
              type="text"
              value={formData.title}
              onChange={handleChange}
              className="input-field"
              placeholder="Ex: Planejamento Estratégico Q3"
            />
          </div>
          
          <div>
            <label htmlFor="objective" className="block text-sm font-medium text-gray-300 mb-1">
              Objetivo da Reunião
            </label>
            <textarea
              id="objective"
              name="objective"
              value={formData.objective}
              onChange={handleChange}
              className="input-field h-24"
              placeholder="Ex: Definir as metas e estratégias para o próximo trimestre"
            />
          </div>
          
          <div>
            <label htmlFor="participants" className="block text-sm font-medium text-gray-300 mb-1">
              Participantes
            </label>
            <textarea
              id="participants"
              name="participants"
              value={formData.participants}
              onChange={handleChange}
              className="input-field h-20"
              placeholder="Ex: Equipe de Marketing, Gerente de Vendas, CEO"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="duration" className="block text-sm font-medium text-gray-300 mb-1">
                Duração
              </label>
              <select
                id="duration"
                name="duration"
                value={formData.duration}
                onChange={handleChange}
                className="input-field"
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
              <label htmlFor="tone" className="block text-sm font-medium text-gray-300 mb-1">
                Tom da Reunião
              </label>
              <select
                id="tone"
                name="tone"
                value={formData.tone}
                onChange={handleChange}
                className="input-field"
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
            <label htmlFor="topics" className="block text-sm font-medium text-gray-300 mb-1">
              Tópicos a Serem Discutidos
            </label>
            <textarea
              id="topics"
              name="topics"
              value={formData.topics}
              onChange={handleChange}
              className="input-field h-32"
              placeholder="Ex: Resultados do trimestre anterior&#10;Metas para o próximo trimestre&#10;Desafios e oportunidades"
            />
          </div>
          
          <div className="pt-4">
            <button
              type="submit"
              className="btn-primary w-full"
              disabled={isGenerating}
            >
              {isGenerating ? 'Gerando Script...' : 'Gerar Script'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default ScriptGenerator;

import * as React from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';

// Mock data - would come from database in real app
const mockProjects = [
  { id: '1', name: 'Projeto X' },
  { id: '2', name: 'Projeto Y' },
  { id: '3', name: 'Projeto Z', isActive: true },
  { id: '4', name: 'Projeto W' },
];

const mockChats = Array(10).fill(0).map((_, i) => ({
  id: `chat-${i + 1}`,
  title: 'Lorem ipsum dolor...',
}));

// FAQ items
const faqItems = [
  {
    question: 'Como gerar um script de reunião?',
    answer: 'Para gerar um script de reunião, acesse a página "Scripts" no menu lateral, preencha o formulário com as informações da reunião (título, objetivo, participantes, duração e tópicos) e clique em "Gerar Script". O script será gerado automaticamente e você poderá salvá-lo, copiá-lo ou baixá-lo.'
  },
  {
    question: 'Como salvar um script gerado?',
    answer: 'Após gerar um script, você verá opções para salvá-lo, copiá-lo ou baixá-lo. Clique em "Salvar" para armazenar o script em sua conta. Você poderá acessar todos os seus scripts salvos na página "Scripts Salvos".'
  },
  {
    question: 'Como editar meu perfil?',
    answer: 'Para editar seu perfil, acesse a página "Perfil" no menu lateral. Clique em "Editar Perfil", faça as alterações desejadas e clique em "Salvar".'
  },
  {
    question: 'Como alterar minha senha?',
    answer: 'Para alterar sua senha, acesse a página "Perfil" no menu lateral e clique em "Alterar Senha". Você receberá um email com instruções para criar uma nova senha.'
  },
  {
    question: 'Como criar um novo projeto?',
    answer: 'Para criar um novo projeto, clique no botão "+" ao lado de "Projetos" no menu lateral. Digite o nome do projeto e clique em "Criar".'
  },
  {
    question: 'Como excluir um script salvo?',
    answer: 'Para excluir um script salvo, acesse a página "Scripts Salvos" no menu lateral, localize o script que deseja excluir e clique no botão "Excluir".'
  },
  {
    question: 'Posso personalizar os scripts gerados?',
    answer: 'Sim! Após gerar um script, você pode copiá-lo e editá-lo em qualquer editor de texto. Em breve, adicionaremos a funcionalidade de edição diretamente na plataforma.'
  },
  {
    question: 'Como exportar um script para PDF?',
    answer: 'Atualmente, você pode baixar o script em formato Markdown (.md) e convertê-lo para PDF usando ferramentas online. Em breve, adicionaremos a funcionalidade de exportação direta para PDF.'
  }
];

export default function HelpPage() {
  return (
    <div className="flex h-screen bg-dark-100 text-white overflow-hidden">
      {/* Sidebar */}
      <Sidebar projects={mockProjects} chats={mockChats} />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header userName="Patrícia" />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">Central de Ajuda</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-dark-200 p-6 rounded-lg">
                <h2 className="text-xl font-semibold text-primary mb-3">Guias Rápidos</h2>
                <ul className="space-y-2">
                  <li>
                    <a href="#scripts" className="text-gray-300 hover:text-primary">
                      Como criar scripts
                    </a>
                  </li>
                  <li>
                    <a href="#projects" className="text-gray-300 hover:text-primary">
                      Gerenciando projetos
                    </a>
                  </li>
                  <li>
                    <a href="#profile" className="text-gray-300 hover:text-primary">
                      Configurações de perfil
                    </a>
                  </li>
                </ul>
              </div>
              
              <div className="bg-dark-200 p-6 rounded-lg">
                <h2 className="text-xl font-semibold text-primary mb-3">Tutoriais em Vídeo</h2>
                <ul className="space-y-2">
                  <li>
                    <a href="#" className="text-gray-300 hover:text-primary">
                      Introdução à plataforma
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-gray-300 hover:text-primary">
                      Criando seu primeiro script
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-gray-300 hover:text-primary">
                      Dicas para reuniões eficientes
                    </a>
                  </li>
                </ul>
              </div>
              
              <div className="bg-dark-200 p-6 rounded-lg">
                <h2 className="text-xl font-semibold text-primary mb-3">Suporte</h2>
                <p className="text-gray-300 mb-4">
                  Precisa de ajuda adicional? Entre em contato com nossa equipe de suporte.
                </p>
                <a href="mailto:suporte@bussolaexecutiva.com" className="btn-primary py-2 px-4 block text-center">
                  Contatar Suporte
                </a>
              </div>
            </div>
            
            <div className="bg-dark-200 p-8 rounded-lg">
              <h2 className="text-2xl font-semibold text-primary mb-6">Perguntas Frequentes</h2>
              
              <div className="space-y-6">
                {faqItems.map((item, index) => (
                  <div key={index} className="border-b border-dark-300 pb-4 last:border-0 last:pb-0">
                    <h3 className="text-lg font-medium text-primary mb-2">{item.question}</h3>
                    <p className="text-gray-300">{item.answer}</p>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="mt-8 bg-dark-200 p-8 rounded-lg">
              <h2 className="text-2xl font-semibold text-primary mb-6" id="scripts">Como Criar Scripts</h2>
              
              <div className="space-y-4">
                <p className="text-gray-300">
                  A Bússola Executiva foi projetada para facilitar a criação de scripts de reunião profissionais em poucos minutos. Siga os passos abaixo para criar seu primeiro script:
                </p>
                
                <ol className="list-decimal pl-5 space-y-2 text-gray-300">
                  <li>Acesse a página "Scripts" no menu lateral</li>
                  <li>Preencha o formulário com as informações da reunião:
                    <ul className="list-disc pl-5 mt-1">
                      <li>Título da reunião</li>
                      <li>Objetivo principal</li>
                      <li>Lista de participantes</li>
                      <li>Duração estimada</li>
                      <li>Tópicos a serem discutidos</li>
                    </ul>
                  </li>
                  <li>Clique em "Gerar Script"</li>
                  <li>Revise o script gerado</li>
                  <li>Salve, copie ou baixe o script conforme sua necessidade</li>
                </ol>
                
                <p className="text-gray-300 mt-4">
                  Dica: Quanto mais detalhes você fornecer, mais personalizado será o script gerado.
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

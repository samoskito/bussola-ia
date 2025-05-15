import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';

type Project = {
  id: string;
  name: string;
  isActive?: boolean;
};

type Chat = {
  id: string;
  title: string;
};

interface SidebarProps {
  projects: Project[];
  chats: Chat[];
}

const Sidebar: React.FC<SidebarProps> = ({ projects, chats }: SidebarProps) => {
  return (
    <aside className="w-64 h-screen bg-dark-200 flex flex-col">
      {/* Logo */}
      <div className="p-4">
        <Link href="/dashboard">
          <div className="flex items-center">
            <Image 
              src="/images/logo.svg" 
              alt="Bússola Executiva" 
              width={150} 
              height={40} 
            />
          </div>
        </Link>
      </div>
      
      {/* Main Navigation */}
      <nav className="mt-6 px-4">
        <ul className="space-y-1">
          <li>
            <Link 
              href="/dashboard"
              className="sidebar-item"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
              </svg>
              <span>Dashboard</span>
            </Link>
          </li>
          <li>
            <Link 
              href="/dashboard/scripts"
              className="sidebar-item"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
              </svg>
              <span>Gerar Scripts</span>
            </Link>
          </li>
          <li>
            <Link 
              href="/dashboard/scripts/saved"
              className="sidebar-item"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
              </svg>
              <span>Scripts Salvos</span>
            </Link>
          </li>
          <li>
            <Link 
              href="/dashboard/profile"
              className="sidebar-item"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
              <span>Perfil</span>
            </Link>
          </li>
          <li>
            <Link 
              href="/dashboard/help"
              className="sidebar-item"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              <span>Ajuda</span>
            </Link>
          </li>
        </ul>
      </nav>

      {/* Projects Section */}
      <div className="mt-6 px-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-primary font-semibold">Suas pastas</h2>
          <button className="text-primary">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        <div className="space-y-1">
          {projects.map((project: Project) => (
            <Link 
              key={project.id} 
              href={`/dashboard/project/${project.id}`}
              className={`sidebar-item ${project.isActive ? 'active' : ''}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1H8a3 3 0 00-3 3v1.5a1.5 1.5 0 01-3 0V6z" clipRule="evenodd" />
                <path d="M6 12a2 2 0 012-2h8a2 2 0 012 2v2a2 2 0 01-2 2H2h2a2 2 0 002-2v-2z" />
              </svg>
              <span>{project.name}</span>
            </Link>
          ))}
        </div>
        <div className="mt-2 text-center">
          <button className="text-xs text-primary">Ver mais</button>
        </div>
      </div>

      {/* Chats Section */}
      <div className="mt-6 px-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-primary font-semibold">Seus chats</h2>
          <button className="text-primary">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {chats.map((chat: Chat) => (
            <Link 
              key={chat.id} 
              href={`/dashboard/chat/${chat.id}`}
              className="sidebar-item"
            >
              <span>Chat: {chat.title}</span>
            </Link>
          ))}
        </div>
        <div className="mt-2 text-center">
          <button className="text-xs text-primary">Ver mais</button>
        </div>
      </div>
      
      {/* Logout Button */}
      <div className="mt-auto p-4 border-t border-dark-300">
        <Link 
          href="/auth/logout"
          className="sidebar-item text-red-500 hover:bg-red-500/10"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V7.414l-5-5H3zm7 5a1 1 0 10-2 0v4a1 1 0 102 0V8zm-1-7a1 1 0 00-1 1v1a1 1 0 102 0V2a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>Sair</span>
        </Link>
      </div>
    </aside>
  );
};

export default Sidebar;

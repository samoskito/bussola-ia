import React from 'react';
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
    </aside>
  );
};

export default Sidebar;

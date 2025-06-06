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
  chats: Chat[];
}

const Sidebar: React.FC<SidebarProps> = ({ chats }: SidebarProps) => {
  return (
    <aside className="w-64 h-screen bg-gray-800 flex flex-col overflow-hidden">
      {/* Logo */}
      <div className="p-4">
        <Link href="/dashboard">
          <div className="flex items-center">
            <Image 
              src="/assets/images/logos/LOGO-BUSSOLA-LARANJA-E-BRANCO-1024x373.webp" 
              alt="Bússola Executiva" 
              width={150} 
              height={40} 
              className="object-contain"
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
              className="flex items-center px-4 py-2 text-gray-300 hover:bg-gray-700 hover:text-white rounded-md transition-colors duration-200 group"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 group-hover:text-white" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
              </svg>
              <span className="ml-3">Dashboard</span>
            </Link>
          </li>
          <li>
            <Link 
              href="/dashboard/scripts"
              className="flex items-center px-4 py-2 text-gray-300 hover:bg-gray-700 hover:text-white rounded-md transition-colors duration-200 group"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 group-hover:text-white" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
              </svg>
              <span className="ml-3">Gerar Scripts</span>
            </Link>
          </li>
          <li>
            <Link 
              href="/dashboard/scripts/saved"
              className="flex items-center px-4 py-2 text-gray-300 hover:bg-gray-700 hover:text-white rounded-md transition-colors duration-200 group"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 group-hover:text-white" viewBox="0 0 20 20" fill="currentColor">
                <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
              </svg>
              <span className="ml-3">Scripts Salvos</span>
            </Link>
          </li>
          <li>
            <Link 
              href="/dashboard/profile"
              className="flex items-center px-4 py-2 text-gray-300 hover:bg-gray-700 hover:text-white rounded-md transition-colors duration-200 group"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 group-hover:text-white" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
              <span className="ml-3">Perfil</span>
            </Link>
          </li>
          <li>
            <Link 
              href="/dashboard/help"
              className="flex items-center px-4 py-2 text-gray-300 hover:bg-gray-700 hover:text-white rounded-md transition-colors duration-200 group"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 group-hover:text-white" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              <span className="ml-3">Ajuda</span>
            </Link>
          </li>
        </ul>
      </nav>

      {/* Chats Section */}
      <div className="mt-6 px-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-medium text-gray-300 uppercase tracking-wider">Seus chats</h2>
          <button className="text-gray-400 hover:text-white p-1 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-primary-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {chats.map((chat: Chat) => (
            <Link 
              key={chat.id} 
              href={`/dashboard/chat/${chat.id}`}
              className="flex items-center px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white rounded-md transition-colors duration-200 group"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
              </svg>
              <span className="truncate">{chat.title}</span>
            </Link>
          ))}
        </div>
        <div className="mt-2 text-center">
          <button className="text-xs text-gray-400 hover:text-white transition-colors duration-200">
            Ver mais
          </button>
        </div>
      </div>
      
      {/* Logout Button */}
      <div className="mt-auto p-4 border-t border-gray-700">
        <Link 
          href="/auth/logout"
          className="flex items-center px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-md transition-colors duration-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
          </svg>
          <span>Sair da conta</span>
        </Link>
      </div>
    </aside>
  );
};

export default Sidebar;

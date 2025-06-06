'use client';

import React from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import AccessRestricted from '@/components/common/AccessRestricted';

export default function SavedScriptsPage() {
  return (
    <div className="flex h-screen w-full bg-dark-100 text-white overflow-hidden">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-y-auto p-6">
          <AccessRestricted 
            message="A funcionalidade de scripts salvos ainda não está disponível. Estamos trabalhando para disponibilizá-la em breve."
            redirectPath="/dashboard"
            redirectLabel="Voltar para o Dashboard"
          />
        </main>
      </div>
    </div>
  );
}

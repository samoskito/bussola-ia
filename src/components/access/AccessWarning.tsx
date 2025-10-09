'use client';

import React from 'react';
import Link from 'next/link';
import { getMensagemAviso } from '@/lib/access-control';

interface AccessWarningProps {
  diasRestantes?: number;
  dataExpiracao?: string | null;
}

export default function AccessWarning({ diasRestantes, dataExpiracao }: AccessWarningProps) {
  const mensagem = getMensagemAviso(diasRestantes);
  
  // Não mostrar nada se não houver aviso
  if (!mensagem) return null;
  const urgente = diasRestantes && diasRestantes <= 3;

  return (
    <div className={`max-w-3xl mx-auto my-4 rounded-lg border-2 p-4 ${
      urgente 
        ? 'bg-red-500/10 border-red-500/50' 
        : 'bg-yellow-500/10 border-yellow-500/50'
    }`}>
      <div className="flex items-start gap-3">
        {/* Ícone */}
        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
          urgente ? 'bg-red-500/20' : 'bg-yellow-500/20'
        }`}>
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className={`h-6 w-6 ${urgente ? 'text-red-400' : 'text-yellow-400'}`}
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
            />
          </svg>
        </div>

        {/* Conteúdo */}
        <div className="flex-1">
          <h3 className={`font-bold mb-1 ${urgente ? 'text-red-300' : 'text-yellow-300'}`}>
            {urgente ? 'Atenção!' : 'Aviso'}
          </h3>
          <p className="text-sm text-gray-300 mb-3">
            {mensagem}
          </p>
          <Link
            href="/dashboard"
            className={`inline-flex items-center text-sm font-semibold ${
              urgente ? 'text-red-400 hover:text-red-300' : 'text-yellow-400 hover:text-yellow-300'
            } transition-colors`}
          >
            Renovar Agora
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-4 w-4 ml-1" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M9 5l7 7-7 7" 
              />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}

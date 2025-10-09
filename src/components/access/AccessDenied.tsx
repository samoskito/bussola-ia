'use client';

import React from 'react';
import Link from 'next/link';
import { formatarDataExpiracao } from '@/lib/access-control';

interface AccessDeniedProps {
  motivo: string;
  expirado?: boolean;
  nomeIA?: string;
  dataExpiracao?: string | null;
}

export default function AccessDenied({ motivo, expirado, nomeIA, dataExpiracao }: AccessDeniedProps) {
  return (
    <div className="fixed inset-0 z-50 w-screen h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 to-gray-950 p-6">
      <div className="max-w-md w-full">
        {/* Card de Acesso Negado */}
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 border-2 border-red-500/30 shadow-2xl">
          {/* Ícone */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center border-2 border-red-500/30">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-10 w-10 text-red-500" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" 
                />
              </svg>
            </div>
          </div>

          {/* Título */}
          <h1 className="text-2xl font-bold text-white text-center mb-4">
            {expirado ? 'Plano Expirado' : 'Acesso Restrito'}
          </h1>

          {/* Nome da IA */}
          {nomeIA && (
            <div className="text-center mb-4">
              <span className="inline-block px-4 py-2 bg-[#FF6B00]/10 border border-[#FF6B00]/30 rounded-lg text-[#FF6B00] font-semibold">
                {nomeIA}
              </span>
            </div>
          )}

          {/* Mensagem */}
          <p className="text-gray-300 text-center mb-6 leading-relaxed">
            {motivo}
          </p>

          {/* Data de Expiração */}
          {dataExpiracao && expirado && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-center text-sm">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-5 w-5 text-red-400 mr-2" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" 
                  />
                </svg>
                <span className="text-red-400">
                  Expirou em: <span className="font-semibold">{formatarDataExpiracao(dataExpiracao)}</span>
                </span>
              </div>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="space-y-3">
            <Link
              href={expirado 
                ? "https://app.bussolaexecutiva.com.br/renovar-executivia" 
                : "https://app.bussolaexecutiva.com.br/upgrade-executivia"
              }
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-3 px-6 text-center font-semibold rounded-lg bg-[#FF6B00] hover:bg-[#FF6B00]/90 text-white transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              {expirado ? 'Renovar Acesso' : 'Fazer Upgrade'}
            </Link>
            
            <Link
              href="/dashboard"
              className="block w-full py-3 px-6 text-center font-semibold rounded-lg border-2 border-gray-700 hover:border-[#FF6B00] text-gray-300 hover:text-white transition-all duration-200"
            >
              Voltar ao Dashboard
            </Link>
          </div>

          {/* Informação Adicional */}
          <div className="mt-6 pt-6 border-t border-gray-700">
            <p className="text-xs text-gray-500 text-center">
              Precisa de ajuda? Entre em contato com o suporte.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

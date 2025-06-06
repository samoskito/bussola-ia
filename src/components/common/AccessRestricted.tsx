'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface AccessRestrictedProps {
  message?: string;
  redirectPath?: string;
  redirectLabel?: string;
}

export default function AccessRestricted({
  message = "Esta funcionalidade ainda não está disponível.",
  redirectPath = "/dashboard",
  redirectLabel = "Voltar para o Dashboard"
}: AccessRestrictedProps) {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-6 text-center">
      <div className="bg-dark-200 p-8 rounded-lg shadow-lg max-w-md">
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className="h-16 w-16 text-orange-500 mx-auto mb-4" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M12 15v2m0 0v2m0-2h2m-2 0H9m3-3V8m0 0V5m0 3h2m-2 0H9" 
          />
        </svg>
        
        <h2 className="text-2xl font-bold text-white mb-4">Acesso Restrito</h2>
        
        <p className="text-gray-300 mb-6">
          {message}
        </p>
        
        <Link 
          href={redirectPath} 
          className="inline-block px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-md transition-colors"
        >
          {redirectLabel}
        </Link>
      </div>
    </div>
  );
}

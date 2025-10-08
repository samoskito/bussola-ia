"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import LoginForm from '@/components/auth/LoginForm';

export default function LoginPage() {
  const router = useRouter();
  const [redirectedFrom, setRedirectedFrom] = useState('/dashboard');
  
  useEffect(() => {
    // Get search params from URL after component mounts
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const redirectParam = params.get('redirectedFrom');
      if (redirectParam) {
        setRedirectedFrom(redirectParam);
      }
    }
  }, []);
  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row">
      {/* Mobile layout (vertical) */}
      <div className="flex flex-col w-full h-screen md:hidden bg-gradient-to-b from-gray-900 to-gray-800 overflow-auto">
        {/* Conteúdo do formulário */}
        <div className="flex flex-col items-center justify-start pt-12 px-8 pb-8">
          <div className="w-full max-w-sm">
            <div className="mb-8 flex justify-center">
              <div className="w-[200px]">
                <img 
                  src="/images/executivia-logo.png" 
                  alt="ExecutivIA" 
                  width="200"
                  height="200"
                  style={{maxWidth: '100%', height: 'auto'}}
                />
              </div>
            </div>
            
            <LoginForm />
            
            <div className="mt-4 text-center">
              <Link href="/auth/reset-password" className="text-sm text-[#FF6B00] hover:underline">
                Esqueceu sua senha?
              </Link>
            </div>
          </div>
        </div>
        
        {/* Apresentadora para mobile - agora abaixo do formulário */}
        <div className="w-full mt-auto">
          <div className="relative w-full overflow-hidden">
            <img 
              src="/images/Apresentadora.png" 
              alt="Apresentadora" 
              className="w-full h-auto"
              style={{
                objectFit: 'cover',
                objectPosition: 'center top'
              }}
            />
          </div>
        </div>
      </div>
      
      {/* Desktop layout (horizontal) */}
      <div className="hidden md:flex w-full h-screen">
        {/* Coluna da esquerda (apresentadora) */}
        <div className="w-1/2 relative bg-gray-800">
          <div className="relative w-full h-full overflow-hidden">
            <img 
              src="/images/Apresentadora.png" 
              alt="Apresentadora" 
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center 20%'
              }}
            />
          </div>
        </div>
        
        {/* Coluna da direita (formulário) */}
        <div className="w-1/2 flex items-center justify-center bg-gray-900 p-8">
          <div className="w-full max-w-md">
            <div className="mb-12">
              <div className="mb-8">
                <div className="w-[250px]">
                  <img 
                    src="/images/executivia-logo.png" 
                    alt="ExecutivIA" 
                    width="250"
                    height="250"
                    style={{maxWidth: '100%', height: 'auto'}}
                  />
                </div>
              </div>
            </div>
            
            <LoginForm />
            
            <div className="mt-4 text-center">
              <Link href="/auth/reset-password" className="text-sm text-[#FF6B00] hover:underline">
                Esqueceu sua senha?
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

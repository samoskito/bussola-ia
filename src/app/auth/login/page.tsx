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
    const params = new URLSearchParams(window.location.search);
    const redirectParam = params.get('redirectedFrom');
    if (redirectParam) {
      setRedirectedFrom(redirectParam);
    }
  }, []);
  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row">
      {/* Mobile layout (vertical) */}
      <div className="flex flex-col w-full h-screen md:hidden relative bg-gradient-to-b from-gray-900 to-gray-800">
        <div className="flex-1 flex flex-col items-center justify-center p-8 z-10">
          <div className="w-full max-w-sm">
            <div className="mb-12 flex justify-center">
              <div className="w-[200px]">
                <Image 
                  src="/assets/images/logos/LOGO-BUSSOLA-LARANJA-E-BRANCO-1024x373.webp" 
                  alt="Bússola Executiva" 
                  width={200}
                  height={73}
                  priority
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
        
        {/* Apresentadora para mobile */}
        <div className="absolute bottom-0 right-0 w-full h-1/3 z-0">
          <div className="relative w-full h-full overflow-hidden">
            <Image 
              src="/assets/images/presenters/App_BussolaPrancheta-1-fotopat.png" 
              alt="Apresentadora" 
              fill
              className="object-cover object-center-[30%]"
              priority
            />
          </div>
        </div>
      </div>
      
      {/* Desktop layout (horizontal) */}
      <div className="hidden md:flex w-full h-screen">
        {/* Coluna da esquerda (apresentadora) */}
        <div className="w-1/2 relative bg-gray-800">
          <div className="relative w-full h-full overflow-hidden">
            <Image 
              src="/assets/images/presenters/App_BussolaPrancheta-1-fotopat.png" 
              alt="Apresentadora" 
              fill
              className="object-cover object-center-[20%]"
              priority
            />
          </div>
        </div>
        
        {/* Coluna da direita (formulário) */}
        <div className="w-1/2 flex items-center justify-center bg-gray-900 p-8">
          <div className="w-full max-w-md">
            <div className="mb-12">
              <div className="mb-8">
                <div className="w-[250px]">
                  <Image 
                    src="/assets/images/logos/LOGO-BUSSOLA-LARANJA-E-BRANCO-1024x373.webp" 
                    alt="Bússola Executiva" 
                    width={250}
                    height={91}
                    priority
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

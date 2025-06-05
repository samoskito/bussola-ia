"use client";

import React from 'react';
import Link from 'next/link';
import LoginForm from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row">
      {/* Mobile layout (vertical) */}
      <div className="flex flex-col w-full h-screen md:hidden" 
        style={{
          background: 'linear-gradient(to bottom, #1A1A1A, #2A2A2A)',
          position: 'relative',
        }}>
        <div className="flex-1 flex flex-col items-center justify-center p-8 z-10">
          <div className="w-full max-w-sm">
            <div className="mb-12 flex justify-center">
              <div 
                style={{
                  width: '200px',
                  height: '50px',
                  backgroundColor: '#F47321',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '16px'
                }}
              >
                BÚSSOLA EXECUTIVA
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
          <div 
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: '#9B1B30',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '24px',
              textAlign: 'center',
              padding: '20px'
            }}
          >
            <div>APRESENTADORA</div>
            <div style={{ fontSize: '16px', marginTop: '10px' }}>(Traje vermelho, microfone, fundo iluminado)</div>
          </div>
        </div>
      </div>
      
      {/* Desktop layout (horizontal) */}
      <div className="hidden md:flex w-full h-screen">
        {/* Coluna da esquerda (apresentadora) */}
        <div className="w-1/2 relative bg-[#2A2A2A]">
          <div 
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: '#9B1B30',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '24px',
              textAlign: 'center',
              padding: '20px'
            }}
          >
            <div>APRESENTADORA</div>
            <div style={{ fontSize: '16px', marginTop: '10px' }}>(Traje vermelho, microfone, fundo iluminado)</div>
          </div>
        </div>
        
        {/* Coluna da direita (formulário) */}
        <div className="w-1/2 flex items-center justify-center bg-[#1A1A1A] p-8">
          <div className="w-full max-w-md">
            <div className="mb-12">
              <div className="mb-8">
                <div 
                  style={{
                    backgroundColor: '#FF7A00',
                    color: 'white',
                    padding: '8px 16px',
                    display: 'inline-block',
                    fontWeight: 'bold',
                    fontSize: '18px'
                  }}
                >
                  BÚSSOLA EXECUTIVA
                </div>
                {/* Quando tiver o logo, use o código abaixo */}
                {/* <img src="/assets/images/logos/logo.png" alt="Bússola Executiva" className="h-12" /> */}
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

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-dark-100 flex flex-col md:flex-row">
      {/* Left side - Login Form */}
      <div className="w-full md:w-1/2 p-8 flex flex-col justify-center">
        <div className="max-w-md mx-auto w-full">
          <div className="mb-8">
            <Image 
              src="/images/logo.svg" 
              alt="Bússola Executiva" 
              width={200} 
              height={50} 
              className="mx-auto md:mx-0"
            />
          </div>
          
          <form className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                Seu email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="input-field"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                Sua senha
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="input-field"
              />
            </div>

            <div>
              <button
                type="submit"
                className="btn-primary w-full"
              >
                Entrar
              </button>
            </div>
          </form>
          
          <div className="mt-4 text-center">
            <Link href="/auth/reset-password" className="text-sm text-primary hover:underline">
              Esqueceu sua senha?
            </Link>
          </div>
          
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-400">
              Não tem uma conta?{' '}
              <Link href="/auth/register" className="text-primary hover:underline">
                Cadastre-se
              </Link>
            </p>
          </div>
        </div>
      </div>
      
      {/* Right side - Image */}
      <div className="hidden md:block md:w-1/2 bg-gradient-to-br from-dark-200 to-dark-400 relative">
        <div className="absolute inset-0 flex items-center justify-center p-8">
          <Image 
            src="/images/presenter.jpg" 
            alt="Apresentadora" 
            fill
            className="object-cover opacity-80"
          />
        </div>
      </div>
    </div>
  );
}

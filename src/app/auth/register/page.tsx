import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { register } from './actions';

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-dark-100 flex flex-col md:flex-row">
      {/* Left side - Registration Form */}
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
          
          <h2 className="text-2xl font-bold text-white mb-6">Crie sua conta</h2>
          
          <form className="space-y-6" action={register}>
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
                placeholder="exemplo@email.com"
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
                placeholder="Mínimo de 6 caracteres"
              />
            </div>
            
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-1">
                Confirme sua senha
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                className="input-field"
                placeholder="Digite a senha novamente"
              />
            </div>

            <div>
              <button
                type="submit"
                className="btn-primary w-full"
              >
                Criar conta
              </button>
            </div>
          </form>
          
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-400">
              Já tem uma conta?{' '}
              <Link href="/auth/login" className="text-primary hover:underline">
                Faça login
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

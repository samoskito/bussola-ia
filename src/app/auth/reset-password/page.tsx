import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function ResetPasswordPage() {
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
            
            <ResetPasswordForm />
            
            <div className="mt-4 text-center">
              <Link href="/auth/login" className="text-sm text-[#FF6B00] hover:underline">
                Voltar para o login
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
            
            <ResetPasswordForm />
            
            <div className="mt-4 text-center">
              <Link href="/auth/login" className="text-sm text-[#FF6B00] hover:underline">
                Voltar para o login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResetPasswordForm() {
  const [email, setEmail] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      // Simulando uma requisição de redefinição de senha
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setMessage({
        type: 'success',
        text: 'Se o e-mail estiver cadastrado, você receberá um link para redefinir sua senha.'
      });
      setEmail('');
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Ocorreu um erro ao tentar enviar o e-mail de redefinição. Tente novamente mais tarde.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <h2 className="text-2xl font-bold text-white mb-6">Redefinir senha</h2>
      <p className="text-gray-300 mb-6">
        Digite o e-mail associado à sua conta e enviaremos um link para redefinir sua senha.
      </p>
      
      {message && (
        <div 
          className={`p-4 mb-6 rounded-lg ${
            message.type === 'success' 
              ? 'bg-green-100 text-green-800 dark:bg-green-200 dark:text-green-900' 
              : 'bg-red-100 text-red-800 dark:bg-red-200 dark:text-red-900'
          }`}
        >
          {message.text}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
            Seu e-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="seu@email.com"
            disabled={loading}
          />
        </div>
        
        <div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Enviando...' : 'Enviar link de redefinição'}
          </button>
        </div>
      </form>
    </div>
  );
}

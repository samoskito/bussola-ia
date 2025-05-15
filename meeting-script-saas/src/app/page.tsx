import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function Home() {
  return (
    <div className="min-h-screen bg-dark-100 text-white">
      {/* Header */}
      <header className="border-b border-dark-300">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <Image 
              src="/images/logo.svg" 
              alt="Bússola Executiva" 
              width={180} 
              height={45} 
            />
          </div>
          
          <nav className="hidden md:flex space-x-8">
            <Link href="#features" className="text-gray-300 hover:text-primary transition-colors">
              Recursos
            </Link>
            <Link href="#pricing" className="text-gray-300 hover:text-primary transition-colors">
              Planos
            </Link>
            <Link href="#testimonials" className="text-gray-300 hover:text-primary transition-colors">
              Depoimentos
            </Link>
            <Link href="#faq" className="text-gray-300 hover:text-primary transition-colors">
              FAQ
            </Link>
          </nav>
          
          <div className="flex items-center space-x-4">
            <Link href="/auth/login" className="text-gray-300 hover:text-primary transition-colors">
              Entrar
            </Link>
            <Link href="/auth/register" className="btn-primary py-2 px-4">
              Começar Grátis
            </Link>
          </div>
        </div>
      </header>
      
      {/* Hero Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-6">
                Crie scripts de reunião profissionais em <span className="text-primary">minutos</span>
              </h1>
              <p className="text-xl text-gray-300 mb-8">
                Transforme suas reuniões com scripts personalizados gerados por IA. Economize tempo e conduza reuniões mais eficientes e produtivas.
              </p>
              <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                <Link href="/auth/register" className="btn-primary text-center py-3 px-8 text-lg">
                  Começar Agora
                </Link>
                <Link href="#demo" className="btn-secondary text-center py-3 px-8 text-lg">
                  Ver Demonstração
                </Link>
              </div>
              <div className="mt-8 flex items-center">
                <div className="flex -space-x-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="w-10 h-10 rounded-full bg-dark-300 border-2 border-dark-100 flex items-center justify-center">
                      <span className="text-xs font-semibold">U{i}</span>
                    </div>
                  ))}
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-300">
                    Mais de <span className="text-primary font-bold">500+</span> profissionais já utilizam
                  </p>
                </div>
              </div>
            </div>
            
            <div className="relative">
              <div className="bg-dark-200 p-6 rounded-lg shadow-xl">
                <div className="bg-dark-300 p-4 rounded-lg mb-4">
                  <h3 className="text-lg font-semibold text-primary mb-2">Reunião de Planejamento Estratégico</h3>
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <span className="text-gray-400 w-24">Objetivo:</span>
                      <span className="text-gray-200">Definir metas para o próximo trimestre</span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-gray-400 w-24">Duração:</span>
                      <span className="text-gray-200">60 minutos</span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-gray-400 w-24">Participantes:</span>
                      <span className="text-gray-200">Equipe de liderança (6 pessoas)</span>
                    </div>
                  </div>
                </div>
                <button className="btn-primary w-full mb-4">
                  Gerar Script de Reunião
                </button>
                <div className="text-center text-sm text-gray-400">
                  Script gerado em menos de 30 segundos
                </div>
              </div>
              
              <div className="absolute -top-4 -right-4 bg-primary text-white px-4 py-2 rounded-full text-sm font-bold">
                IA Avançada
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Features Section */}
      <section id="features" className="py-20 px-6 bg-dark-200">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Recursos Poderosos</h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Tudo o que você precisa para criar e gerenciar scripts de reunião profissionais
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: 'Geração Rápida',
                description: 'Crie scripts detalhados em segundos com nossa tecnologia de IA avançada',
                icon: '⚡'
              },
              {
                title: 'Personalização Completa',
                description: 'Adapte os scripts às suas necessidades específicas e ao seu estilo',
                icon: '🎨'
              },
              {
                title: 'Biblioteca de Templates',
                description: 'Acesse modelos pré-definidos para diferentes tipos de reuniões',
                icon: '📚'
              },
              {
                title: 'Compartilhamento Fácil',
                description: 'Compartilhe scripts com sua equipe em diversos formatos',
                icon: '🔄'
              },
              {
                title: 'Organização Inteligente',
                description: 'Mantenha seus scripts organizados em pastas e projetos',
                icon: '📂'
              },
              {
                title: 'Análise de Eficiência',
                description: 'Receba insights para melhorar a produtividade das suas reuniões',
                icon: '📊'
              }
            ].map((feature, index) => (
              <div key={index} className="bg-dark-300 p-6 rounded-lg">
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold text-primary mb-2">{feature.title}</h3>
                <p className="text-gray-300">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Planos Simples e Transparentes</h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Escolha o plano ideal para suas necessidades
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                name: 'Gratuito',
                price: 'R$ 0',
                description: 'Perfeito para experimentar',
                features: [
                  '5 scripts por mês',
                  'Acesso a templates básicos',
                  'Exportação em formato Markdown',
                  'Suporte por email'
                ],
                cta: 'Começar Grátis',
                highlighted: false
              },
              {
                name: 'Profissional',
                price: 'R$ 29',
                period: '/mês',
                description: 'Ideal para profissionais',
                features: [
                  'Scripts ilimitados',
                  'Todos os templates',
                  'Exportação em múltiplos formatos',
                  'Compartilhamento em equipe',
                  'Suporte prioritário'
                ],
                cta: 'Assinar Agora',
                highlighted: true
              },
              {
                name: 'Empresarial',
                price: 'R$ 99',
                period: '/mês',
                description: 'Para equipes e empresas',
                features: [
                  'Tudo do plano Profissional',
                  'Múltiplos usuários',
                  'Análise de eficiência',
                  'API para integração',
                  'Gerente de conta dedicado'
                ],
                cta: 'Falar com Vendas',
                highlighted: false
              }
            ].map((plan, index) => (
              <div 
                key={index} 
                className={`bg-dark-200 p-8 rounded-lg ${plan.highlighted ? 'border-2 border-primary relative' : ''}`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-primary text-white px-4 py-1 rounded-full text-sm font-bold">
                    Mais Popular
                  </div>
                )}
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <div className="mb-4">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  {plan.period && <span className="text-gray-400">{plan.period}</span>}
                </div>
                <p className="text-gray-300 mb-6">{plan.description}</p>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center">
                      <svg className="h-5 w-5 text-primary mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link 
                  href={plan.name === 'Empresarial' ? '#contato' : '/auth/register'}
                  className={`block text-center py-3 rounded-md font-semibold ${plan.highlighted ? 'btn-primary' : 'btn-secondary'}`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="bg-dark-300 py-12 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <Image 
                src="/images/logo.svg" 
                alt="Bússola Executiva" 
                width={150} 
                height={40} 
              />
              <p className="mt-4 text-gray-400">
                Transformando reuniões em experiências produtivas e eficientes.
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Produto</h3>
              <ul className="space-y-2">
                <li><Link href="#features" className="text-gray-400 hover:text-primary">Recursos</Link></li>
                <li><Link href="#pricing" className="text-gray-400 hover:text-primary">Planos</Link></li>
                <li><Link href="#" className="text-gray-400 hover:text-primary">Integrações</Link></li>
                <li><Link href="#" className="text-gray-400 hover:text-primary">Atualizações</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Empresa</h3>
              <ul className="space-y-2">
                <li><Link href="#" className="text-gray-400 hover:text-primary">Sobre nós</Link></li>
                <li><Link href="#" className="text-gray-400 hover:text-primary">Blog</Link></li>
                <li><Link href="#" className="text-gray-400 hover:text-primary">Carreiras</Link></li>
                <li><Link href="#contato" className="text-gray-400 hover:text-primary">Contato</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Legal</h3>
              <ul className="space-y-2">
                <li><Link href="#" className="text-gray-400 hover:text-primary">Termos de Serviço</Link></li>
                <li><Link href="#" className="text-gray-400 hover:text-primary">Política de Privacidade</Link></li>
                <li><Link href="#" className="text-gray-400 hover:text-primary">Cookies</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t border-dark-400 flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">
              &copy; {new Date().getFullYear()} Bússola Executiva. Todos os direitos reservados.
            </p>
            <div className="flex space-x-4 mt-4 md:mt-0">
              <Link href="#" className="text-gray-400 hover:text-primary">
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.325-1.325z" />
                </svg>
              </Link>
              <Link href="#" className="text-gray-400 hover:text-primary">
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723 10.1 10.1 0 01-3.127 1.184 4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                </svg>
              </Link>
              <Link href="#" className="text-gray-400 hover:text-primary">
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-2 16h-2v-6h2v6zm-1-6.891c-.607 0-1.1-.496-1.1-1.109 0-.612.492-1.109 1.1-1.109s1.1.497 1.1 1.109c0 .613-.493 1.109-1.1 1.109zm8 6.891h-1.998v-2.861c0-1.881-2.002-1.722-2.002 0v2.861h-2v-6h2v1.093c.872-1.616 4-1.736 4 1.548v3.359z" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

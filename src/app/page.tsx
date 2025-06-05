"use client";

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function Home() {
  // Aplicar estilos diretamente no componente cliente
  React.useEffect(() => {
    // Aplicar estilos ao body e html para garantir fundo escuro
    document.body.style.backgroundColor = '#1A1A1A';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.documentElement.style.backgroundColor = '#1A1A1A';
    
    return () => {
      // Limpar estilos ao desmontar
      document.body.style.backgroundColor = '';
      document.body.style.margin = '';
      document.body.style.padding = '';
      document.documentElement.style.backgroundColor = '';
    };
  }, []);

  return (
    <>
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: '#1A1A1A', 
        color: 'white',
        width: '100%',
        position: 'relative',
        overflow: 'hidden'
      }}>
      {/* Header */}
      <header style={{ 
        borderBottom: '1px solid #333333',
        backgroundColor: '#1A1A1A',
        position: 'relative',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
      }}>
        {/* Gradiente no topo do header */}
        <div style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0, 
          height: '3px', 
          background: 'linear-gradient(90deg, #FF6B00, #FF9D5C)' 
        }}></div>
        
        <div style={{ 
          maxWidth: '1200px', 
          margin: '0 auto', 
          padding: '1.25rem 1.5rem', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center' 
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center',
            position: 'relative'
          }}>
            <div style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <Image 
                src="/images/logo.svg" 
                alt="Bússola Executiva" 
                width={180} 
                height={45} 
              />
            </div>
          </div>
          
          <nav style={{ 
            display: 'flex', 
            gap: '2.5rem',
            margin: '0 1rem'
          }}>
            <Link href="#features" style={{ 
              color: 'white', 
              fontSize: '0.95rem',
              fontWeight: '500',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              transition: 'all 0.2s ease',
              position: 'relative',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 107, 0, 0.1)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              const svg = e.currentTarget.querySelector('svg');
              if (svg) {
                const paths = svg.querySelectorAll('path');
                paths.forEach(path => {
                  path.setAttribute('stroke-width', '2.5');
                });
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.transform = 'translateY(0)';
              const svg = e.currentTarget.querySelector('svg');
              if (svg) {
                const paths = svg.querySelectorAll('path');
                paths.forEach(path => {
                  path.setAttribute('stroke-width', '2');
                });
              }
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke="#FF6B00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Recursos
            </Link>
            <Link href="#pricing" style={{ 
              color: 'white', 
              fontSize: '0.95rem',
              fontWeight: '500',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              transition: 'all 0.2s ease',
              position: 'relative',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 107, 0, 0.1)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              const svg = e.currentTarget.querySelector('svg');
              if (svg) {
                const paths = svg.querySelectorAll('path');
                paths.forEach(path => {
                  path.setAttribute('stroke-width', '2.5');
                });
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.transform = 'translateY(0)';
              const svg = e.currentTarget.querySelector('svg');
              if (svg) {
                const paths = svg.querySelectorAll('path');
                paths.forEach(path => {
                  path.setAttribute('stroke-width', '2');
                });
              }
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 1V23" stroke="#FF6B00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M17 5H9.5C8.57174 5 7.6815 5.36875 7.02513 6.02513C6.36875 6.6815 6 7.57174 6 8.5C6 9.42826 6.36875 10.3185 7.02513 10.9749C7.6815 11.6313 8.57174 12 9.5 12H14.5C15.4283 12 16.3185 12.3687 16.9749 13.0251C17.6313 13.6815 18 14.5717 18 15.5C18 16.4283 17.6313 17.3185 16.9749 17.9749C16.3185 18.6313 15.4283 19 14.5 19H6" stroke="#FF6B00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Planos
            </Link>
            <Link href="#testimonials" style={{ 
              color: 'white', 
              fontSize: '0.95rem',
              fontWeight: '500',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              transition: 'all 0.2s ease',
              position: 'relative',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 107, 0, 0.1)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              const svg = e.currentTarget.querySelector('svg');
              if (svg) {
                const paths = svg.querySelectorAll('path');
                paths.forEach(path => {
                  path.setAttribute('stroke-width', '2.5');
                });
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.transform = 'translateY(0)';
              const svg = e.currentTarget.querySelector('svg');
              if (svg) {
                const paths = svg.querySelectorAll('path');
                paths.forEach(path => {
                  path.setAttribute('stroke-width', '2');
                });
              }
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#FF6B00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 14C8 14 9.5 16 12 16C14.5 16 16 14 16 14" stroke="#FF6B00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9 9H9.01" stroke="#FF6B00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M15 9H15.01" stroke="#FF6B00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Depoimentos
            </Link>
            <Link href="#faq" style={{ 
              color: 'white', 
              fontSize: '0.95rem',
              fontWeight: '500',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              transition: 'all 0.2s ease',
              position: 'relative',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 107, 0, 0.1)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              const svg = e.currentTarget.querySelector('svg');
              if (svg) {
                const paths = svg.querySelectorAll('path');
                paths.forEach(path => {
                  path.setAttribute('stroke-width', '2.5');
                });
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.transform = 'translateY(0)';
              const svg = e.currentTarget.querySelector('svg');
              if (svg) {
                const paths = svg.querySelectorAll('path');
                paths.forEach(path => {
                  path.setAttribute('stroke-width', '2');
                });
              }
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#FF6B00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9.09 9C9.3251 8.33167 9.78915 7.76811 10.4 7.40913C11.0108 7.05016 11.7289 6.91894 12.4272 7.03871C13.1255 7.15849 13.7588 7.52152 14.2151 8.06353C14.6713 8.60553 14.9211 9.29152 14.92 10C14.92 12 11.92 13 11.92 13" stroke="#FF6B00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 17H12.01" stroke="#FF6B00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              FAQ
            </Link>
          </nav>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link href="/auth/login" style={{ 
              color: 'white', 
              fontWeight: '500',
              padding: '0.625rem 1.25rem',
              borderRadius: '0.5rem',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              transition: 'all 0.2s ease',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
              const svg = e.currentTarget.querySelector('svg');
              if (svg) {
                const paths = svg.querySelectorAll('path');
                paths.forEach(path => {
                  path.setAttribute('stroke-width', '2.5');
                });
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
              const svg = e.currentTarget.querySelector('svg');
              if (svg) {
                const paths = svg.querySelectorAll('path');
                paths.forEach(path => {
                  path.setAttribute('stroke-width', '2');
                });
              }
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H15" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M10 17L15 12L10 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M15 12H3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Entrar
            </Link>
            <Link href="/auth/register" style={{ 
              backgroundColor: '#FF6B00', 
              color: 'white', 
              fontWeight: '600', 
              padding: '0.625rem 1.25rem', 
              borderRadius: '0.5rem', 
              transition: 'all 0.2s ease',
              textDecoration: 'none',
              boxShadow: '0 4px 6px -1px rgba(255, 107, 0, 0.2), 0 2px 4px -1px rgba(255, 107, 0, 0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#FF8534';
              e.currentTarget.style.transform = 'translateY(-2px) scale(1.03)';
              e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(255, 107, 0, 0.3), 0 4px 6px -2px rgba(255, 107, 0, 0.15)';
              const svg = e.currentTarget.querySelector('svg');
              if (svg) {
                const paths = svg.querySelectorAll('path');
                paths.forEach(path => {
                  path.setAttribute('stroke-width', '2.5');
                });
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#FF6B00';
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(255, 107, 0, 0.2), 0 2px 4px -1px rgba(255, 107, 0, 0.1)';
              const svg = e.currentTarget.querySelector('svg');
              if (svg) {
                const paths = svg.querySelectorAll('path');
                paths.forEach(path => {
                  path.setAttribute('stroke-width', '2');
                });
              }
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 21V19C16 17.9391 15.5786 16.9217 14.8284 16.1716C14.0783 15.4214 13.0609 15 12 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8.5 11C10.7091 11 12.5 9.20914 12.5 7C12.5 4.79086 10.7091 3 8.5 3C6.29086 3 4.5 4.79086 4.5 7C4.5 9.20914 6.29086 11 8.5 11Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M20 8V14" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M23 11H17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Começar Grátis
            </Link>
          </div>
        </div>
      </header>
      
      {/* Hero Section */}
      <section style={{ padding: '5rem 1.5rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '3rem', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
                Crie scripts de reunião profissionais em <span style={{ color: '#FF6B00' }}>minutos</span>
              </h1>
              <p style={{ fontSize: '1.25rem', color: '#9CA3AF', marginBottom: '2rem' }}>
                Transforme suas reuniões com scripts personalizados gerados por IA. Economize tempo e conduza reuniões mais eficientes e produtivas.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <Link href="/auth/register" style={{ backgroundColor: '#FF6B00', color: 'white', fontWeight: '600', padding: '0.75rem 1.5rem', borderRadius: '0.375rem', textAlign: 'center', transition: 'background-color 0.2s', width: 'fit-content' }}>
                  Começar Agora
                </Link>
                <Link href="#como-funciona" style={{ backgroundColor: 'transparent', color: '#FF6B00', border: '1px solid #FF6B00', fontWeight: '600', padding: '0.75rem 1.5rem', borderRadius: '0.375rem', textAlign: 'center', transition: 'background-color 0.2s', width: 'fit-content' }}>
                  Como Funciona
                </Link>
              </div>
              <div style={{ marginTop: '2rem', display: 'flex', alignItems: 'center' }}>
                <div style={{ display: 'flex', marginRight: '-0.5rem' }}>
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} style={{ width: '2.5rem', height: '2.5rem', borderRadius: '9999px', backgroundColor: '#2A2A2A', border: '2px solid #1A1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '-0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>U{i}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginLeft: '1rem' }}>
                  <p style={{ fontSize: '0.875rem' }}>Mais de <span style={{ color: '#FF6B00', fontWeight: 'bold' }}>500+</span> profissionais já utilizam</p>
                </div>
              </div>
            </div>
            
            <div style={{ position: 'relative' }}>
              <div style={{ 
                backgroundColor: '#1E1E1E', 
                padding: '2rem', 
                borderRadius: '1rem', 
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
                border: '1px solid #333333',
                overflow: 'hidden',
                position: 'relative'
              }}>
                {/* Efeito de gradiente no topo */}
                <div style={{ 
                  position: 'absolute', 
                  top: 0, 
                  left: 0, 
                  right: 0, 
                  height: '4px', 
                  background: 'linear-gradient(90deg, #FF6B00, #FF9D5C)' 
                }}></div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white' }}>Reunião de Planejamento Estratégico</h3>
                  <div style={{ 
                    backgroundColor: 'rgba(255, 107, 0, 0.15)', 
                    padding: '0.25rem 0.75rem', 
                    borderRadius: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#FF6B00', display: 'inline-block' }}></span>
                    <span style={{ color: '#FF6B00', fontSize: '0.75rem', fontWeight: '600' }}>Prioridade Alta</span>
                  </div>
                </div>
                
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '0.75rem', 
                  fontSize: '0.875rem', 
                  color: '#9CA3AF',
                  backgroundColor: 'rgba(42, 42, 42, 0.5)',
                  padding: '1rem',
                  borderRadius: '0.75rem',
                  marginBottom: '1.5rem'
                }}>
                  <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ 
                      color: '#FF6B00', 
                      fontWeight: '600',
                      minWidth: '100px'
                    }}>Objetivo:</span> 
                    <span>Definir metas para o próximo trimestre</span>
                  </p>
                  <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ 
                      color: '#FF6B00', 
                      fontWeight: '600',
                      minWidth: '100px'
                    }}>Duração:</span> 
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M12 6V12L16 14" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      60 minutos
                    </span>
                  </p>
                  <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ 
                      color: '#FF6B00', 
                      fontWeight: '600',
                      minWidth: '100px'
                    }}>Participantes:</span> 
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M9 11C11.2091 11 13 9.20914 13 7C13 4.79086 11.2091 3 9 3C6.79086 3 5 4.79086 5 7C5 9.20914 6.79086 11 9 11Z" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55232C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89318 18.7122 8.75608 18.1676 9.45769C17.623 10.1593 16.8604 10.6597 16 10.88" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Equipe de liderança (6 pessoas)
                    </span>
                  </p>
                </div>
                
                <button style={{ 
                  width: '100%', 
                  backgroundColor: '#FF6B00', 
                  color: 'white', 
                  padding: '0.75rem 0', 
                  borderRadius: '0.75rem',
                  fontWeight: '600',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 6px -1px rgba(255, 107, 0, 0.2), 0 2px 4px -1px rgba(255, 107, 0, 0.1)',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 16L12 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M9 11L12 8 15 11" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" stroke="white" strokeWidth="2"/>
                  </svg>
                  Gerar Script de Reunião
                </button>
                
                <div style={{ 
                  marginTop: '1.5rem', 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: '#9CA3AF',
                  fontSize: '0.75rem'
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M12 6V12L16 14" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <p>Script gerado em menos de 30 segundos</p>
                </div>
                
                <div style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
                  <div style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255, 107, 0, 0.1)',
                    color: '#FF6B00'
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke="#FF6B00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
                
                <div style={{ position: 'relative', marginTop: '1.5rem', display: 'flex', justifyContent: 'center', width: '100%' }}>
                  <div style={{ 
                    backgroundColor: '#FF6B00', 
                    color: 'white', 
                    fontSize: '0.875rem', 
                    fontWeight: 'bold', 
                    padding: '0.75rem 1.75rem', 
                    borderRadius: '9999px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                    whiteSpace: 'nowrap',
                    zIndex: 10,
                    margin: '0 auto',
                    maxWidth: 'fit-content'
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2 3H8C9.06087 3 10.0783 3.42143 10.8284 4.17157C11.5786 4.92172 12 5.93913 12 7V21C12 20.2044 11.6839 19.4413 11.1213 18.8787C10.5587 18.3161 9.79565 18 9 18H2V3Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M22 3H16C14.9391 3 13.9217 3.42143 13.1716 4.17157C12.4214 4.92172 12 5.93913 12 7V21C12 20.2044 12.3161 19.4413 12.8787 18.8787C13.4413 18.3161 14.2044 18 15 18H22V3Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    IA Avançada
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Features Section */}
      <section style={{ padding: '5rem 1.5rem', backgroundColor: '#222222' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem' }}>Recursos Poderosos</h2>
          <p style={{ fontSize: '1.125rem', color: '#9CA3AF', marginBottom: '3rem', maxWidth: '800px', margin: '0 auto 3rem' }}>
            Tudo o que você precisa para criar e gerenciar scripts de reunião profissionais
          </p>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
            <div style={{ backgroundColor: '#2A2A2A', padding: '2rem', borderRadius: '0.5rem', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ backgroundColor: '#FF6B00', width: '3rem', height: '3rem', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '1rem' }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>⚡</span>
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Geração Rápida</h3>
              </div>
              <p style={{ color: '#9CA3AF' }}>Crie scripts detalhados em segundos com nossa tecnologia de IA avançada</p>
            </div>
            
            <div style={{ backgroundColor: '#2A2A2A', padding: '2rem', borderRadius: '0.5rem', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ backgroundColor: '#FF6B00', width: '3rem', height: '3rem', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '1rem' }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>🎯</span>
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Personalização Completa</h3>
              </div>
              <p style={{ color: '#9CA3AF' }}>Adapte os scripts para seu estilo, setor e objetivos específicos</p>
            </div>
            
            <div style={{ backgroundColor: '#2A2A2A', padding: '2rem', borderRadius: '0.5rem', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ backgroundColor: '#FF6B00', width: '3rem', height: '3rem', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '1rem' }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>📊</span>
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Organização Eficiente</h3>
              </div>
              <p style={{ color: '#9CA3AF' }}>Mantenha todos os seus scripts organizados e acessíveis em um só lugar</p>
            </div>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer style={{ backgroundColor: '#1A1A1A', padding: '3rem 1.5rem', borderTop: '1px solid #2A2A2A' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <div>
              <Image 
                src="/images/logo.svg" 
                alt="Bússola Executiva" 
                width={150} 
                height={40} 
              />
            </div>
            <div style={{ display: 'flex', gap: '1.5rem' }}>
              <Link href="#" style={{ color: '#9CA3AF' }}>Termos</Link>
              <Link href="#" style={{ color: '#9CA3AF' }}>Privacidade</Link>
              <Link href="#" style={{ color: '#9CA3AF' }}>Contato</Link>
            </div>
          </div>
          <div style={{ borderTop: '1px solid #2A2A2A', paddingTop: '1.5rem', color: '#9CA3AF', fontSize: '0.875rem' }}>
            <p>&copy; 2025 Bússola Executiva. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
    </>
  );
}

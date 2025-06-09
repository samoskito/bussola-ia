"use client";

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ProfilePage() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirecionar para a página principal do dashboard
    router.push('/dashboard');
  }, [router]);
  
  // Retorna null enquanto redireciona
  return null;
}

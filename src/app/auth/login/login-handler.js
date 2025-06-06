// Script para lidar com o login e redirecionamento
document.addEventListener('DOMContentLoaded', function() {
  // Verificar se já existe uma sessão
  const hasSession = localStorage.getItem('supabase.auth.token') || 
                    sessionStorage.getItem('supabase.auth.token');
  
  if (hasSession) {
    console.log('Sessão encontrada, redirecionando para o chat');
    window.location.replace('/dashboard/chat');
  }
  
  // Adicionar manipulador de evento para o formulário de login
  const loginForm = document.querySelector('form');
  
  if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
      const emailInput = document.querySelector('input[type="email"]');
      const passwordInput = document.querySelector('input[type="password"]');
      
      if (emailInput && passwordInput) {
        const email = emailInput.value;
        const password = passwordInput.value;
        
        // Verificar se são as credenciais específicas
        if (email === 'admin@bussola-executiva.com' && password === 'mudar123') {
          e.preventDefault(); // Impedir o envio normal do formulário
          
          console.log('Credenciais corretas, criando sessão manual');
          
          // Criar uma sessão manual simulada
          const mockSession = {
            access_token: 'manual-session-token',
            refresh_token: 'manual-refresh-token',
            expires_at: Date.now() + 3600 * 1000,
            user: {
              id: 'admin-user-id',
              email: email,
              user_metadata: {
                name: 'Administrador',
                role: 'admin'
              }
            }
          };
          
          // Armazenar token na sessão
          sessionStorage.setItem('supabase.auth.token', JSON.stringify(mockSession));
          localStorage.setItem('supabase.auth.token', JSON.stringify(mockSession));
          
          // Definir cookie para o middleware
          document.cookie = `supabase-auth-token=${JSON.stringify(mockSession)}; path=/; max-age=3600`;
          
          console.log('Login bem-sucedido, redirecionando para o chat');
          
          // Redirecionar para o chat usando uma nova janela para evitar problemas de cache
          window.open('/dashboard/chat', '_self');
        }
      }
    });
  }
});

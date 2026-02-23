"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import MobileMenu from '@/components/layout/MobileMenu';
import { useAuth } from '@/contexts/AuthContext';
import {
  PASSWORD_RESET_DEFAULT_HTML,
  PASSWORD_RESET_DEFAULT_SUBJECT,
} from '@/lib/email/password-reset-template';

type Profile = {
  nome: string;
  email: string;
  telefone: string;
  avatar?: string | null;
};

type PasswordResetTemplate = {
  subject: string;
  html: string;
  smtpFrom: string | null;
  updatedAt: string | null;
  updatedByEmail: string | null;
  isDefault: boolean;
};

export default function ProfilePage() {
  const { user, loading, setUser } = useAuth();
  const isAdmin = user?.nivel === 'admin';
  const [profile, setProfile] = useState<Profile>({ nome: '', email: '', telefone: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [template, setTemplate] = useState<PasswordResetTemplate>({
    subject: '',
    html: '',
    smtpFrom: null,
    updatedAt: null,
    updatedByEmail: null,
    isDefault: true,
  });
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateMsg, setTemplateMsg] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const toggleMobileMenu = () => setIsMobileMenuOpen((v) => !v);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  // Helpers
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    window.clearTimeout((showToast as any)._t);
    (showToast as any)._t = window.setTimeout(() => setToast(null), 4500);
  };

  const formatPhoneBR = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const telefoneDigits = useMemo(() => profile.telefone.replace(/\D/g, ''), [profile.telefone]);

  // Password validations
  const pwdRules = useMemo(() => ({
    length: newPassword.length >= 8,
    upper: /[A-Z]/.test(newPassword),
    lower: /[a-z]/.test(newPassword),
    digit: /\d/.test(newPassword),
    match: newPassword.length > 0 && newPassword === confirmPassword,
    different: currentPassword.length > 0 && newPassword !== currentPassword,
  }), [newPassword, confirmPassword, currentPassword]);

  // Carregar perfil atual
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await fetch('/api/user/profile', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        if (data.user) {
          setProfile({
            nome: data.user.nome || '',
            email: data.user.email || '',
            telefone: data.user.telefone || '',
            avatar: data.user.avatar || null,
          });
        }
      } catch (e) {
        // noop
      }
    };
    if (user) loadProfile();
  }, [user]);

  // Carregar template de e-mail de recuperacao (somente admin)
  useEffect(() => {
    if (!isAdmin) return;

    let cancelled = false;
    const loadTemplate = async () => {
      setTemplateLoading(true);
      setTemplateMsg(null);
      try {
        const res = await fetch('/api/admin/email-template/password-reset', {
          method: 'GET',
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Erro ao carregar template');
        if (cancelled) return;
        setTemplate({
          subject: data.subject || '',
          html: data.html || '',
          smtpFrom: data.smtpFrom || null,
          updatedAt: data.updatedAt || null,
          updatedByEmail: data.updatedByEmail || null,
          isDefault: Boolean(data.isDefault),
        });
      } catch (err: any) {
        if (cancelled) return;
        setTemplateMsg(err.message || 'Falha ao carregar template');
        showToast('error', err.message || 'Falha ao carregar template de e-mail');
      } finally {
        if (!cancelled) setTemplateLoading(false);
      }
    };

    loadTemplate();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  // Sincroniza o conteudo do editor rico quando o template for carregado.
  useEffect(() => {
    if (!editorRef.current) return;
    if (document.activeElement === editorRef.current) return;
    if (editorRef.current.innerHTML !== template.html) {
      editorRef.current.innerHTML = template.html;
    }
  }, [template.html]);

  const applyEditorCommand = (command: string, value?: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, value);
    setTemplate((prev) => ({ ...prev, html: editorRef.current?.innerHTML || prev.html }));
  };

  const getSelectedAnchor = (): HTMLAnchorElement | null => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    let node: Node | null = selection.anchorNode;
    if (!node) return null;
    if (node.nodeType === Node.TEXT_NODE) {
      node = node.parentElement;
    }

    while (node && node instanceof HTMLElement) {
      if (node.tagName === 'A') return node as HTMLAnchorElement;
      node = node.parentElement;
    }

    return null;
  };

  const insertActionButton = () => {
    if (!editorRef.current) return;
    const label = window.prompt('Texto do botão:', 'Redefinir senha');
    if (!label) return;
    const href = window.prompt('URL do botão (use {{reset_url}}):', '{{reset_url}}');
    if (!href) return;
    const bg = window.prompt('Cor de fundo (hex):', '#FF6B00') || '#FF6B00';
    const fg = window.prompt('Cor do texto (hex):', '#FFFFFF') || '#FFFFFF';
    const radius = window.prompt('Borda arredondada (px):', '6') || '6';

    const buttonHtml = `<a href="${href}" style="background:${bg};color:${fg};padding:10px 14px;border-radius:${radius}px;text-decoration:none;display:inline-block;font-weight:600;">${label}</a>`;
    editorRef.current.focus();
    document.execCommand('insertHTML', false, buttonHtml);
    setTemplate((prev) => ({ ...prev, html: editorRef.current?.innerHTML || prev.html }));
  };

  const editSelectedButton = () => {
    const link = getSelectedAnchor();
    if (!link) {
      window.alert('Selecione um botao/link dentro do editor antes de editar.');
      return;
    }

    const label = window.prompt('Texto do botão:', link.textContent || 'Botao');
    if (!label) return;
    const href = window.prompt('URL do botão:', link.getAttribute('href') || '{{reset_url}}');
    if (!href) return;
    const bg = window.prompt('Cor de fundo (hex):', link.style.backgroundColor || '#FF6B00') || '#FF6B00';
    const fg = window.prompt('Cor do texto (hex):', link.style.color || '#FFFFFF') || '#FFFFFF';
    const radius = window.prompt(
      'Borda arredondada (px):',
      (link.style.borderRadius || '6px').replace('px', '')
    ) || '6';

    link.textContent = label;
    link.setAttribute('href', href);
    link.style.background = bg;
    link.style.color = fg;
    link.style.padding = link.style.padding || '10px 14px';
    link.style.borderRadius = `${radius}px`;
    link.style.textDecoration = 'none';
    link.style.display = 'inline-block';
    link.style.fontWeight = '600';

    setTemplate((prev) => ({ ...prev, html: editorRef.current?.innerHTML || prev.html }));
  };

  const insertPlaceholder = (placeholder: string) => {
    applyEditorCommand('insertText', placeholder);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setTemplateSaving(true);
    setTemplateMsg(null);
    try {
      const html = editorRef.current?.innerHTML || template.html;
      const res = await fetch('/api/admin/email-template/password-reset', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          subject: template.subject.trim(),
          html,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar template');

      setTemplate((prev) => ({
        ...prev,
        html,
        isDefault: false,
        updatedAt: new Date().toISOString(),
        updatedByEmail: user?.email || null,
      }));
      setTemplateMsg('Template salvo com sucesso.');
      showToast('success', 'Template de e-mail atualizado com sucesso.');
    } catch (err: any) {
      setTemplateMsg(err.message || 'Falha ao salvar template');
      showToast('error', err.message || 'Falha ao salvar template');
    } finally {
      setTemplateSaving(false);
    }
  };

  // Salvar perfil (nome/email/telefone)
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          nome: profile.nome.trim(),
          email: profile.email.trim().toLowerCase(),
          telefone: telefoneDigits,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar');
      setSaveMsg('Dados atualizados com sucesso.');
      // Atualizar AuthContext para refletir no Header imediatamente
      if (user) {
        setUser({ ...user, nome: profile.nome, email: profile.email, telefone: telefoneDigits });
      }
      showToast('success', 'Perfil atualizado com sucesso.');
    } catch (err: any) {
      setSaveMsg(err.message || 'Falha ao salvar');
      showToast('error', err.message || 'Falha ao atualizar perfil');
    } finally {
      setIsSaving(false);
    }
  };

  // Alterar senha
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMsg(null);
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwdMsg('Preencha todos os campos.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdMsg('A confirmação da senha não confere.');
      return;
    }
    if (!(pwdRules.length && pwdRules.upper && pwdRules.lower && pwdRules.digit && pwdRules.different)) {
      setPwdMsg('A senha não atende aos requisitos mínimos.');
      return;
    }
    setPwdSaving(true);
    try {
      const res = await fetch('/api/user/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Erro ao alterar senha');
      setPwdMsg('Senha alterada com sucesso.');
      showToast('success', 'Senha alterada com sucesso.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwdMsg(err.message || 'Falha ao alterar senha');
      showToast('error', err.message || 'Falha ao alterar senha');
    } finally {
      setPwdSaving(false);
    }
  };

  // Upload avatar
  const handleUploadAvatar = async (e: React.FormEvent) => {
    e.preventDefault();
    setAvatarMsg(null);
    if (!avatarFile) {
      setAvatarMsg('Selecione uma imagem.');
      return;
    }
    setAvatarUploading(true);
    try {
      // Crop para quadrado 512x512 antes de enviar
      const cropToSquare = (file: File, size = 512): Promise<File> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const img = new Image();
            img.onload = () => {
              try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) throw new Error('Canvas não suportado');

                const w = img.naturalWidth || img.width;
                const h = img.naturalHeight || img.height;
                const side = Math.min(w, h);
                const sx = Math.floor((w - side) / 2);
                const sy = Math.floor((h - side) / 2);
                canvas.width = size;
                canvas.height = size;
                ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);

                canvas.toBlob((blob) => {
                  if (!blob) {
                    // Fallback usando dataURL
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
                    const byteString = atob(dataUrl.split(',')[1]);
                    const ab = new ArrayBuffer(byteString.length);
                    const ia = new Uint8Array(ab);
                    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
                    const fallbackBlob = new Blob([ab], { type: 'image/jpeg' });
                    resolve(new File([fallbackBlob], 'avatar.jpg', { type: 'image/jpeg' }));
                    return;
                  }
                  resolve(new File([blob], 'avatar.jpg', { type: 'image/jpeg' }));
                }, 'image/jpeg', 0.9);
              } catch (err) {
                reject(err);
              }
            };
            img.onerror = reject;
            img.src = reader.result as string;
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      };

      const croppedFile = await cropToSquare(avatarFile, 512).catch(() => avatarFile);

      const form = new FormData();
      form.append('avatar', croppedFile, croppedFile.name || 'avatar.jpg');
      const res = await fetch('/api/user/avatar', {
        method: 'POST',
        body: form,
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar avatar');
      setAvatarMsg('Foto atualizada com sucesso.');
      setProfile((p) => ({ ...p, avatar: data.url || p.avatar }));
      if (user) {
        setUser({ ...user, avatar: data.url || user.avatar });
      }
      showToast('success', 'Foto atualizada com sucesso.');
    } catch (err: any) {
      setAvatarMsg(err.message || 'Falha ao enviar avatar');
      showToast('error', err.message || 'Falha ao enviar foto');
    } finally {
      setAvatarUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex h-screen w-full bg-gray-900 text-white overflow-hidden">
      {/* Sidebar */}
      <div className="hidden lg:flex lg:w-64 xl:w-72 2xl:w-80 border-r border-gray-800 shadow-xl">
        <Sidebar />
      </div>

      {/* Mobile Menu Overlay */}
      <MobileMenu 
        isOpen={isMobileMenuOpen} 
        onClose={closeMobileMenu} 
        chats={[]} 
      />

      <div className="flex flex-col flex-1 overflow-hidden w-full">
        <Header userName={user?.nome || user?.email} title="Meu Perfil" onMenuToggle={toggleMobileMenu} />

        <main className="flex-1 overflow-y-auto bg-gradient-to-b from-gray-900 to-gray-950 w-full p-6">
          {/* Toast */}
          {toast && (
            <div className="fixed top-4 right-4 z-[100]" role="alert" aria-live="polite" aria-atomic="true">
              <div className={`max-w-sm w-80 text-white rounded-lg shadow-xl border backdrop-blur-md ${toast.type === 'success' ? 'bg-green-600/90 border-green-300' : 'bg-red-600/90 border-red-300'}`}>
                <div className="px-4 py-3 flex items-start gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3m0 4h.01M10.29 3.86l-7.6 13.15A1.5 1.5 0 003.9 19.5h16.2a1.5 1.5 0 001.31-2.49L13.81 3.86a1.5 1.5 0 00-2.62 0z" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{toast.message}</p>
                  </div>
                  <button type="button" onClick={() => setToast(null)} className="text-white/90 hover:text-white" aria-label="Fechar aviso">×</button>
                </div>
              </div>
            </div>
          )}
          <div className="max-w-4xl mx-auto grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Informações Pessoais */}
            <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-lg">
              <h2 className="text-lg font-semibold mb-4">Informações Pessoais</h2>
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Nome</label>
                  <input
                    type="text"
                    className="w-full bg-gray-800 border border-gray-700 focus:border-[#FF6B00] focus:ring-2 focus:ring-[#FF6B00] text-white rounded-md py-2 px-3 text-sm outline-none"
                    value={profile.nome}
                    onChange={(e) => setProfile({ ...profile, nome: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Email</label>
                  <input
                    type="email"
                    className="w-full bg-gray-800 border border-gray-700 focus:border-[#FF6B00] focus:ring-2 focus:ring-[#FF6B00] text-white rounded-md py-2 px-3 text-sm outline-none"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Telefone</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="w-full bg-gray-800 border border-gray-700 focus:border-[#FF6B00] focus:ring-2 focus:ring-[#FF6B00] text-white rounded-md py-2 px-3 text-sm outline-none"
                    value={profile.telefone}
                    onChange={(e) => setProfile({ ...profile, telefone: formatPhoneBR(e.target.value) })}
                  />
                </div>
                {saveMsg && (
                  <div className="text-sm mt-2 text-gray-300">{saveMsg}</div>
                )}
                <button
                  type="submit"
                  disabled={isSaving}
                  className={`mt-2 px-4 py-2 rounded-md text-sm font-medium ${isSaving ? 'bg-gray-600' : 'bg-[#FF6B00] hover:bg-[#E05E00]'} text-white`}
                >
                  {isSaving ? 'Salvando...' : 'Salvar alterações'}
                </button>
              </form>
            </section>

            {/* Foto de Perfil */}
            <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-lg">
              <h2 className="text-lg font-semibold mb-4">Foto de Perfil</h2>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-gray-700 overflow-hidden flex items-center justify-center">
                  {profile.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white text-lg font-bold">{(profile.nome || user?.email)?.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                    className="text-sm text-gray-300"
                  />
                </div>
              </div>
              {avatarMsg && (
                <div className="text-sm mt-2 text-gray-300">{avatarMsg}</div>
              )}
              <button
                onClick={handleUploadAvatar}
                disabled={avatarUploading || !avatarFile}
                className={`mt-2 px-4 py-2 rounded-md text-sm font-medium ${avatarUploading ? 'bg-gray-600' : 'bg-[#FF6B00] hover:bg-[#E05E00]'} text-white`}
              >
                {avatarUploading ? 'Enviando...' : 'Enviar foto'}
              </button>
            </section>

            {/* Alterar Senha */}
            <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-lg xl:col-span-2">
              <h2 className="text-lg font-semibold mb-4">Alterar Senha</h2>
              <form onSubmit={handleChangePassword} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Senha Atual</label>
                  <input
                    type="password"
                    className="w-full bg-gray-800 border border-gray-700 focus:border-[#FF6B00] focus:ring-2 focus:ring-[#FF6B00] text-white rounded-md py-2 px-3 text-sm outline-none"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Nova Senha</label>
                  <input
                    type="password"
                    className="w-full bg-gray-800 border border-gray-700 focus:border-[#FF6B00] focus:ring-2 focus:ring-[#FF6B00] text-white rounded-md py-2 px-3 text-sm outline-none"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <div className="mt-2 space-y-1 text-xs">
                    <p className={`${pwdRules.length ? 'text-green-400' : 'text-gray-400'}`}>• Mínimo de 8 caracteres</p>
                    <p className={`${pwdRules.upper ? 'text-green-400' : 'text-gray-400'}`}>• Pelo menos 1 letra maiúscula</p>
                    <p className={`${pwdRules.lower ? 'text-green-400' : 'text-gray-400'}`}>• Pelo menos 1 letra minúscula</p>
                    <p className={`${pwdRules.digit ? 'text-green-400' : 'text-gray-400'}`}>• Pelo menos 1 número</p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Confirmar Nova Senha</label>
                  <input
                    type="password"
                    className="w-full bg-gray-800 border border-gray-700 focus:border-[#FF6B00] focus:ring-2 focus:ring-[#FF6B00] text-white rounded-md py-2 px-3 text-sm outline-none"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  <div className="mt-2 space-y-1 text-xs">
                    <p className={`${pwdRules.match ? 'text-green-400' : 'text-gray-400'}`}>• Senhas iguais</p>
                    <p className={`${pwdRules.different ? 'text-green-400' : 'text-gray-400'}`}>• Diferente da senha atual</p>
                  </div>
                </div>
                {pwdMsg && (
                  <div className="md:col-span-3 text-sm text-gray-300">{pwdMsg}</div>
                )}
                <div className="md:col-span-3 mt-2">
                  <button
                    type="submit"
                    disabled={pwdSaving || !(pwdRules.length && pwdRules.upper && pwdRules.lower && pwdRules.digit && pwdRules.match && pwdRules.different)}
                    className={`px-4 py-2 rounded-md text-sm font-medium ${pwdSaving ? 'bg-gray-600' : 'bg-[#FF6B00] hover:bg-[#E05E00]'} text-white`}
                  >
                    {pwdSaving ? 'Alterando...' : 'Alterar senha'}
                  </button>
                </div>
              </form>
            </section>

            {isAdmin && (
              <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-lg xl:col-span-2">
                <h2 className="text-lg font-semibold mb-1">Template do e-mail de recuperacao de senha</h2>
                <p className="text-sm text-gray-400 mb-4">
                  Este conteudo sera enviado no fluxo "Esqueci minha senha" usando o SMTP configurado.
                  Use o placeholder obrigatorio <code>{'{{reset_url}}'}</code>.
                </p>

                <form onSubmit={handleSaveTemplate} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Assunto do e-mail</label>
                      <input
                        type="text"
                        value={template.subject}
                        onChange={(e) => setTemplate((prev) => ({ ...prev, subject: e.target.value }))}
                        className="w-full bg-gray-800 border border-gray-700 focus:border-[#FF6B00] focus:ring-2 focus:ring-[#FF6B00] text-white rounded-md py-2 px-3 text-sm outline-none"
                        placeholder="Ex.: Redefinicao de senha - Bussola IA"
                        disabled={templateLoading}
                      />
                    </div>
                    <div className="text-sm text-gray-300 self-end md:text-right">
                      <p>Remetente SMTP: <span className="text-white">{template.smtpFrom || '-'}</span></p>
                      {template.updatedAt && (
                        <p className="text-gray-400 mt-1">
                          Ultima atualizacao: {new Date(template.updatedAt).toLocaleString('pt-BR')}
                          {template.updatedByEmail ? ` por ${template.updatedByEmail}` : ''}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="border border-gray-700 rounded-lg overflow-hidden">
                    <div className="flex flex-wrap gap-2 p-3 bg-gray-800 border-b border-gray-700">
                      <button type="button" onClick={() => applyEditorCommand('bold')} className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-white">Negrito</button>
                      <button type="button" onClick={() => applyEditorCommand('italic')} className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-white">Italico</button>
                      <button type="button" onClick={() => applyEditorCommand('underline')} className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-white">Sublinhado</button>
                      <button type="button" onClick={() => applyEditorCommand('insertUnorderedList')} className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-white">Lista</button>
                      <button
                        type="button"
                        onClick={() => {
                          const url = window.prompt('URL do link:');
                          if (url) applyEditorCommand('createLink', url);
                        }}
                        className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-white"
                      >
                        Link
                      </button>
                      <button
                        type="button"
                        onClick={insertActionButton}
                        className="px-2 py-1 text-xs rounded bg-[#FF6B00] hover:bg-[#E05E00] text-white"
                      >
                        Inserir botao
                      </button>
                      <button
                        type="button"
                        onClick={editSelectedButton}
                        className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-white"
                      >
                        Editar botao
                      </button>
                      <button type="button" onClick={() => insertPlaceholder('{{reset_url}}')} className="px-2 py-1 text-xs rounded bg-[#FF6B00] hover:bg-[#E05E00] text-white">{'{{reset_url}}'}</button>
                      <button type="button" onClick={() => insertPlaceholder('{{email}}')} className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-white">{'{{email}}'}</button>
                      <button type="button" onClick={() => insertPlaceholder('{{support_email}}')} className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-white">{'{{support_email}}'}</button>
                    </div>

                    <div
                      ref={editorRef}
                      contentEditable
                      suppressContentEditableWarning
                      onInput={(e) => setTemplate((prev) => ({ ...prev, html: (e.currentTarget as HTMLDivElement).innerHTML }))}
                      className="min-h-[260px] p-4 bg-white text-sm text-gray-900 outline-none"
                    />
                  </div>
                  <p className="text-xs text-gray-400">
                    Dica: para editar um botao existente, clique nele no editor e use "Editar botao".
                  </p>

                  {template.isDefault && (
                    <p className="text-xs text-amber-300">Voce esta usando o template padrao. Ao salvar, ele passa a ser customizado.</p>
                  )}
                  {templateMsg && (
                    <p className="text-sm text-gray-300">{templateMsg}</p>
                  )}

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="submit"
                      disabled={templateSaving || templateLoading}
                      className={`px-4 py-2 rounded-md text-sm font-medium ${templateSaving ? 'bg-gray-600' : 'bg-[#FF6B00] hover:bg-[#E05E00]'} text-white`}
                    >
                      {templateSaving ? 'Salvando...' : 'Salvar template'}
                    </button>
                    <button
                      type="button"
                      disabled={templateLoading}
                      onClick={() => {
                        setTemplate((prev) => ({
                          ...prev,
                          html: PASSWORD_RESET_DEFAULT_HTML,
                          subject: PASSWORD_RESET_DEFAULT_SUBJECT,
                          isDefault: true,
                        }));
                      }}
                      className="px-4 py-2 rounded-md text-sm font-medium bg-gray-700 hover:bg-gray-600 text-white"
                    >
                      Restaurar padrao
                    </button>
                  </div>
                </form>
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

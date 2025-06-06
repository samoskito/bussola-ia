import React from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-dark-100 text-white overflow-hidden">
        {children}
      </div>
    </ProtectedRoute>
  );
}

"use client";

import React, { useEffect, useState } from "react";

interface ExpiryToastProps {
  daysRemaining?: number;
  dataExpiracao?: string | null;
}

export default function ExpiryToast({ daysRemaining, dataExpiracao }: ExpiryToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof daysRemaining === "number" && daysRemaining <= 3) {
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 6000);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [daysRemaining]);

  if (!visible) return null;

  const isExpired = typeof daysRemaining === "number" && daysRemaining <= 0;
  const bg = isExpired || (typeof daysRemaining === "number" && daysRemaining <= 3)
    ? "bg-red-500/90 border-red-300"
    : "bg-yellow-500/90 border-yellow-300";

  return (
    <div className="fixed bottom-4 right-4 z-[100]">
      <div
        className={`max-w-xs w-80 text-white rounded-lg shadow-xl border ${bg} backdrop-blur-md`}
        role="alert"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="px-4 py-3 flex items-start gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3m0 4h.01M10.29 3.86l-7.6 13.15A1.5 1.5 0 003.9 19.5h16.2a1.5 1.5 0 001.31-2.49L13.81 3.86a1.5 1.5 0 00-2.62 0z" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-semibold">
              {isExpired
                ? "Seu plano expirou."
                : `Seu plano expira em ${daysRemaining} dia${daysRemaining === 1 ? "" : "s"}.`}
            </p>
            {dataExpiracao && (
              <p className="text-xs opacity-90 mt-0.5">
                Data de expiração: {new Date(dataExpiracao).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setVisible(false)}
            className="text-white/90 hover:text-white transition-colors"
            aria-label="Fechar aviso de expiração"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}

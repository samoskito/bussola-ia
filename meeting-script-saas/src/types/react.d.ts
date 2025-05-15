import * as React from 'react';

declare module 'react' {
  interface HTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {
    // Estendendo os atributos HTML para incluir classes do Tailwind
    className?: string;
    style?: React.CSSProperties;
    [key: string]: any;
  }
  
  interface SVGAttributes<T> extends AriaAttributes, DOMAttributes<T> {
    className?: string;
    style?: React.CSSProperties;
    [key: string]: any;
  }
}

export {};

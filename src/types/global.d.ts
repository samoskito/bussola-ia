// Declaração global para JSX
declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
      div: any;
      span: any;
      a: any;
      p: any;
      h1: any;
      h2: any;
      h3: any;
      button: any;
      input: any;
      form: any;
      main: any;
      header: any;
      footer: any;
      nav: any;
      section: any;
      article: any;
      aside: any;
      ul: any;
      li: any;
    }
  }
  
  namespace React {
    interface FC<P = {}> {
      (props: P): React.ReactElement | null;
    }
    type ReactNode = ReactElement | string | number | boolean | null | undefined;
    interface ReactElement {}
  }
}

// Declarações para módulos que não possuem tipos
declare module 'react' {
  export = React;
  export as namespace React;
  
  export function useState<T>(initialState: T | (() => T)): [T, (newState: T | ((prevState: T) => T)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: ReadonlyArray<any>): void;
  export function useRef<T>(initialValue: T): { current: T };
  export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: ReadonlyArray<any>): T;
  export const Fragment: React.FC;
  export default React;
}

declare module 'next' {
  export interface Metadata {
    title?: string;
    description?: string;
  }
}

declare module 'next/image';
declare module 'next/link';
declare module 'next/navigation' {
  export function redirect(url: string): never;
}

declare module 'next/font/google' {
  export function Inter(options: { subsets: string[] }): { className: string };
}

declare module '@supabase/auth-helpers-nextjs';
declare module '@supabase/supabase-js' {
  export function createClient(url: string, key: string): any;
}

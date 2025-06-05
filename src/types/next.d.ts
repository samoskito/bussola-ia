import React from 'react';

declare module 'next' {
  export interface NextPage<P = {}, IP = P> {
    (props: P): React.ReactElement | null;
    getInitialProps?: (context: any) => IP | Promise<IP>;
  }
}

declare module 'next/navigation' {
  export function redirect(url: string): never;
  export function useRouter(): {
    push: (url: string) => void;
    replace: (url: string) => void;
    back: () => void;
  };
}

export {};

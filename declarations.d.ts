/*
This tells TS that ion-icon is a valid custom element with attributes it uses (name, size, color, src).
*/

import type React from 'react';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'ion-icon': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        name?: string;
        size?: string;
        color?: string;
        src?: string;
      };
    }
  }
}

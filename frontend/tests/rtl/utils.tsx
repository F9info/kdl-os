import * as React from 'react';
import { render as rtlRender, type RenderOptions } from '@testing-library/react';
import { Providers } from '@/app/providers';

function AllTheProvider({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}

function render(ui: React.ReactElement, options: RenderOptions = {}) {
  return rtlRender(ui, { wrapper: AllTheProvider, ...options });
}

export * from '@testing-library/react';
export { render, AllTheProvider };

'use client';
import { createContext, useContext } from 'react';
import type { User } from '@shared/types';
import type { AuthDraft, AuthMode } from '@/utils/auth-pages';

type Context = {
  theme: 'light' | 'dark';
  user: User | null;
  ready: boolean;
  version: number;
  refresh: () => void;
  setUser: (u: User | null) => void;
  auth: (mode?: AuthMode) => void;
  authDraft: AuthDraft;
  updateAuthDraft: (values: Partial<AuthDraft>) => void;
  ask: () => void;
  notify: (message: string) => void;
  hero: string;
  classroom: boolean;
  logo: string;
  setLogo: (logo: string) => void;
};
export const TechCareContext = createContext<Context | null>(null);
export const useTechCare = () => useContext(TechCareContext)!;

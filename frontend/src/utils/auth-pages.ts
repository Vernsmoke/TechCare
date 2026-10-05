export const authPaths = {
  login: '/login',
  register: '/register',
  verify: '/verify',
  forgot: '/forgot-password',
  reset: '/reset-password',
} as const;

export type AuthMode = keyof typeof authPaths;

export type AuthDraft = { email: string; code: string; token: string; message: string };
export const emptyAuthDraft: AuthDraft = { email: '', code: '', token: '', message: '' };

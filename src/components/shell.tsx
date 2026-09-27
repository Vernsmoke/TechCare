'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import {
  House,
  BookOpen,
  PlayCircle,
  ChatCircleDots,
  Users,
  Toolbox,
  MagnifyingGlass,
  ChatTeardropText,
  UserPlus,
  Heart,
  Monitor,
  UserCircle,
  ShieldCheck,
  Gear,
  SignOut,
  List,
  X,
  SidebarSimple,
  Moon,
  Sun,
} from '@phosphor-icons/react';
import { api, Avatar, Field, Form, Modal, Success, TextArea, Select } from './ui';
import type { User, Result, FormValues } from '@/lib/types';
import { categories } from '@/lib/content';
import { GuideAssistant } from './guide-assistant';
import { NavigationDock } from './navigation-dock';
import { QuestionPhoto } from './question-photo';

type AuthMode = 'login' | 'register' | 'verify' | 'forgot' | 'reset';
type Context = {
  theme: 'light' | 'dark';
  user: User | null;
  ready: boolean;
  version: number;
  refresh: () => void;
  setUser: (u: User | null) => void;
  auth: (mode?: AuthMode) => void;
  ask: () => void;
  notify: (message: string) => void;
  hero: string;
  classroom: boolean;
  logo: string;
  setLogo: (logo: string) => void;
};
const Context = createContext<Context | null>(null);
export const useTechCare = () => useContext(Context)!;
const navigation = [
  { href: '/', label: 'Home', icon: House },
  { href: '/discussion', label: 'Discussion', icon: ChatCircleDots },
  { href: '/guides', label: 'Troubleshooting Guides', icon: BookOpen },
  { href: '/resources', label: 'Videos & Media', icon: PlayCircle },
  { href: '/members', label: 'Members', icon: Users },
  { href: '/booth', label: 'Support Booth', icon: Toolbox },
  { href: '/lostfound', label: 'Lost & Found', icon: MagnifyingGlass },
  { href: '/feedback', label: 'Feedback', icon: ChatTeardropText },
];
export function Shell({
  children,
  initialCollapsed,
  initialTheme,
  initialLogo,
}: {
  children: ReactNode;
  initialCollapsed: boolean;
  initialTheme: 'light' | 'dark';
  initialLogo: string;
}) {
  const [theme, setTheme] = useState(initialTheme);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [logo, setLogo] = useState(initialLogo);
  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    document.cookie = `techcare-theme=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
  }
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [tooltip, setTooltip] = useState<{ label: string; top: number } | null>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const [user, setUserState] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [version, setVersion] = useState(0),
    [authMode, setAuthMode] = useState<AuthMode | null>(null),
    [asking, setAsking] = useState(false),
    [notice, setNotice] = useState(''),
    [menu, setMenu] = useState(false),
    [hero, setHero] = useState('/static/techcare-hero.webp'),
    [classroom, setClassroom] = useState(false);
  const path = usePathname(),
    router = useRouter();
  const refresh = () => setVersion((n) => n + 1);
  const setUser = (u: User | null) => {
    setUserState(u);
    refresh();
  };
  useEffect(() => {
    let alive = true;
    api<{ user: User | null }>('me')
      .then((r) => {
        if (alive) setUserState(r.user);
      })
      .catch(() => {
        if (alive) setNotice('Could not check your session. Refresh the page to try again.');
      })
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    let alive = true;
    api<{ hero: string; classroom: boolean; logo: string }>('settings')
      .then((r) => {
        if (alive) {
          setHero(r.hero);
          setClassroom(r.classroom);
          setLogo(r.logo || '');
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [version]);
  useEffect(() => {
    function expired() {
      setUserState(null);
      setVersion((n) => n + 1);
      setAsking(false);
      setNotice('Your session has expired. Please sign in again.');
    }
    window.addEventListener('techcare-session-expired', expired);
    return () => window.removeEventListener('techcare-session-expired', expired);
  }, []);
  useEffect(() => {
    setMenu(false);
    setTooltip(null);
  }, [path]);
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 901px)');
    const resize = () => {
      setMenu(false);
      setTooltip(null);
    };
    desktop.addEventListener('change', resize);
    return () => desktop.removeEventListener('change', resize);
  }, []);
  useEffect(() => {
    if (!menu) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const sidebar = sidebarRef.current!;
    const focusable = () =>
      Array.from(sidebar.querySelectorAll<HTMLElement>('a[href], button')).filter(
        (element) => element.getClientRects().length > 0,
      );
    focusable()[0]?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMenu(false);
      }
      if (event.key === 'Tab') {
        const items = focusable();
        const first = items[0],
          last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener('keydown', keydown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', keydown);
      menuRef.current?.focus();
    };
  }, [menu]);
  function toggleSidebar() {
    const next = !collapsed;
    setCollapsed(next);
    setTooltip(null);
    document.cookie = `techcare-sidebar=${next ? 'compact' : 'expanded'}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
  }
  function showTooltip(element: HTMLElement, label: string) {
    if (collapsed && window.matchMedia('(min-width: 901px)').matches) {
      const rect = element.getBoundingClientRect();
      setTooltip({ label, top: rect.top + rect.height / 2 });
    }
  }
  const accountNavigation = user
    ? [
        { href: '/profile', label: 'My Dashboard', icon: UserCircle },
        ...(['moderator', 'admin'].includes(user.role)
          ? [{ href: '/moderate', label: 'Moderator', icon: ShieldCheck }]
          : []),
        ...(user.role === 'admin' ? [{ href: '/admin', label: 'Admin', icon: Gear }] : []),
      ]
    : [];
  function navigationLink(item: (typeof navigation)[number], index: number) {
    return (
      <Link
        key={item.href}
        className={`nav-item ${path === item.href || path.startsWith(`${item.href}/`) ? 'active' : ''} ${index === 5 ? 'nav-separated' : ''}`}
        href={item.href}
        aria-label={item.label}
        aria-current={path === item.href || path.startsWith(`${item.href}/`) ? 'page' : undefined}
        onClick={() => {
          setMenu(false);
          setTooltip(null);
        }}
        onMouseEnter={(event) => showTooltip(event.currentTarget, item.label)}
        onMouseLeave={() => setTooltip(null)}
        onFocus={(event) => showTooltip(event.currentTarget, item.label)}
        onBlur={() => setTooltip(null)}
      >
        <span className="nav-icon">
          <item.icon size={22} weight="regular" aria-hidden="true" />
        </span>
        <span className="nav-label">{item.label}</span>
      </Link>
    );
  }
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(''), 9000);
    return () => clearTimeout(timeout);
  }, [notice]);
  const auth = (mode: AuthMode = 'login') => setAuthMode(mode);
  const ask = () => (user ? setAsking(true) : auth());
  async function logout() {
    if (logoutBusy) return;
    setLogoutBusy(true);
    setLogoutError('');
    try {
      await api('logout', {});
      setLogoutOpen(false);
      setUser(null);
      setAsking(false);
      router.push('/');
      setNotice('You have signed out.');
    } catch (e) {
      setLogoutError((e as Error).message);
    } finally {
      setLogoutBusy(false);
    }
  }
  const title =
    navigation.find((n) => n.href === path || path.startsWith(`${n.href}/`))?.label ||
    { profile: 'My Dashboard', moderate: 'Moderator', admin: 'Admin' }[path.slice(1)] ||
    'TechCare';
  const campusScene =
    path === '/'
      ? 'dormitory-courtyard'
      : path === '/booth'
        ? 'covered-walkway'
        : 'campus-building';
  return (
    <Context.Provider
      value={{
        theme,
        user,
        ready,
        version,
        refresh,
        setUser,
        auth,
        ask,
        notify: setNotice,
        hero,
        classroom,
        logo,
        setLogo,
      }}
    >
      <link
        rel="icon"
        type="image/png"
        sizes="64x64"
        href={`/api/branding-icon?v=${encodeURIComponent(logo || 'default')}`}
      />
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <div className="campus-backdrop" aria-hidden="true">
        <img
          className="campus-day"
          src={`/static/campus/${campusScene}.webp`}
          alt=""
          decoding="async"
        />
        <img
          className="campus-night"
          src={`/static/campus/${campusScene}-dark.webp`}
          alt=""
          decoding="async"
        />
      </div>
      {menu && (
        <button
          className="mobile-backdrop"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <aside
        ref={sidebarRef}
        id="primary-navigation"
        className={`sidebar ${menu ? 'open' : ''} ${collapsed ? 'compact' : ''}`}
        aria-label="Main navigation"
        onScrollCapture={() => setTooltip(null)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setTooltip(null);
        }}
      >
        <Link href="/" className="brand" aria-label="TechCare home" onClick={() => setMenu(false)}>
          {logo ? (
            <span className="brand-mark custom-brand">
              <img src={logo} alt="" />
            </span>
          ) : (
            <span className="brand-mark">
              <Monitor size={25} weight="bold" />
              <Heart size={12} weight="fill" />
            </span>
          )}
          <span className="brand-name">
            Tech<span>Care</span>
          </span>
        </Link>
        <button
          className="sidebar-toggle"
          onClick={toggleSidebar}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          aria-controls="main-navigation"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <SidebarSimple size={21} />
          <span>Collapse navigation</span>
        </button>
        <button
          className="icon-button sidebar-close"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        >
          <X size={22} />
        </button>
        <NavigationDock itemCount={navigation.length + accountNavigation.length}>
          {navigation.map(navigationLink)}
          {user && (
            <>
              <div className="sidebar-caption account-caption">MY ACCOUNT</div>
              {accountNavigation.map(navigationLink)}
            </>
          )}
        </NavigationDock>
        <div className="sidebar-bottom">
          <div className="sidebar-help">
            <Heart size={21} weight="regular" />
            <h3>Need a hand?</h3>
            <Link href="/booth" className="action-link" onClick={() => setMenu(false)}>
              <Users size={18} aria-hidden="true" /> Meet the team
            </Link>
          </div>
          <div className="project-note">
            A community service learning project.
            <br />
            Not an official University website.
          </div>
        </div>
      </aside>
      {tooltip && (
        <div className="sidebar-tooltip" role="tooltip" style={{ top: tooltip.top }}>
          {tooltip.label}
        </div>
      )}
      <div className={`app-body ${collapsed ? 'nav-compact' : ''}`} inert={menu}>
        <header className="topbar">
          <div className="breadcrumb">
            <button
              ref={menuRef}
              className="icon-button mobile-menu"
              aria-label={menu ? 'Close navigation' : 'Open navigation'}
              aria-expanded={menu}
              aria-controls="primary-navigation"
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X size={23} /> : <List size={23} />}
            </button>
            <span className="breadcrumb-root">Community</span>
            <span className="breadcrumb-slash">/</span>
            <span>{title}</span>
          </div>
          <div className="topbar-actions">
            <button
              className="icon-button theme-toggle"
              onClick={toggleTheme}
              aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
              {theme === 'light' ? <Moon size={21} /> : <Sun size={21} />}
            </button>
            <Link href="/discussion" className="header-search" aria-label="Search discussions">
              <MagnifyingGlass size={21} />
            </Link>
            {user ? (
              <>
                <Link href="/profile" className="account-button" aria-label="My dashboard">
                  <Avatar user={user} />
                  <span>{user.name.split(' ')[0]}</span>
                </Link>
                <button
                  className="icon-button"
                  onClick={() => {
                    setLogoutError('');
                    setLogoutOpen(true);
                  }}
                  aria-label="Sign out"
                  title="Sign out"
                >
                  <SignOut size={21} />
                </button>
              </>
            ) : (
              <>
                <button className="text-button sign-in" onClick={() => auth()}>
                  Sign In
                </button>
                <button className="button primary small" onClick={() => auth('register')}>
                  <UserPlus size={16} aria-hidden="true" /> Create Account
                </button>
              </>
            )}
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          <div className={`campus-content ${path === '/' ? 'campus-home' : ''}`}>{children}</div>
        </main>
        <footer className="footer">
          <span>TechCare</span>
          <Link href="/privacy" className="action-link">
            <ShieldCheck size={18} aria-hidden="true" /> Privacy & community guidelines
          </Link>
        </footer>
      </div>
      <GuideAssistant key={user?.id ?? 'guest'} onAsk={ask} />
      {notice && (
        <div className="toast" role="status">
          <ShieldCheck size={22} />
          <span>{notice}</span>
          <button
            className="icon-button"
            onClick={() => setNotice('')}
            aria-label="Dismiss notification"
          >
            <X size={18} />
          </button>
        </div>
      )}
      {authMode && (
        <AuthDialog mode={authMode} setMode={setAuthMode} close={() => setAuthMode(null)} />
      )}
      {logoutOpen && user && (
        <Modal
          title="Log out of TechCare?"
          description="You’ll need to sign in again to post, comment, or access your account."
          onClose={() => {
            if (!logoutBusy) setLogoutOpen(false);
          }}
        >
          {logoutError && (
            <p className="error-message" role="alert">
              {logoutError}
            </p>
          )}
          <div className="button-row" aria-busy={logoutBusy}>
            <button
              className="button secondary"
              disabled={logoutBusy}
              onClick={() => setLogoutOpen(false)}
            >
              Cancel
            </button>
            <button className="button primary" disabled={logoutBusy} onClick={logout}>
              <SignOut size={18} aria-hidden="true" />
              {logoutBusy ? 'Logging out…' : 'Log out'}
            </button>
          </div>
        </Modal>
      )}
      {asking && user && (
        <Modal
          title="Ask a Question"
          description="Tell us what happened. A moderator will review your question before it becomes public."
          onClose={() => setAsking(false)}
        >
          <Form
            submit="Submit for review"
            submitDisabled={photoBusy}
            onSubmit={async (values) => {
              const r = await api<Result>('posts', values);
              setAsking(false);
              refresh();
              setNotice(r.message!);
            }}
          >
            <Field
              label="Question title"
              name="title"
              min={8}
              max={120}
              placeholder="What do you need help with?"
            />
            <Select label="Category" name="category" options={categories} />
            <TextArea
              label="Describe the problem"
              name="body"
              min={20}
              max={2000}
              placeholder="Include your device, what happened, and what you have tried. Leave out passwords and personal details."
            />
            <QuestionPhoto onBusyChange={setPhotoBusy} />
            <p className="form-hint">
              Your display name, approved question, and attached photo will be public, even with a
              private profile.
            </p>
          </Form>
        </Modal>
      )}
    </Context.Provider>
  );
}
function AuthDialog({
  mode,
  setMode,
  close,
}: {
  mode: AuthMode;
  setMode: (m: AuthMode) => void;
  close: () => void;
}) {
  const { setUser, notify, classroom } = useTechCare(),
    router = useRouter();
  const [email, setEmail] = useState(''),
    [code, setCode] = useState(''),
    [token, setToken] = useState(''),
    [message, setMessage] = useState('');
  const titles = {
    login: 'Welcome back',
    register: 'Join the TechCare community',
    verify: 'Verify Your Email',
    forgot: 'Forgot your password?',
    reset: 'Choose a new password',
  };
  function change(m: AuthMode) {
    setMessage('');
    setMode(m);
  }
  async function submit(values: FormValues) {
    if (values.email) setEmail(values.email);
    const route = {
      login: 'login',
      register: 'register',
      verify: 'verify',
      forgot: 'forgot-password',
      reset: 'reset-password',
    }[mode];
    const r = await api<Result>(route, values);
    if (mode === 'login') {
      setUser(r.user!);
      close();
      router.push('/profile');
      notify('Welcome back. Your dashboard is ready.');
    }
    if (mode === 'register') {
      setCode(r.development_code || '');
      setMode('verify');
      setMessage(r.message!);
    }
    if (mode === 'verify') {
      setMode('login');
      setCode('');
      setMessage(r.message!);
    }
    if (mode === 'forgot') {
      setMessage(r.message!);
      if (r.development_token) setToken(r.development_token);
    }
    if (mode === 'reset') {
      setUser(null);
      setMode('login');
      setToken('');
      setMessage(r.message!);
    }
  }
  return (
    <Modal
      title={titles[mode]}
      description={
        mode === 'register'
          ? 'A place to ask, learn, and lend a helping hand.'
          : mode === 'verify'
            ? 'Enter the six-digit code sent to your email.'
            : mode === 'login'
              ? 'Sign in to pick up where you left off.'
              : 'Securely recover access to your account.'
      }
      onClose={close}
    >
      {message && <Success>{message}</Success>}
      {classroom && (
        <div className="demo-note">
          Local classroom preview. Email ownership is not verified in this mode.
          {code && <strong> Demo code: {code}</strong>}
          {token && (
            <>
              <br />
              Recovery token: <code className="break-token">{token}</code>
            </>
          )}
        </div>
      )}
      <Form
        key={mode}
        submit={
          {
            login: 'Sign In',
            register: 'Create Account',
            verify: 'Verify email',
            forgot: 'Send recovery instructions',
            reset: 'Reset password',
          }[mode]
        }
        onSubmit={submit}
      >
        {mode === 'register' && (
          <Field label="Display name" name="name" min={2} max={80} autoComplete="name" />
        )}
        {mode !== 'reset' && (
          <Field
            label="Email address"
            name="email"
            type="email"
            max={160}
            value={email}
            autoComplete="email"
          />
        )}
        {['login', 'register', 'reset'].includes(mode) && (
          <Field
            label={mode === 'login' ? 'Password' : 'Password (12 to 128 characters)'}
            name="password"
            type="password"
            min={12}
            max={128}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        )}
        {mode === 'verify' && (
          <Field
            label="Six-digit code"
            name="code"
            inputMode="numeric"
            pattern="[0-9]{6}"
            min={6}
            max={6}
            autoComplete="one-time-code"
          />
        )}
        {mode === 'reset' && (
          <Field
            label="Recovery token from your email"
            name="token"
            min={20}
            max={100}
            value={token}
          />
        )}
        {mode === 'register' && (
          <p className="form-hint">
            Your display name appears on approved public contributions. Please read our{' '}
            <Link href="/privacy" onClick={close}>
              privacy and community guidelines
            </Link>
            .
          </p>
        )}
      </Form>
      <div className="auth-links">
        {mode === 'login' ? (
          <>
            <button className="text-button" onClick={() => change('forgot')}>
              Forgot password?
            </button>
            <button className="text-button" onClick={() => change('verify')}>
              Verify a pending account
            </button>
            <p>
              New here?{' '}
              <button className="text-button" onClick={() => change('register')}>
                Create Account
              </button>
            </p>
          </>
        ) : (
          <>
            <button className="text-button" onClick={() => change('login')}>
              Back to Sign In
            </button>
            {mode === 'forgot' && (
              <button className="text-button" onClick={() => change('reset')}>
                Reset password with a token
              </button>
            )}
            {mode === 'verify' && (
              <Form
                submit="Send a new code"
                onSubmit={async (values) => {
                  setEmail(values.email);
                  const r = await api<Result>('resend-verification', values);
                  setCode(r.development_code || '');
                  setMessage(r.message!);
                }}
              >
                <Field
                  label="Email for a new code"
                  name="email"
                  type="email"
                  value={email}
                  max={160}
                />
              </Form>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

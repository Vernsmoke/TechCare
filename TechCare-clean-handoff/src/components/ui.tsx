'use client';
import {
  createContext,
  useContext,
  useId,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
  type HTMLInputTypeAttribute,
} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  X,
  WarningCircle,
  CheckCircle,
  MagnifyingGlass,
  ChatCircleDots,
} from '@phosphor-icons/react';
import type { FormValues, User } from '@/lib/types';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  data?: FormValues | Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method: data ? 'POST' : 'GET',
    cache: 'no-store',
    headers: data ? { 'Content-Type': 'application/json', 'X-TechCare-Request': '1' } : undefined,
    body: data ? JSON.stringify(data) : undefined,
    signal,
  });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401 && !['login', 'register', 'verify'].includes(path))
      window.dispatchEvent(new Event('techcare-session-expired'));
    throw new ApiError(result.error || 'Something went wrong. Try again.', response.status);
  }
  return result;
}
export function useData<T>(path: string, version = 0) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setData(null);
    setError('');
    api<T>(path, undefined, controller.signal)
      .then(setData)
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [path, version, retry]);
  return { data, error, loading, reload: () => setRetry((n) => n + 1) };
}
export function Modal({
  title,
  description,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const origin = useRef<HTMLElement | null>(
    typeof document !== 'undefined' ? (document.activeElement as HTMLElement) : null,
  );
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className={`dialog-content ${wide ? 'wide' : ''}`}
          aria-describedby={description ? 'modal-description' : undefined}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            origin.current?.focus();
          }}
        >
          <div className="dialog-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              {description && (
                <Dialog.Description id="modal-description">{description}</Dialog.Description>
              )}
            </div>
            <Dialog.Close className="icon-button" aria-label="Close dialog">
              <X size={22} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
async function formValues(form: HTMLFormElement): Promise<FormValues> {
  const entries = await Promise.all(
    [...new FormData(form).entries()].map(async ([key, value]) => {
      if (typeof value === 'string') return [key, value];
      if (!value.size) return [key, ''];
      if (value.size > 20000000) throw new Error('File exceeds 20 MB.');
      const encoded = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Could not read the selected file.'));
        reader.readAsDataURL(value);
      });
      return [key, encoded];
    }),
  );
  return Object.fromEntries(entries);
}
const FormErrors = createContext<Record<string, string>>({});
type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
function inputError(input: Control) {
  if (input.disabled || !input.willValidate) return '';
  const label = input.labels?.[0]?.querySelector('span')?.textContent || input.name || 'This field';
  const value =
    input instanceof HTMLInputElement && input.type === 'password'
      ? input.value
      : input.value.trim();
  if (input instanceof HTMLInputElement && input.type === 'file') {
    const file = input.files?.[0];
    if (!file) return input.required ? `Choose a file for ${label.toLowerCase()}.` : '';
    if (input.accept && !input.accept.split(',').includes(file.type))
      return (
        'Choose a PNG, JPEG, or WebP image' +
        (input.accept.includes('video/') ? ', or an MP4/WebM video.' : '.')
      );
    const maximum = file.type.startsWith('video/') ? 20000000 : 3000000;
    if (file.size > maximum) return `Choose a file smaller than ${maximum / 1000000} MB.`;
    return '';
  }
  if (input.validity.valueMissing || (input.required && !value))
    return `Please enter ${label.toLowerCase()}.`;
  if (!value) return '';
  if (
    input instanceof HTMLInputElement &&
    input.type === 'email' &&
    (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value) || input.validity.typeMismatch)
  )
    return 'Enter a valid email address, such as name@example.com.';
  if (input instanceof HTMLInputElement && input.type === 'url') {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) throw 0;
    } catch {
      return 'Enter a complete HTTPS link, such as https://example.com, without embedded credentials.';
    }
  }
  if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
    if (input.minLength > 0 && value.length < input.minLength)
      return `Use at least ${input.minLength} characters for ${label.toLowerCase()}.`;
    if (input.maxLength > 0 && value.length > input.maxLength)
      return `Keep ${label.toLowerCase()} to ${input.maxLength} characters or fewer.`;
  }
  if (input.validity.patternMismatch)
    return input.name === 'code'
      ? 'Enter the six digits from your verification email.'
      : `Check the format of ${label.toLowerCase()}.`;
  if (!input.validity.valid) return `Enter a valid value for ${label.toLowerCase()}.`;
  return '';
}
function useFieldError(name: string) {
  const errors = useContext(FormErrors);
  const id = useId();
  return { error: errors[name], id, errorId: `${id}-error` };
}
function FieldError({ id, error }: { id: string; error?: string }) {
  return error ? (
    <span className="field-error" id={id} role="alert">
      <WarningCircle size={16} />
      {error}
    </span>
  ) : null;
}
export function Form({
  children,
  submit,
  onSubmit,
  reset = false,
  className = '',
  submitDisabled = false,
}: {
  children: ReactNode;
  submit: string;
  onSubmit: (values: FormValues) => Promise<void>;
  reset?: boolean;
  className?: string;
  submitDisabled?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const lock = useRef(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const attempted = useRef(false);
  function validateTarget(target: EventTarget, blur = false) {
    if (
      !(
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) ||
      !target.name
    )
      return;
    if (blur || attempted.current || errors[target.name])
      setErrors((previous) => ({ ...previous, [target.name]: inputError(target) }));
  }
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || submitDisabled) return;
    const form = event.currentTarget;
    attempted.current = true;
    const invalid: Record<string, string> = {};
    let first: Control | undefined;
    for (const control of Array.from(form.elements)) {
      if (
        !(
          control instanceof HTMLInputElement ||
          control instanceof HTMLTextAreaElement ||
          control instanceof HTMLSelectElement
        ) ||
        !control.name
      )
        continue;
      const message = inputError(control);
      if (message) {
        invalid[control.name] = message;
        first ??= control;
      }
    }
    setErrors(invalid);
    setError('');
    if (first) {
      first.focus();
      return;
    }
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await onSubmit(await formValues(form));
      if (reset) {
        form.reset();
        setErrors({});
        attempted.current = false;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please try again.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <FormErrors.Provider value={errors}>
      <form
        noValidate
        onSubmit={send}
        onBlur={(event) => validateTarget(event.target, true)}
        onInput={(event) => {
          validateTarget(event.target);
          setError('');
        }}
        onChange={(event) => validateTarget(event.target)}
        className={`form ${className}`}
      >
        <fieldset disabled={busy}>
          {children}
          {error && (
            <div className="error-message" role="alert">
              <WarningCircle size={19} />
              {error}
            </div>
          )}
          <button className="button primary" type="submit" disabled={submitDisabled}>
            {busy ? 'Please wait…' : submit}
          </button>
        </fieldset>
      </form>
    </FormErrors.Provider>
  );
}
export function Field({
  label,
  name,
  type = 'text',
  min,
  max,
  required = true,
  value,
  placeholder,
  autoComplete,
  pattern,
  inputMode,
}: {
  label: string;
  name: string;
  type?: HTMLInputTypeAttribute;
  min?: number;
  max?: number;
  required?: boolean;
  value?: string;
  placeholder?: string;
  autoComplete?: string;
  pattern?: string;
  inputMode?: 'text' | 'numeric' | 'email' | 'url';
}) {
  const { error, id, errorId } = useFieldError(name);
  return (
    <label className="field">
      <span id={`${id}-label`}>{label}</span>
      <input
        aria-labelledby={`${id}-label`}
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        pattern={pattern}
        inputMode={inputMode}
        name={name}
        type={type}
        minLength={min}
        maxLength={max}
        required={required}
        defaultValue={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
      <FieldError id={errorId} error={error} />
    </label>
  );
}
export function TextArea({
  label,
  name,
  min = 0,
  max = 1000,
  value = '',
  required = true,
  placeholder,
}: {
  label: string;
  name: string;
  min?: number;
  max?: number;
  value?: string;
  required?: boolean;
  placeholder?: string;
}) {
  const { error, id, errorId } = useFieldError(name);
  return (
    <label className="field">
      <span id={`${id}-label`}>{label}</span>
      <textarea
        aria-labelledby={`${id}-label`}
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        name={name}
        minLength={min}
        maxLength={max}
        defaultValue={value}
        required={required}
        rows={4}
        placeholder={placeholder}
      />
      <FieldError id={errorId} error={error} />
    </label>
  );
}
export function Select({
  label,
  name,
  options,
  value,
}: {
  label: string;
  name: string;
  options: string[];
  value?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select name={name} defaultValue={value}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
export function Upload({
  name = 'file',
  label = 'Image',
  video = false,
  required = false,
  onChange,
}: {
  name?: string;
  label?: string;
  video?: boolean;
  required?: boolean;
  onChange?: (file: File | null) => void;
}) {
  const { error, id, errorId } = useFieldError(name);
  return (
    <label className="field">
      <span id={`${id}-label`}>{label}</span>
      <input
        aria-labelledby={`${id}-label`}
        id={id}
        aria-invalid={!!error}
        aria-describedby={`${id}-hint${error ? ` ${errorId}` : ''}`}
        onChange={(event) => onChange?.(event.target.files?.[0] || null)}
        type="file"
        name={name}
        accept={
          video
            ? 'image/png,image/jpeg,image/webp,video/mp4,video/webm'
            : 'image/png,image/jpeg,image/webp'
        }
        required={required}
      />
      <small id={`${id}-hint`}>
        {video ? 'Images up to 3 MB; MP4/WebM up to 20 MB.' : 'PNG, JPEG, or WebP. Up to 3 MB.'}
      </small>
      <FieldError id={errorId} error={error} />
    </label>
  );
}
export function Avatar({
  user,
  large = false,
}: {
  user: Pick<User, 'name' | 'avatar'>;
  large?: boolean;
}) {
  return user.avatar ? (
    <img className={`avatar ${large ? 'large' : ''}`} src={user.avatar} alt="" />
  ) : (
    <span className={`avatar ${large ? 'large' : ''}`} aria-hidden="true">
      {user.name
        .split(' ')
        .slice(0, 2)
        .map((n) => n[0])
        .join('')}
    </span>
  );
}
export function Badge({ children, tone = '' }: { children: ReactNode; tone?: string }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <ChatCircleDots size={32} weight="regular" />
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading-state" role="status" aria-label="Loading">
      <div />
      <div />
      <div />
    </div>
  );
}
export function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="error-message" role="alert">
      <WarningCircle size={22} />
      <span>{message}</span>
      <button className="text-button" onClick={retry}>
        Try again
      </button>
    </div>
  );
}
export function Search({
  placeholder,
  onSearch,
  value = '',
}: {
  placeholder: string;
  onSearch: (value: string) => void;
  value?: string;
}) {
  return (
    <form
      className="search-field"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(String(new FormData(e.currentTarget).get('q') || ''));
      }}
    >
      <MagnifyingGlass size={20} />
      <input
        key={value}
        name="q"
        type="search"
        maxLength={80}
        placeholder={placeholder}
        aria-label={placeholder}
        defaultValue={value}
      />
      <button type="submit" className="text-button">
        Search
      </button>
    </form>
  );
}
export function Success({ children }: { children: ReactNode }) {
  return (
    <div className="success-message" role="status">
      <CheckCircle size={21} />
      <span>{children}</span>
    </div>
  );
}
export function PageHeading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function Pagination({
  page,
  hasMore,
  onPage,
}: {
  page: number;
  hasMore: boolean;
  onPage: (page: number) => void;
}) {
  if (page === 1 && !hasMore) return null;
  return (
    <div className="pagination">
      <button className="button secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <span>Page {page}</span>
      <button className="button secondary" disabled={!hasMore} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </div>
  );
}
export function date(time: number) {
  return new Date(time * 1000).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

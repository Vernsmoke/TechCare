'use client';
import { useEffect, useState } from 'react';
import { useTechCare } from '@/context/techcare-context';
import { Form, Upload } from '../ui/ui';
import { api } from '@/services/api';

export function LogoSettings() {
  const { logo, setLogo, refresh, notify } = useTechCare();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (
      !file ||
      file.size > 3000000 ||
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
    ) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  async function save(values: Record<string, unknown>) {
    setBusy(true);
    setError('');
    try {
      const result = await api<{ logo: string; message: string }>('admin/logo', values);
      setLogo(result.logo);
      setFile(null);
      refresh();
      notify(result.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel logo-settings">
      <h2>App logo</h2>
      <p>Choose a logo for the navigation and browser tab. Your image keeps its proportions.</p>
      <div className="logo-preview">
        <img
          src={preview || logo || '/static/techcare-logo.png'}
          alt={preview ? 'Selected logo preview' : 'Current app logo'}
        />
        <span>{preview ? 'Preview — save to apply' : 'Current logo'}</span>
      </div>
      <fieldset disabled={busy}>
        <Form key={logo} submit="Save logo" reset onSubmit={save}>
          <Upload required label="New app logo" onChange={setFile} />
        </Form>
        {logo && (
          <button
            className="button secondary"
            disabled={busy}
            onClick={async () => {
              try {
                await save({ restore: true });
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Restore original logo
          </button>
        )}
      </fieldset>
      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}
    </section>
  );
}

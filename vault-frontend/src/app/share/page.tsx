'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Clock, Lock, ShieldCheck } from 'lucide-react';
import { resolveApiBase } from '../../lib/mobile-adapters';

export default function SharedRecordPage() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token') || '';
    if (!token) {
      setData({ error: 'Share token missing from URL.' });
      setStatus('error');
      return;
    }
    const apiBase = resolveApiBase();
    fetch(`${apiBase}/health-suite/shares/${encodeURIComponent(token)}`)
      .then(async (res) => ({ ok: res.ok, body: await res.json() }))
      .then(({ ok, body }) => {
        if (!ok) throw new Error(body.error || 'Share unavailable');
        setData(body);
        setStatus('ready');
      })
      .catch((error) => {
        setData({ error: error.message });
        setStatus('error');
      });
  }, []);

  return (
    <main className="min-h-screen bg-ch-bg text-ch-text flex items-center justify-center p-4">
      <section className="w-full max-w-md rounded-lg border border-ch-border bg-ch-surface overflow-hidden shadow-2xl">
        <header className="flex items-center gap-2 px-4 py-3 border-b border-ch-border bg-ch-bg">
          <ShieldCheck className="w-4 h-4 text-ch-green" />
          <span className="text-xs font-mono text-ch-text-bright">HEALTHVAULT SECURE SHARE</span>
        </header>
        <div className="p-5">
          {status === 'loading' && <div className="text-xs font-mono text-ch-text-dim">Verifying share token...</div>}
          {status === 'error' && (
            <div className="flex gap-2 rounded-md border border-ch-red/30 bg-ch-red/10 p-3 text-xs font-mono text-ch-red">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {data?.error}
            </div>
          )}
          {status === 'ready' && (
            <div className="space-y-4">
              <div className="rounded-md border border-ch-border bg-ch-bg p-3">
                <div className="text-[10px] font-mono text-ch-text-dim">SHARED RECORD</div>
                <div className="mt-1 text-sm font-mono text-ch-text-bright break-all">{data.record?.originalName}</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border border-ch-border bg-ch-bg p-3">
                  <Clock className="w-3.5 h-3.5 text-ch-yellow mb-2" />
                  <div className="text-[9px] font-mono text-ch-text-dim">EXPIRES</div>
                  <div className="mt-1 text-[10px] font-mono text-ch-text-bright">{new Date(data.share.expiresAt).toLocaleString()}</div>
                </div>
                <div className="rounded-md border border-ch-border bg-ch-bg p-3">
                  <Lock className="w-3.5 h-3.5 text-ch-green mb-2" />
                  <div className="text-[9px] font-mono text-ch-text-dim">CONTENT</div>
                  <div className="mt-1 text-[10px] font-mono text-ch-text-bright">AES encrypted</div>
                </div>
              </div>
              <p className="text-[10px] font-mono text-ch-text-dim leading-relaxed">
                This link does not expose the encrypted document directly. Record access still requires the original passphrase in the vault interface.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

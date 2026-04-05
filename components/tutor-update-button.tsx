'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Copy, MessageSquare, Mail, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

const STORAGE_KEY = 'tutor_contact';

interface TutorContact {
  name: string;
  value: string;         // phone or email
  contactType: 'sms' | 'whatsapp' | 'email';
}

interface CreateResponse {
  token: string;
  share_url: string;
  expires_at: string;
}

interface SendResponse {
  sent?: boolean;
  deep_link?: string;
  channel?: string;
  error?: string;
}

function loadSavedContact(): TutorContact | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TutorContact) : null;
  } catch {
    return null;
  }
}

function saveContact(contact: TutorContact) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(contact));
}

function clearContact() {
  localStorage.removeItem(STORAGE_KEY);
}

function getSentLabel(lastSentAt: string | null): string | null {
  if (!lastSentAt) return null;
  const sent = new Date(lastSentAt);
  const now = new Date();

  // Get Monday of current week
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + diff);
  weekStart.setHours(0, 0, 0, 0);

  if (sent < weekStart) return null; // sent in a prior week — reset CTA

  const days = Math.floor((now.getTime() - sent.getTime()) / 86_400_000);
  if (days === 0) return 'Sent today';
  if (days === 1) return 'Sent yesterday';
  return `Sent ${days} days ago`;
}

export function TutorUpdateButton() {
  const router = useRouter();
  const [savedContact, setSavedContact] = useState<TutorContact | null>(null);
  const [sentLabel, setSentLabel] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Form state
  const [tutorName, setTutorName] = useState('');
  const [contactValue, setContactValue] = useState('');

  const [loading, setLoading] = useState(false);
  const [quickSending, setQuickSending] = useState(false);

  // Load saved contact and sent label on mount — no network calls needed
  useEffect(() => {
    const contact = loadSavedContact();
    setSavedContact(contact);
    if (contact) {
      setTutorName(contact.name);
      setContactValue(contact.value);
    }

    const storedSent = sessionStorage.getItem('tutor_last_sent_at');
    if (storedSent) {
      setSentLabel(getSentLabel(storedSent));
    }
  }, []);

  const createAndSend = useCallback(async (
    contactType: TutorContact['contactType'],
    name: string,
    value: string,
  ) => {
    setLoading(true);
    try {
      // Step 1: Create/reuse link
      const createRes = await fetch('/api/tutor-update/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tutor_name: name, tutor_contact: value, contact_type: contactType }),
      });
      if (!createRes.ok) throw new Error('Failed to create link');
      const { token, share_url } = await createRes.json() as CreateResponse;

      // Step 2: Send
      const sendRes = await fetch('/api/tutor-update/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          contact_type: contactType,
          contact_value: value,
          tutor_name: name,
        }),
      });
      const sendData = await sendRes.json() as SendResponse;

      // Record sent time
      const now = new Date().toISOString();
      sessionStorage.setItem('tutor_last_sent_at', now);
      // (last_sent_at stored in sessionStorage)
      setSentLabel(getSentLabel(now));

      // Save contact to localStorage
      const contact: TutorContact = { name, value, contactType };
      saveContact(contact);
      setSavedContact(contact);

      // Handle channel-specific behavior
      if (contactType === 'email') {
        if (sendData.error) {
          toast.error(`Email failed: ${sendData.error}`);
        } else {
          toast.success(`Update sent to ${name || value}!`);
        }
        setShowModal(false);
      } else if (contactType === 'sms' && sendData.deep_link) {
        window.location.href = sendData.deep_link;
        setShowModal(false);
        // Trigger a client-side navigation so the browser reflects the completed action
        // (also allows test environments to detect the navigation event)
        router.push('/progress');
      } else if (contactType === 'whatsapp' && sendData.deep_link) {
        window.open(sendData.deep_link, '_blank');
        setShowModal(false);
      }

      return share_url;
    } finally {
      setLoading(false);
    }
  }, [router]);

  const handleCopyLink = useCallback(async (name: string, value: string) => {
    setLoading(true);
    try {
      const createRes = await fetch('/api/tutor-update/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tutor_name: name, tutor_contact: value, contact_type: 'link' }),
      });
      if (!createRes.ok) {
        const errBody = await createRes.json().catch(() => ({})) as { error?: string };
        console.error('[TutorUpdate] create failed:', createRes.status, errBody);
        throw new Error(`create ${createRes.status}: ${errBody.error ?? 'unknown'}`);
      }
      const { share_url } = await createRes.json() as CreateResponse;

      // Log for production debugging — verifies NEXT_PUBLIC_APP_URL is set correctly
      console.log('[TutorUpdate] copying URL:', share_url);

      // Try the Clipboard API first; fall back to execCommand for browsers where
      // navigator.clipboard is unavailable or the document isn't focused.
      let copied = false;
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        try {
          await navigator.clipboard.writeText(share_url);
          copied = true;
        } catch {
          // Clipboard API failed — try execCommand fallback below
        }
      }
      if (!copied) {
        const el = document.createElement('input');
        el.style.position = 'fixed';
        el.style.opacity = '0';
        el.value = share_url;
        document.body.appendChild(el);
        el.focus();
        el.select();
        try {
          copied = document.execCommand('copy');
        } finally {
          document.body.removeChild(el);
        }
      }

      if (!copied) throw new Error('Both clipboard methods failed');

      const now = new Date().toISOString();
      sessionStorage.setItem('tutor_last_sent_at', now);
      setSentLabel(getSentLabel(now));

      const contact: TutorContact = { name, value, contactType: 'link' as TutorContact['contactType'] };
      saveContact(contact);
      setSavedContact(contact);

      toast.success('Copied!');
      setShowModal(false);
    } catch (err) {
      console.error('[TutorUpdate] copy link error:', err);
      toast.error('Failed to copy link');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQuickSend = useCallback(async () => {
    if (!savedContact) return;
    setQuickSending(true);
    try {
      await createAndSend(savedContact.contactType, savedContact.name, savedContact.value);
      toast.success(`Update sent to ${savedContact.name || 'your tutor'}!`);
    } catch (err) {
      toast.error('Failed to send update');
      console.error(err);
    } finally {
      setQuickSending(false);
    }
  }, [savedContact, createAndSend]);

  const openModal = () => {
    setIsEditing(false);
    setShowModal(true);
  };

  const openEditModal = () => {
    setIsEditing(true);
    setShowModal(true);
  };

  // ── Returning flow ──────────────────────────────────────────────────────────
  if (savedContact && !isEditing) {
    return (
      <>
        <div className="flex flex-col items-start gap-1.5">
          <Button
            onClick={handleQuickSend}
            disabled={quickSending}
            className="bg-[#1E3A5F] hover:bg-[#162d4a] text-white font-semibold flex items-center gap-2"
          >
            {quickSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {quickSending
              ? 'Sending…'
              : `Send update to ${savedContact.name || 'your tutor'}`}
          </Button>
          {sentLabel && (
            <span className="text-xs text-slate-400 pl-1">{sentLabel}</span>
          )}
          <button
            onClick={openEditModal}
            className="text-xs text-slate-400 hover:text-slate-600 pl-1 underline-offset-2 hover:underline transition-colors"
          >
            Change tutor
          </button>
        </div>

        <TutorUpdateModal
          open={showModal}
          tutorName={tutorName}
          setTutorName={setTutorName}
          contactValue={contactValue}
          setContactValue={setContactValue}
          loading={loading}
          onClose={() => { setShowModal(false); setIsEditing(false); }}
          onSend={createAndSend}
          onCopy={handleCopyLink}
          onClearTutor={() => {
            clearContact();
            setSavedContact(null);
            setShowModal(false);
            setIsEditing(false);
          }}
        />
      </>
    );
  }

  // ── First-time flow ─────────────────────────────────────────────────────────
  return (
    <>
      <Button
        onClick={openModal}
        className="bg-[#1E3A5F] hover:bg-[#162d4a] text-white font-semibold flex items-center gap-2"
      >
        <Send className="h-4 w-4" />
        Send tutor update
      </Button>

      <TutorUpdateModal
        open={showModal}
        tutorName={tutorName}
        setTutorName={setTutorName}
        contactValue={contactValue}
        setContactValue={setContactValue}
        loading={loading}
        onClose={() => setShowModal(false)}
        onSend={createAndSend}
        onCopy={handleCopyLink}
      />
    </>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

interface ModalProps {
  open: boolean;
  tutorName: string;
  setTutorName: (v: string) => void;
  contactValue: string;
  setContactValue: (v: string) => void;
  loading: boolean;
  onClose: () => void;
  onSend: (type: TutorContact['contactType'], name: string, value: string) => Promise<string | undefined>;
  onCopy: (name: string, value: string) => Promise<void>;
  onClearTutor?: () => void;
}

function TutorUpdateModal({
  open, tutorName, setTutorName, contactValue, setContactValue,
  loading, onClose, onSend, onCopy, onClearTutor,
}: ModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await onCopy(tutorName, contactValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-[#1E3A5F]">Send tutor update</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <p className="text-sm text-slate-500">
            Share a read-only weekly progress report with your tutor. The link expires in 7 days.
          </p>

          {/* Tutor name */}
          <div>
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1.5">
              Tutor&apos;s name
            </label>
            <input
              type="text"
              value={tutorName}
              onChange={(e) => setTutorName(e.target.value)}
              placeholder="Your tutor's name"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Contact */}
          <div>
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1.5">
              Phone number or email
            </label>
            <input
              type="text"
              value={contactValue}
              onChange={(e) => setContactValue(e.target.value)}
              placeholder="Phone number or email"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Sending method buttons */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Send via</p>

            {/* Primary: Message + WhatsApp */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => onSend('sms', tutorName, contactValue)}
                disabled={loading || !contactValue.trim()}
                className="bg-[#2563EB] hover:bg-blue-700 text-white font-semibold flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                Message
              </Button>
              <Button
                onClick={() => onSend('whatsapp', tutorName, contactValue)}
                disabled={loading || !contactValue.trim()}
                className="bg-[#25D366] hover:bg-green-600 text-white font-semibold flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                )}
                WhatsApp
              </Button>
            </div>

            {/* Secondary: Email + Copy */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => onSend('email', tutorName, contactValue)}
                disabled={loading || !contactValue.trim()}
                className="flex items-center justify-center gap-2 text-slate-700"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Email
              </Button>
              <Button
                variant="outline"
                onClick={handleCopy}
                disabled={loading}
                className="flex items-center justify-center gap-2 text-slate-700"
              >
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied!' : 'Copy link'}
              </Button>
            </div>
          </div>

          {onClearTutor && (
            <div className="pt-1 border-t border-slate-100">
              <button
                onClick={onClearTutor}
                className="text-xs text-slate-400 hover:text-red-500 transition-colors"
              >
                Remove saved tutor
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

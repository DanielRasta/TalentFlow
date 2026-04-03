import { useState } from 'react';
import toast from 'react-hot-toast';
import { logIntroduction } from '../lib/api';

interface EmailPreviewProps {
  matchId: number;
  to: string;
  subject: string;
  body: string;
  onClose: () => void;
  onSent?: () => void;
}

export default function EmailPreview({
  matchId,
  to,
  subject: initialSubject,
  body: initialBody,
  onClose,
  onSent,
}: EmailPreviewProps) {
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [logging, setLogging] = useState(false);
  const [logged, setLogged] = useState(false);

  const handleOpenInMail = async () => {
    // Log the introduction
    if (!logged) {
      setLogging(true);
      try {
        await logIntroduction({ match_id: matchId, to_email: to, subject, body });
        setLogged(true);
        toast.success('Introduction logged successfully');
        onSent?.();
      } catch (err) {
        toast.error('Failed to log introduction');
      } finally {
        setLogging(false);
      }
    }

    // Open mailto
    const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailto, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Email Preview</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-4">
          {/* To */}
          <div>
            <label className="label">To</label>
            <div className="input bg-slate-50 text-slate-600">{to || 'No email on file'}</div>
          </div>

          {/* Subject */}
          <div>
            <label className="label">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="input"
            />
          </div>

          {/* Body */}
          <div>
            <label className="label">Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              className="input resize-none font-mono text-xs leading-relaxed"
            />
          </div>

          {logged && (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 px-3 py-2 rounded-lg text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Introduction logged
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleOpenInMail}
            disabled={logging}
            className="btn-primary"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {logging ? 'Logging...' : 'Open in Mail'}
          </button>
        </div>
      </div>
    </div>
  );
}

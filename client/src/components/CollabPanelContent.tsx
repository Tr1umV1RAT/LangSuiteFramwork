import { useState } from 'react';
import { useAppStore } from '../store';
import { Users, Copy, LogIn, LogOut, Plus, Check } from 'lucide-react';

const USER_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#ef4444', '#84cc16'];

export default function CollabPanelContent() {
  const {
    sessionId,
    username,
    setUsername,
    connectedUsers,
    createSession,
    joinSession,
    leaveSession,
  } = useAppStore();

  const [joinId, setJoinId] = useState('');
  const [copied, setCopied] = useState(false);

  const copySessionId = () => {
    if (sessionId) {
      navigator.clipboard.writeText(sessionId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleJoin = () => {
    if (joinId.trim()) {
      joinSession(joinId.trim());
      setJoinId('');
    }
  };

  return (
    <>
      <div className="flex items-center justify-between px-3 py-2 border-b border-panel-border shrink-0">
        <div className="flex items-center gap-2">
          <Users size={13} className="text-blue-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Collaboration
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-3 scrollbar-thin">
        <div className="rounded-lg border border-panel-border bg-black/20 px-2.5 py-2 text-[11px] leading-5 text-slate-500">
          Session sync currently shares the root workspace tree plus known child tabs. Displayed names are session aliases only, not authenticated identities. It does not sync runtime DB contents, vector stores, or a full multi-user permission model.
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider">Alias de session</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Alias local non authentifié"
            className="w-full bg-black/20 border border-panel-border rounded px-2 py-1.5
              text-xs text-white outline-none focus:border-blue-500"
          />
        </div>

        {!sessionId ? (
          <div className="space-y-3">
            <button
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg
                bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 text-xs font-medium transition-all"
              onClick={createSession}
            >
              <Plus size={12} />
              Créer une session
            </button>

            <div className="flex items-center gap-2 text-[10px] text-slate-600">
              <div className="flex-1 h-px bg-panel-border" />
              <span>ou</span>
              <div className="flex-1 h-px bg-panel-border" />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-500 uppercase tracking-wider">
                Rejoindre une session
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={joinId}
                  onChange={(e) => setJoinId(e.target.value)}
                  placeholder="ID de session"
                  onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                  className="flex-1 bg-black/20 border border-panel-border rounded px-2 py-1.5
                    text-xs text-white outline-none focus:border-blue-500"
                />
                <button
                  className="w-8 h-8 rounded-lg flex items-center justify-center
                    bg-panel-hover text-slate-400 hover:text-white transition-all"
                  onClick={handleJoin}
                >
                  <LogIn size={12} />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500 uppercase tracking-wider">
                Session active
              </label>
              <div className="flex items-center gap-1.5">
                <code className="flex-1 text-[10px] bg-black/30 px-2 py-1.5 rounded border border-panel-border
                  text-emerald-300 font-mono truncate">
                  {sessionId}
                </code>
                <button
                  className="w-7 h-7 rounded flex items-center justify-center
                    text-slate-500 hover:text-white hover:bg-panel-hover transition-all"
                  onClick={copySessionId}
                  title="Copier"
                >
                  {copied ? <Check size={11} /> : <Copy size={11} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-500 uppercase tracking-wider">
                Connectés ({connectedUsers.length})
              </label>
              <div className="space-y-1">
                {connectedUsers.map((user, idx) => (
                  <div key={idx} className="flex items-center gap-2 py-1">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                      style={{ background: USER_COLORS[idx % USER_COLORS.length] }}
                    >
                      {user.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs text-slate-300">{user}</span>
                    {user === username && (
                      <span className="text-[9px] text-slate-500">(vous)</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <button
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg
                bg-red-500/15 text-red-400 hover:bg-red-500/25 text-xs font-medium transition-all"
              onClick={leaveSession}
            >
              <LogOut size={12} />
              Quitter la session
            </button>
          </div>
        )}
      </div>
    </>
  );
}

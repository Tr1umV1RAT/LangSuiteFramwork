import { useAppStore } from '../store';
import { X } from 'lucide-react';
import CollabPanelContent from './CollabPanelContent';

export default function CollabPanel() {
  const collabOpen = useAppStore((s) => s.collabOpen);
  const toggleCollab = useAppStore((s) => s.toggleCollab);

  if (!collabOpen) return null;

  return (
    <div className="fixed top-14 right-4 z-50 w-72 glass border border-panel-border rounded-xl
      shadow-2xl shadow-black/50 flex flex-col overflow-hidden"
      style={{ maxHeight: 'calc(100vh - 80px)' }}
    >
      <div className="absolute top-2 right-2 z-10">
        <button
          onClick={toggleCollab}
          className="w-6 h-6 rounded flex items-center justify-center
            text-slate-500 hover:text-white hover:bg-panel-hover transition-all"
        >
          <X size={12} />
        </button>
      </div>
      <CollabPanelContent />
    </div>
  );
}

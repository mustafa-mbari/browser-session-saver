import { useState, useEffect, useCallback } from 'react';
import { Plus, Sparkles, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import type {
  Prompt,
  PromptCategory,
  PromptFolder,
  PromptsNavState,
  PromptTag,
} from '@core/types/prompt.types';

type FolderUpdates = Partial<Pick<PromptFolder, 'name' | 'color'>>;
import { PromptStorage } from '@core/storage/prompt-storage';
import { PromptService } from '@core/services/prompt.service';
import { generateId } from '@core/utils/uuid';
import PromptList from '../components/prompts/PromptList';
import PromptForm from '../components/prompts/PromptForm';
import PromptCard from '../components/prompts/PromptCard';
import PromptVariablesModal from '../components/prompts/PromptVariablesModal';
import PromptSectionNav from '../components/prompts/PromptSectionNav';

export default function PromptsView() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [categories, setCategories] = useState<PromptCategory[]>([]);
  const [tags, setTags] = useState<PromptTag[]>([]);
  const [folders, setFolders] = useState<PromptFolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [nav, setNav] = useState<PromptsNavState>({ kind: 'section', key: 'all' });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userToggled, setUserToggled] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editPrompt, setEditPrompt] = useState<Prompt | null>(null);
  const [variablesPrompt, setVariablesPrompt] = useState<Prompt | null>(null);

  useEffect(() => {
    void Promise.all([
      PromptStorage.getAll(),
      PromptStorage.getCategories(),
      PromptStorage.getTags(),
      PromptStorage.getFolders(),
    ]).then(([p, c, t, f]) => {
      setPrompts(p);
      setCategories(c);
      setTags(t);
      setFolders(f);
      setIsLoading(false);
    });
  }, []);

  const [hintAnimate, setHintAnimate] = useState(false);

  // Auto-collapse sidebar after 1s on first open so user sees it can be toggled
  useEffect(() => {
    if (userToggled) return;
    const timer = setTimeout(() => {
      setSidebarOpen(false);
      setHintAnimate(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, [userToggled]);

  // Stop the hint animation after 3s
  useEffect(() => {
    if (!hintAnimate) return;
    const timer = setTimeout(() => setHintAnimate(false), 3000);
    return () => clearTimeout(timer);
  }, [hintAnimate]);

  // ── Prompt CRUD ───────────────────────────────────────────────────────────

  const handleSave = useCallback(async (prompt: Prompt) => {
    await PromptStorage.save(prompt);
    setPrompts((prev) => {
      const idx = prev.findIndex((p) => p.id === prompt.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = prompt; return next; }
      return [...prev, prompt];
    });
    setFormOpen(false);
    setEditPrompt(null);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    await PromptStorage.delete(id);
    setPrompts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleToggleFavorite = useCallback(async (id: string) => {
    const prompt = prompts.find((p) => p.id === id);
    if (!prompt) return;
    await PromptStorage.update(id, { isFavorite: !prompt.isFavorite });
    setPrompts((prev) => prev.map((p) => p.id === id ? { ...p, isFavorite: !p.isFavorite } : p));
  }, [prompts]);

  const handleTogglePin = useCallback(async (id: string) => {
    const prompt = prompts.find((p) => p.id === id);
    if (!prompt) return;
    await PromptStorage.update(id, { isPinned: !prompt.isPinned });
    setPrompts((prev) => prev.map((p) => p.id === id ? { ...p, isPinned: !p.isPinned } : p));
  }, [prompts]);

  const handleCopy = useCallback(async (id: string) => {
    await PromptStorage.trackUsage(id);
    setPrompts((prev) => prev.map((p) =>
      p.id === id ? { ...p, usageCount: p.usageCount + 1, lastUsedAt: new Date().toISOString() } : p,
    ));
  }, []);

  const handleUse = useCallback((prompt: Prompt) => {
    const vars = PromptService.extractVariables(prompt.content);
    if (vars.length > 0) {
      setVariablesPrompt(prompt);
    } else {
      void navigator.clipboard.writeText(prompt.content);
      void handleCopy(prompt.id);
    }
  }, [handleCopy]);

  // ── Folder CRUD ───────────────────────────────────────────────────────────

  const handleCreateFolder = useCallback(async (name: string, parentId?: string, source: 'local' | 'app' = 'local'): Promise<PromptFolder> => {
    const siblings = folders.filter(
      (f) => f.source === source && (f.parentId ?? null) === (parentId ?? null),
    );
    const folder: PromptFolder = {
      id: generateId(),
      name,
      source,
      parentId,
      position: siblings.length,
      createdAt: new Date().toISOString(),
    };
    await PromptStorage.saveFolder(folder);
    setFolders((prev) => [...prev, folder]);
    return folder;
  }, [folders]);

  const handleUpdateFolder = useCallback(async (id: string, updates: FolderUpdates) => {
    const folder = folders.find((f) => f.id === id);
    if (!folder) return;
    const updated = { ...folder, ...updates };
    await PromptStorage.saveFolder(updated);
    setFolders((prev) => prev.map((f) => f.id === id ? updated : f));
  }, [folders]);

  const handleDeleteFolder = useCallback(async (id: string) => {
    await PromptStorage.deleteFolder(id);
    setFolders((prev) => prev.filter((f) => f.id !== id));
    setPrompts((prev) => prev.map((p) => p.folderId === id ? { ...p, folderId: undefined } : p));
    // If deleted folder was active, go back to source root
    if (nav.kind === 'source' && nav.folderId === id) {
      setNav({ kind: 'source', source: nav.source });
    }
  }, [folders, nav]);

  const handleMoveFolder = useCallback(async (id: string, newParentId: string | undefined) => {
    const folder = folders.find((f) => f.id === id);
    if (!folder) return;
    const siblings = folders.filter(
      (f) => (f.parentId ?? undefined) === newParentId && f.id !== id,
    );
    const updated: PromptFolder = { ...folder, parentId: newParentId, position: siblings.length };
    await PromptStorage.saveFolder(updated);
    setFolders((prev) => prev.map((f) => f.id === id ? updated : f));
  }, [folders]);

  // ── Tag / Category CRUD ───────────────────────────────────────────────────

  const handleCreateTag = useCallback(async (name: string): Promise<PromptTag> => {
    const tag: PromptTag = {
      id: generateId(),
      name,
      color: `hsl(${Math.floor(Math.random() * 360)}, 65%, 55%)`,
    };
    await PromptStorage.saveTag(tag);
    setTags((prev) => [...prev, tag]);
    return tag;
  }, []);

  const handleCreateCategory = useCallback(async (name: string): Promise<PromptCategory> => {
    const cat: PromptCategory = {
      id: generateId(),
      name,
      icon: '📁',
      color: '#6b7280',
      createdAt: new Date().toISOString(),
    };
    await PromptStorage.saveCategory(cat);
    setCategories((prev) => [...prev, cat]);
    return cat;
  }, []);

  const [seeding, setSeeding] = useState(false);

  const handleSeedDemoData = useCallback(async () => {
    setSeeding(true);
    await PromptStorage.seedDemoData();
    const [p, c, t, f] = await Promise.all([
      PromptStorage.getAll(),
      PromptStorage.getCategories(),
      PromptStorage.getTags(),
      PromptStorage.getFolders(),
    ]);
    setPrompts(p);
    setCategories(c);
    setTags(t);
    setFolders(f);
    setSeeding(false);
  }, []);

  const openAdd = () => { setEditPrompt(null); setFormOpen(true); };
  const openEdit = (p: Prompt) => { setEditPrompt(p); setFormOpen(true); };
  const closeForm = () => { setFormOpen(false); setEditPrompt(null); };

  // ── Derived: visible prompts for current nav state ────────────────────────

  const visiblePrompts: Prompt[] = (() => {
    if (nav.kind === 'section') {
      return PromptService.filterBySection(prompts, nav.key);
    }
    // source nav
    const sourcePrompts = prompts.filter((p) => p.source === nav.source);
    if (!nav.folderId) return sourcePrompts;
    return PromptService.getPromptsInFolder(sourcePrompts, nav.folderId, folders);
  })();

  // Defaults for new prompt form based on current nav position
  const formDefaults: { defaultFolderId?: string; defaultSource?: 'local' | 'app' } = (() => {
    if (nav.kind === 'source') {
      return { defaultSource: nav.source, defaultFolderId: nav.folderId };
    }
    return {};
  })();

  const sectionTitle = (() => {
    if (nav.kind === 'section') {
      return ({ start: 'Start Page', 'quick-access': 'Quick Access', all: 'All Prompts', favorites: 'Favorites' } as Record<string, string>)[nav.key];
    }
    if (!nav.folderId) {
      return nav.source === 'local' ? 'My Prompts' : 'App Prompts';
    }
    return folders.find((f) => f.id === nav.folderId)?.name ?? 'Folder';
  })();

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      {/* Top bar */}
      <div className="flex items-center justify-between px-2 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] shrink-0">
        <span className="text-base font-semibold text-[var(--color-text)] truncate">
          {sectionTitle}
          <span className="ml-1.5 text-xs font-normal text-[var(--color-text-secondary)]">
            ({visiblePrompts.length})
          </span>
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {prompts.length === 0 && (
            <button
              onClick={() => void handleSeedDemoData()}
              disabled={seeding}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] text-xs font-medium hover:bg-[var(--color-bg-hover)] transition-colors disabled:opacity-50"
              title="Load sample prompts"
            >
              <Sparkles size={13} />
              {seeding ? 'Loading…' : 'Samples'}
            </button>
          )}
          {!(nav.kind === 'source' && nav.source === 'app') && (
            <button
              onClick={openAdd}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-medium hover:bg-amber-600 transition-colors"
            >
              <Plus size={13} />
              New
            </button>
          )}
        </div>
      </div>

      {/* Two-pane body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Section nav (collapsible) */}
        {sidebarOpen && (
          <div className="w-56 shrink-0 border-r border-[var(--color-border)] overflow-hidden flex flex-col">
            <PromptSectionNav
              prompts={prompts}
              folders={folders}
              nav={nav}
              onNavigate={setNav}
              onCreateFolder={handleCreateFolder}
              onUpdateFolder={handleUpdateFolder}
              onDeleteFolder={handleDeleteFolder}
              onMoveFolder={handleMoveFolder}
            />
          </div>
        )}

        {/* Right: Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Toggle sidebar button */}
          <div className="flex items-center px-1.5 pt-1 shrink-0">
            <button
              onClick={() => { setUserToggled(true); setHintAnimate(false); setSidebarOpen((v) => !v); }}
              className={`p-1 rounded hover:bg-[var(--color-bg-hover)] transition-colors ${hintAnimate && !sidebarOpen ? 'sidebar-hint-wave' : ''}`}
              aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {sidebarOpen ? <PanelLeftClose size={14} className="text-[var(--color-text-secondary)]" /> : <PanelLeftOpen size={14} className="text-[var(--color-text-secondary)]" />}
            </button>
            {!sidebarOpen && (
              <span className={`text-[10px] font-medium ml-1 truncate ${hintAnimate ? 'sidebar-hint-wave' : 'text-[var(--color-text-secondary)]'}`}>
                {sectionTitle}
              </span>
            )}
          </div>
          <style>{`
            @keyframes sidebarHintWave {
              0%   { color: var(--color-text-secondary); }
              25%  { color: #f59e0b; }
              50%  { color: #8b5cf6; }
              75%  { color: #3b82f6; }
              100% { color: var(--color-text-secondary); }
            }
            .sidebar-hint-wave {
              animation: sidebarHintWave 1.5s ease-in-out 2;
            }
          `}</style>
          {nav.kind === 'section' && nav.key === 'start' ? (
            <StartPageContent
              prompts={visiblePrompts}
              tags={tags}
              categories={categories}
              folders={folders}
              onEdit={openEdit}
              onDelete={(id) => void handleDelete(id)}
              onToggleFavorite={(id) => void handleToggleFavorite(id)}
              onTogglePin={(id) => void handleTogglePin(id)}
              onCopy={(id) => void handleCopy(id)}
              onUse={handleUse}
            />
          ) : (
            <PromptList
              prompts={visiblePrompts}
              tags={tags}
              categories={categories}
              folders={folders}
              onEdit={openEdit}
              onDelete={(id) => void handleDelete(id)}
              onToggleFavorite={(id) => void handleToggleFavorite(id)}
              onTogglePin={(id) => void handleTogglePin(id)}
              onCopy={(id) => void handleCopy(id)}
              onUse={handleUse}
            />
          )}
        </div>
      </div>

      {/* Variables modal */}
      {variablesPrompt && (
        <PromptVariablesModal
          prompt={variablesPrompt}
          onClose={() => setVariablesPrompt(null)}
          onCopy={(id) => { void handleCopy(id); setVariablesPrompt(null); }}
        />
      )}

      {/* Prompt form modal overlay */}
      {formOpen && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center p-3 bg-black/50 backdrop-blur-sm overflow-y-auto"
          onClick={(e) => { if (e.target === e.currentTarget) closeForm(); }}
        >
          <div className="w-full my-auto">
            <PromptForm
              initial={editPrompt}
              categories={categories}
              tags={tags}
              folders={folders.filter((f) => f.source === 'local')}
              defaultFolderId={formDefaults.defaultFolderId}
              defaultSource={formDefaults.defaultSource}
              onSave={(p) => void handleSave(p)}
              onClose={closeForm}
              onCreateTag={handleCreateTag}
              onCreateCategory={handleCreateCategory}
              onCreateFolder={(name) => handleCreateFolder(name, undefined, 'local')}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── StartPageContent ───────────────────────────────────────────────────────

interface StartPageContentProps {
  prompts: Prompt[];
  tags: PromptTag[];
  categories: PromptCategory[];
  folders: PromptFolder[];
  onEdit: (p: Prompt) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onTogglePin: (id: string) => void;
  onCopy: (id: string) => void;
  onUse: (p: Prompt) => void;
}

function StartPageContent({
  prompts, tags, categories, folders, onEdit, onDelete, onToggleFavorite, onTogglePin, onCopy, onUse,
}: StartPageContentProps) {
  if (prompts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <p className="text-sm text-[var(--color-text-secondary)]">No recently used prompts</p>
        <p className="text-xs text-[var(--color-text-secondary)] opacity-60 mt-1">
          Use a prompt to see it here
        </p>
      </div>
    );
  }
  return (
    <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] opacity-50 mb-2">
        Recently used
      </p>
      {prompts.map((p) => (
        <PromptCard
          key={p.id}
          prompt={p}
          tags={tags}
          categories={categories}
          folders={folders}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggleFavorite={onToggleFavorite}
          onTogglePin={onTogglePin}
          onCopy={onCopy}
          onUse={onUse}
        />
      ))}
    </div>
  );
}

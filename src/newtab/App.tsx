import { useEffect, useRef, lazy, Suspense } from 'react';
import { useTheme } from '@shared/hooks/useTheme';
import { loadLocale } from '@shared/utils/i18n';
import { useNewTabSettings } from '@newtab/hooks/useNewTabSettings';
import { useNewTabStore } from '@newtab/stores/newtab.store';
import { useKeyboardShortcuts } from '@newtab/hooks/useKeyboardShortcuts';
import { newtabDB } from '@core/storage/newtab-storage';
import { updateNewTabSettings, getNewTabSettings } from '@core/services/newtab-settings.service';
import { DEFAULT_NEWTAB_SETTINGS, type SpanValue } from '@core/types/newtab.types';
import * as BookmarkService from '@core/services/bookmark.service';
import * as QuickLinksService from '@core/services/quicklinks.service';
import * as TodoService from '@core/services/todo.service';
import { seedDefaultData } from '@core/services/seed.service';
import BackgroundLayer from '@newtab/components/BackgroundLayer';
import MinimalLayout from '@newtab/layouts/MinimalLayout';
import FocusLayout from '@newtab/layouts/FocusLayout';
import DashboardLayout from '@newtab/layouts/DashboardLayout';
import SubscriptionReminder from '@newtab/components/SubscriptionReminder';
import SessionRestoreReminder from '@newtab/components/SessionRestoreReminder';

// Heavy overlays — loaded only when opened
const SettingsPanel = lazy(() => import('@newtab/components/SettingsPanel'));
const WallpaperPicker = lazy(() => import('@newtab/components/WallpaperPicker'));
const KeyboardHelpModal = lazy(() => import('@newtab/components/KeyboardHelpModal'));

export default function App() {
  const { isLoading } = useNewTabSettings();
  useTheme();

  const store = useNewTabStore();
  const {
    settings,
    layoutMode,
    isSettingsOpen,
    isWallpaperOpen,
    isKeyboardHelpOpen,
    setBoards,
    setQuickLinks,
    setTodoLists,
    setLoading,
  } = store;

  const searchRef = useRef<HTMLInputElement>(null);
  const todoRef = useRef<HTMLInputElement>(null);

  useKeyboardShortcuts({ focusSearchRef: searchRef, focusTodoRef: todoRef });

  // Load runtime locale override whenever language setting changes
  useEffect(() => {
    void loadLocale(settings.language ?? 'auto');
  }, [settings.language]);

  // Navigate to a specific view when opened with ?view=<name>
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    if (!viewParam) return;
    const mgmtViews = ['sessions', 'auto-saves', 'tab-groups', 'import-export', 'subscriptions', 'settings'];
    store.setActiveView(viewParam as Parameters<typeof store.setActiveView>[0]);
    if (mgmtViews.includes(viewParam) && store.settings.layoutMode !== 'dashboard') {
      store.setLayoutMode('dashboard');
    }
  // Only run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [boards, links, lists] = await Promise.all([
          BookmarkService.getBoards(newtabDB),
          QuickLinksService.syncTopSites(newtabDB),
          TodoService.getTodoLists(newtabDB),
        ]);

        // First launch: seed default boards and a default todo list
        if (boards.length === 0) {
          const seeded = await seedDefaultData(newtabDB);
          const [seededBoards, seededLists] = await Promise.all([
            BookmarkService.getBoards(newtabDB),
            TodoService.getTodoLists(newtabDB),
          ]);
          setBoards(seededBoards);
          setQuickLinks(links);
          setTodoLists(seededLists);
          store.updateSettings({ activeBoardId: seeded.mainBoard.id });

          const allCats = await Promise.all(
            seededBoards.map((b) => BookmarkService.getCategories(newtabDB, b.id)),
          );
          const cats = allCats.flat();
          store.setCategories(cats);
          if (cats.length > 0) {
            const allEntries = await Promise.all(
              cats.map((c) => BookmarkService.getEntries(newtabDB, c.id)),
            );
            store.setEntries(allEntries.flat());
          }
          return;
        }

        setBoards(boards);
        setQuickLinks(links);
        setTodoLists(lists);

        // Load categories and entries for the ACTIVE board only
        if (boards.length > 0) {
          const storedSettings = await getNewTabSettings();
          const activeBoardId = storedSettings.activeBoardId ?? boards[0].id;
          if (!storedSettings.activeBoardId) {
            store.updateSettings({ activeBoardId: boards[0].id });
          }

          const activeBoard = boards.find((b) => b.id === activeBoardId) ?? boards[0];
          let cats = await BookmarkService.getCategories(newtabDB, activeBoard.id);

          // One-time migration: upgrade pre-9-column cards (rowSpan unset)
          // Old scale was 1-3; new scale is 1-9, so multiply colSpan × 3
          const legacyCats = cats.filter((c) => c.rowSpan == null);
          if (legacyCats.length > 0) {
            await Promise.all(
              legacyCats.map((c) => {
                const newCol = Math.min((c.colSpan ?? 1) * 3, 9) as SpanValue;
                return BookmarkService.updateCategory(newtabDB, c.id, { colSpan: newCol, rowSpan: 3 });
              }),
            );
            cats = cats.map((c) =>
              c.rowSpan == null
                ? { ...c, colSpan: Math.min((c.colSpan ?? 1) * 3, 9) as SpanValue, rowSpan: 3 as SpanValue }
                : c,
            );
          }

          store.setCategories(cats);

          if (cats.length > 0) {
            const allEntries = await Promise.all(
              cats.map((c) => BookmarkService.getEntries(newtabDB, c.id)),
            );
            store.setEntries(allEntries.flat());
          }
        }

        // Load todo items for first list
        if (lists.length > 0) {
          const items = await TodoService.getTodoItems(newtabDB, lists[0].id);
          store.setTodoItems(items);
        }
      } finally {
        setLoading(false);
      }
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) {
    return (
      <div
        className="h-screen w-screen"
        style={{ background: 'linear-gradient(135deg, #1a1a2e, #16213e)' }}
      />
    );
  }

  if (!settings.enabled) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <p className="text-white/80 text-lg mb-2">Browser Hub New Tab is disabled.</p>
          <p className="text-white/50 text-sm">
            Re-enable it in the extension dashboard under Settings → New Tab Page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden relative">
      <BackgroundLayer settings={settings} />
      {layoutMode === 'minimal' && <MinimalLayout />}
      {layoutMode === 'focus' && <FocusLayout />}
      {layoutMode === 'dashboard' && <DashboardLayout />}
      {isSettingsOpen && (
        <Suspense fallback={null}>
          <SettingsPanel
            settings={settings}
            onUpdate={(updates) => store.updateSettings(updates)}
            onClose={() => store.toggleSettings()}
            onClearData={async () => {
              await newtabDB.clearAll();
              await updateNewTabSettings(DEFAULT_NEWTAB_SETTINGS);
              window.location.reload();
            }}
          />
        </Suspense>
      )}
      {isWallpaperOpen && (
        <Suspense fallback={null}>
          <WallpaperPicker
            isOpen={isWallpaperOpen}
            onClose={() => store.toggleWallpaper()}
            settings={settings}
            onUpdate={(updates) => store.updateSettings(updates)}
          />
        </Suspense>
      )}
      {isKeyboardHelpOpen && (
        <Suspense fallback={null}>
          <KeyboardHelpModal
            isOpen={isKeyboardHelpOpen}
            onClose={() => store.toggleKeyboardHelp()}
          />
        </Suspense>
      )}
      <SubscriptionReminder />
      <SessionRestoreReminder />
    </div>
  );
}

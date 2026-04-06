import { useEffect, useRef, lazy, Suspense, useState } from 'react';
import { useTheme } from '@shared/hooks/useTheme';
import { loadLocale } from '@shared/utils/i18n';
import { useNewTabSettings } from '@newtab/hooks/useNewTabSettings';
import { useNewTabUIStore } from '@newtab/stores/newtab-ui.store';
import { useNewTabDataStore } from '@newtab/stores/newtab-data.store';
import { useKeyboardShortcuts } from '@newtab/hooks/useKeyboardShortcuts';
import { newtabDB } from '@core/storage/newtab-storage';
import { updateNewTabSettings, getNewTabSettings } from '@core/services/newtab-settings.service';
import { DEFAULT_NEWTAB_SETTINGS, type SpanValue, type Board } from '@core/types/newtab.types';
import * as BookmarkService from '@core/services/bookmark.service';
import * as QuickLinksService from '@core/services/quicklinks.service';
import * as TodoService from '@core/services/todo.service';
import { seedDefaultData } from '@core/services/seed.service';
import { isSyncAuthenticated } from '@core/services/sync-auth.service';
import { pullAll } from '@core/services/sync.service';
import BackgroundLayer from '@newtab/components/BackgroundLayer';
import MinimalLayout from '@newtab/layouts/MinimalLayout';
import FocusLayout from '@newtab/layouts/FocusLayout';
import DashboardLayout from '@newtab/layouts/DashboardLayout';
import SubscriptionReminder from '@newtab/components/SubscriptionReminder';
import SessionRestoreReminder from '@newtab/components/SessionRestoreReminder';

// Heavy overlays — loaded only when opened
const DashboardRestoreModal = lazy(() => import('@newtab/components/DashboardRestoreModal'));
const SettingsPanel = lazy(() => import('@newtab/components/SettingsPanel'));
const WallpaperPicker = lazy(() => import('@newtab/components/WallpaperPicker'));
const KeyboardHelpModal = lazy(() => import('@newtab/components/KeyboardHelpModal'));

export default function App() {
  const { isLoading } = useNewTabSettings();
  useTheme();

  // Incremented whenever the background SW completes a pull, triggering a data reload.
  const [dataVersion, setDataVersion] = useState(0);
  const [pendingDashboardConfig, setPendingDashboardConfig] = useState<string | null>(null);
  const [isApplyingDashboard, setIsApplyingDashboard] = useState(false);

  useEffect(() => {
    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes.cloud_last_pull_at) setDataVersion((v) => v + 1);
      if (changes.pending_dashboard_restore) {
        const newVal = changes.pending_dashboard_restore.newValue as string | undefined;
        if (newVal) setPendingDashboardConfig(newVal);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  // Check for a pending dashboard restore config written by handleSyncSignIn on mount.
  useEffect(() => {
    chrome.storage.local.get('pending_dashboard_restore', (result) => {
      const config = result['pending_dashboard_restore'] as string | undefined;
      if (config) setPendingDashboardConfig(config);
    });
  }, []);

  const uiStore = useNewTabUIStore();
  const dataStore = useNewTabDataStore();
  const {
    settings,
    layoutMode,
    isSettingsOpen,
    isWallpaperOpen,
    isKeyboardHelpOpen,
    setLoading,
  } = uiStore;
  const { setBoards, setQuickLinks, setTodoLists } = dataStore;

  const searchRef = useRef<HTMLInputElement>(null);
  const todoRef = useRef<HTMLInputElement>(null);

  useKeyboardShortcuts({ focusSearchRef: searchRef, focusTodoRef: todoRef });

  // Load runtime locale override whenever language setting changes
  useEffect(() => {
    void loadLocale(settings.language ?? 'auto');
  }, [settings.language]);

  // Apply text-size scaling via data-text-size attribute on <html>
  useEffect(() => {
    const size = settings.textSize ?? 'default';
    if (size === 'default') {
      document.documentElement.removeAttribute('data-text-size');
    } else {
      document.documentElement.setAttribute('data-text-size', size);
    }
    return () => document.documentElement.removeAttribute('data-text-size');
  }, [settings.textSize]);

  // Navigate to a specific view when opened with ?view=<name>
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    if (!viewParam) return;
    const mgmtViews = ['sessions', 'auto-saves', 'tab-groups', 'import-export', 'subscriptions', 'settings', 'cloud-sync'];
    uiStore.setActiveView(viewParam as Parameters<typeof uiStore.setActiveView>[0]);
    if (mgmtViews.includes(viewParam) && uiStore.settings.layoutMode !== 'dashboard') {
      uiStore.setLayoutMode('dashboard');
    }
  // Only run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [boards, links, lists] = await Promise.all([
          BookmarkService.getBoards(),
          QuickLinksService.getQuickLinks(),
          TodoService.getTodoLists(),
        ]);

        // First launch: seed default boards, quick links, and a default todo list.
        // If the user is already signed in, pull their cloud data first and skip
        // the demo "Private"/"Work" cards — their real folders will come from sync.
        // Guard with dataVersion === 0 so we never re-seed on subsequent reloads
        // triggered by the cloud_last_pull_at signal.
        if (boards.length === 0 && dataVersion === 0) {
          const isAuth = await isSyncAuthenticated();
          if (isAuth) {
            try { await pullAll(); } catch { /* ignore network errors — seeding still proceeds */ }
          }
          const seeded = await seedDefaultData({ skipSampleCards: isAuth });
          const [seededBoards, seededLinks, seededLists] = await Promise.all([
            BookmarkService.getBoards(),
            QuickLinksService.getQuickLinks(),
            TodoService.getTodoLists(),
          ]);
          setBoards(seededBoards);
          setQuickLinks(seededLinks);
          setTodoLists(seededLists);
          uiStore.updateSettings({ activeBoardId: seeded.mainBoard.id });

          const allCats = await Promise.all(
            seededBoards.map((b) => BookmarkService.getCategories(b.id)),
          );
          const cats = allCats.flat();
          dataStore.setCategories(cats);
          if (cats.length > 0) {
            const allEntries = await Promise.all(
              cats.map((c) => BookmarkService.getEntries(c.id)),
            );
            dataStore.setEntries(allEntries.flat());
          }
          if (seededLists.length > 0) {
            const items = await TodoService.getTodoItems(seededLists[0].id);
            dataStore.setTodoItems(items);
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
            uiStore.updateSettings({ activeBoardId: boards[0].id });
          }

          const activeBoard = boards.find((b) => b.id === activeBoardId) ?? boards[0];
          let cats = await BookmarkService.getCategories(activeBoard.id);

          // One-time migration: upgrade pre-9-column cards (rowSpan unset)
          // Old scale was 1-3; new scale is 1-9, so multiply colSpan × 3
          const legacyCats = cats.filter((c) => c.rowSpan == null);
          if (legacyCats.length > 0) {
            await Promise.all(
              legacyCats.map((c) => {
                const newCol = Math.min((c.colSpan ?? 1) * 3, 9) as SpanValue;
                return BookmarkService.updateCategory(c.id, { colSpan: newCol, rowSpan: 3 });
              }),
            );
            cats = cats.map((c) =>
              c.rowSpan == null
                ? { ...c, colSpan: Math.min((c.colSpan ?? 1) * 3, 9) as SpanValue, rowSpan: 3 as SpanValue }
                : c,
            );
          }

          dataStore.setCategories(cats);

          if (cats.length > 0) {
            const allEntries = await Promise.all(
              cats.map((c) => BookmarkService.getEntries(c.id)),
            );
            dataStore.setEntries(allEntries.flat());
          }
        }

        // Load todo items for first list
        if (lists.length > 0) {
          const items = await TodoService.getTodoItems(lists[0].id);
          dataStore.setTodoItems(items);
        }
      } finally {
        setLoading(false);
      }
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataVersion]);

  const handleApplyDashboard = async (boards: Board[]) => {
    setIsApplyingDashboard(true);
    try {
      const existingBoards = await BookmarkService.getBoards();
      const existingIds = new Set(existingBoards.map((b) => b.id));
      const toAdd = boards.filter((b) => !existingIds.has(b.id));
      await Promise.all(toAdd.map((b) => newtabDB.put<Board>('boards', b)));
      await chrome.storage.local.remove('pending_dashboard_restore');
      setPendingDashboardConfig(null);
      setDataVersion((v) => v + 1);
    } catch {
      setPendingDashboardConfig(null);
      await chrome.storage.local.remove('pending_dashboard_restore');
    } finally {
      setIsApplyingDashboard(false);
    }
  };

  const handleDismissDashboard = () => {
    setPendingDashboardConfig(null);
    void chrome.storage.local.remove('pending_dashboard_restore');
  };

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
            onUpdate={(updates) => uiStore.updateSettings(updates)}
            onClose={() => uiStore.toggleSettings()}
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
            onClose={() => uiStore.toggleWallpaper()}
            settings={settings}
            onUpdate={(updates) => uiStore.updateSettings(updates)}
          />
        </Suspense>
      )}
      {isKeyboardHelpOpen && (
        <Suspense fallback={null}>
          <KeyboardHelpModal
            isOpen={isKeyboardHelpOpen}
            onClose={() => uiStore.toggleKeyboardHelp()}
          />
        </Suspense>
      )}
      <SubscriptionReminder />
      <SessionRestoreReminder />
      {pendingDashboardConfig && (
        <Suspense fallback={null}>
          <DashboardRestoreModal
            configJson={pendingDashboardConfig}
            onApply={handleApplyDashboard}
            onDismiss={handleDismissDashboard}
            isApplying={isApplyingDashboard}
          />
        </Suspense>
      )}
    </div>
  );
}

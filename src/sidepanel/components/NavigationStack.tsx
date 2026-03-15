import { useSidePanelStore } from '../stores/sidepanel.store';
import HomeView from '../views/HomeView';
import SessionDetailView from '../views/SessionDetailView';
import TabGroupsView from '../views/TabGroupsView';
import SettingsView from '../views/SettingsView';
import ImportExportView from '../views/ImportExportView';
import SubscriptionsView from '../views/SubscriptionsView';

export default function NavigationStack() {
  const { currentView } = useSidePanelStore();

  switch (currentView) {
    case 'session-detail':
      return <SessionDetailView />;
    case 'tab-groups':
      return <TabGroupsView />;
    case 'settings':
      return <SettingsView />;
    case 'import-export':
      return <ImportExportView />;
    case 'subscriptions':
      return <SubscriptionsView />;
    case 'home':
    default:
      return <HomeView />;
  }
}

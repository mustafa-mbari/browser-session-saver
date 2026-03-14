export function setupSidePanelController(): void {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  chrome.sidePanel.setOptions({ enabled: true });
}

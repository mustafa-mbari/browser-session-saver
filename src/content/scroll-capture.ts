chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'CAPTURE_SCROLL') {
    sendResponse({
      x: window.scrollX,
      y: window.scrollY,
    });
  }
});

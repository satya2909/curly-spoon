document.getElementById("btn").onclick = () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];

    if (!tab || !tab.url) {
      alert("Could not get YouTube URL");
      return;
    }

    chrome.tabs.sendMessage(tab.id, {
      type: "START_ABSA_ANALYSIS",
      url: tab.url,
    });

    window.close(); // optional: close popup after click
  });
};

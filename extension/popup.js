document.getElementById("btn").onclick = () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];

    if (!tab || !tab.url) {
      alert("Could not get YouTube URL");
      return;
    }

    const useLlm = document.getElementById("use_llm").checked;

    chrome.tabs.sendMessage(tab.id, {
      type: "START_ABSA_ANALYSIS",
      url: tab.url,
      useLlm: useLlm
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Message error:", chrome.runtime.lastError);
        alert("Error: Please refresh the YouTube page and try again.");
      }
    });

    window.close(); // optional: close popup after click
  });
};

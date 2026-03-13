document.getElementById("btn").onclick = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.url) {
    alert("Could not get YouTube URL");
    return;
  }

  const useLlm = document.getElementById("use_llm").checked;

  // Inject content script in case the tab was open before the extension loaded
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    });
  } catch (e) {
    // Already injected or non-injectable page — safe to ignore
    console.log("Script inject note:", e.message);
  }

  // Small delay to let the newly injected script set up its listener
  await new Promise(resolve => setTimeout(resolve, 100));

  chrome.tabs.sendMessage(tab.id, {
    type: "START_ABSA_ANALYSIS",
    url: tab.url,
    useLlm: useLlm
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Message error:", chrome.runtime.lastError.message);
    }
  });

  window.close();
};

console.log("ABSA Background Service Worker Loaded");

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "ANALYZE_VIDEO") {
    // Perform fetch in background to avoid Mixed Content (HTTP from HTTPS)
    fetch("http://127.0.0.1:8000/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: msg.url, use_llm: msg.useLlm }),
    })
    .then(async (res) => {
      if (!res.ok) throw new Error("Backend error: " + res.statusText);
      const data = await res.json();
      sendResponse({ success: true, data: data });
    })
    .catch((err) => {
      console.error("Background fetch error:", err);
      sendResponse({ success: false, error: err.message });
    });

    return true; // Keep message channel open for async response
  }
});

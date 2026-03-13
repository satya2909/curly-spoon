console.log("ABSA Background Service Worker Loaded");

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "ANALYZE_VIDEO") {
    // Use async IIFE to keep service worker alive for the full fetch
    (async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: msg.url, use_llm: msg.useLlm }),
        });

        if (!res.ok) {
          const errText = await res.text();
          sendResponse({ success: false, error: `Backend error ${res.status}: ${errText}` });
          return;
        }

        const data = await res.json();
        sendResponse({ success: true, data: data });

      } catch (err) {
        console.error("Background fetch error:", err);
        sendResponse({ success: false, error: err.message });
      }
    })();

    return true; // Keep message channel open for async response
  }
});

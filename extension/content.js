async function startAnalysis(url) {
  removePanel();
  showLoadingPanel();

  try {
    const res = await fetch("http://127.0.0.1:8000/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (!res.ok) throw new Error("Backend error");

    const data = await res.json();

    // ---- ROUTING FIX (IMPORTANT) ----
    if (data.route === "ABSA") {
      if (!data.absa_result || data.absa_result.length === 0) {
        showError("No aspects detected in this video");
        return;
      }
      showResults(data.absa_result);
    } else {
      showGeneralMessage(data.domain, data.confidence);
    }
  } catch (err) {
    console.error(err);
    showError("Failed to analyze video");
  }
}
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "START_ABSA_ANALYSIS" && msg.url) {
    startAnalysis(msg.url);
  }
});

function showGeneralMessage(domain, confidence) {
  const panel = document.getElementById("absa-panel");
  panel.innerHTML = `
    <h3 style="margin-bottom:6px;">ℹ️ Analysis Skipped</h3>
    <div>This video is not related to food reviews.</div>
    <div style="margin-top:6px; font-size:12px; color:#666;">
      Detected domain: <b>${domain}</b><br/>
      Confidence: ${confidence}
    </div>
  `;
}

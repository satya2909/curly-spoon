async function startAnalysis(url, useLlm) {
  removePanel();
  showLoadingPanel();

  try {
    // Delegate network request to background script to avoid Mixed Content issues
    const response = await chrome.runtime.sendMessage({
      type: "ANALYZE_VIDEO",
      url: url,
      useLlm: useLlm
    });

    if (chrome.runtime.lastError) {
      throw new Error(chrome.runtime.lastError.message);
    }

    if (!response || !response.success) {
      throw new Error(response.error || "Unknown backend error");
    }

    const data = response.data;

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
    showError("Failed to analyze video: " + err.message);
  }
}
console.log("ABSA Content Script Loaded");

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("Received message:", msg);
  if (msg.type === "START_ABSA_ANALYSIS" && msg.url) {
    startAnalysis(msg.url, msg.useLlm);
  }
});


// -------------------- UI COMPONENTS --------------------

// -------------------- UI COMPONENTS (DESIGN REDESIGN) --------------------

function createBasePanel() {
  const panel = document.createElement("div");
  panel.id = "absa-panel";
  Object.assign(panel.style, {
    position: "fixed",
    top: "80px",
    right: "20px",
    width: "340px",
    background: "linear-gradient(135deg, rgba(43, 46, 74, 0.95) 0%, rgba(69, 58, 110, 0.95) 100%)",
    color: "white",
    zIndex: "2147483647",
    padding: "20px",
    borderRadius: "20px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
    fontFamily: "'Segoe UI', Roboto, sans-serif",
    border: "1px solid rgba(255,255,255,0.1)",
    backdropFilter: "blur(10px)"
  });

  return panel;
}

function removePanel() {
  const existing = document.getElementById("absa-panel");
  if (existing) existing.remove();
}

function showLoadingPanel() {
  const panel = createBasePanel();
  panel.innerHTML = `
    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:150px;">
      <div class="absa-spinner"></div>
      <p style="margin-top:15px; font-size:14px; color:rgba(255,255,255,0.8);">Analyzing video content...</p>
    </div>
    <style>
      .absa-spinner {
        width: 40px; height: 40px;
        border: 4px solid rgba(255,255,255,0.1);
        border-top: 4px solid #ec4899;
        border-radius: 50%;
        animation: absa-spin 1s linear infinite;
      }
      @keyframes absa-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
  `;
  document.body.appendChild(panel);
}

function showError(msg) {
  const panel = document.getElementById("absa-panel") || createBasePanel();
  if (!document.getElementById("absa-panel")) document.body.appendChild(panel);

  panel.innerHTML = `
    <div style="text-align:center; padding:10px;">
      <h3 style="color:#ff6b6b; margin:0 0 10px 0;">Error</h3>
      <p style="font-size:13px; color:rgba(255,255,255,0.8);">${msg}</p>
      <button id="absa-close-error" style="
        margin-top:15px; padding:8px 20px; background:rgba(255,255,255,0.1); 
        border:none; color:white; border-radius:8px; cursor:pointer;">Close</button>
    </div>
  `;
  document.getElementById("absa-close-error").addEventListener("click", removePanel);
}

function showResults(results) {
  const panel = document.getElementById("absa-panel");
  if (!panel) return;

  const count = results ? results.length : 0;

  let html = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
      <h3 style="margin:0; font-size:18px; font-weight:600;">Aspect Results</h3>
      <span style="background:rgba(255,255,255,0.1); padding:4px 10px; border-radius:12px; font-size:12px; color:#c4b5fd;">
        ${count} Aspects Found
      </span>
    </div>
    
    <div style="max-height:400px; overflow-y:auto; padding-right:5px; margin-bottom:20px;" class="absa-scroll">
  `;

  if (count === 0) {
    html += `<p style="text-align:center; color:#rgba(255,255,255,0.5);">No aspects found.</p>`;
  } else {
    results.forEach(item => {
      const isPos = item.sentiment === 'positive';
      const isNeg = item.sentiment === 'negative';
      
      const color = isPos ? '#4ade80' : (isNeg ? '#f87171' : '#9ca3af'); // Green, Red, Gray
      const bgColor = isPos ? 'rgba(74, 222, 128, 0.2)' : (isNeg ? 'rgba(248, 113, 113, 0.2)' : 'rgba(156, 163, 175, 0.2)');
      const labelColor = isPos ? '#4ade80' : (isNeg ? '#f87171' : '#d1d5db');
      
      const confidence = item.confidence || 0;

      // Card
      html += `
        <div style="
          background: rgba(255,255,255,0.05);
          border-radius: 12px;
          padding: 12px 16px;
          margin-bottom: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-left: 4px solid ${color};
          backdrop-filter: blur(5px);
        ">
          <div>
            <div style="font-weight:600; font-size:15px; margin-bottom:6px;">${item.aspect}</div>
            <div style="
              display:inline-block; 
              background:${bgColor}; 
              color:${labelColor}; 
              padding:2px 8px; 
              border-radius:6px; 
              font-size:11px; 
              text-transform:capitalize;
            ">${item.sentiment}</div>
          </div>

          <div style="text-align:right;">
            <div style="font-size:16px; font-weight:bold; color:rgba(255,255,255,0.9);">${confidence}%</div>
            <div style="font-size:10px; color:rgba(255,255,255,0.4);">confidence</div>
          </div>
        </div>
      `;
    });
  }

  html += `</div>`; // End scroll container

  // Footer Buttons
  html += `
    <div style="display:flex; gap:10px;">
      <button id="absa-reanalyze" style="
        flex:1; padding:10px; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2);
        color:white; border-radius:10px; cursor:pointer; font-size:13px;
        display:flex; align-items:center; justify-content:center; gap:5px;
      ">
        🔄 Re-analyze
      </button>
      <button id="absa-export" style="
        flex:1; padding:10px; background:linear-gradient(90deg, #a855f7 0%, #ec4899 100%); border:none;
        color:white; border-radius:10px; cursor:pointer; font-size:13px; font-weight:600;
        display:flex; align-items:center; justify-content:center; gap:5px;
        box-shadow: 0 4px 10px rgba(236, 72, 153, 0.3);
      ">
        📥 Export
      </button>
    </div>
  `;

  // Scrollbar style
  html += `
    <style>
      .absa-scroll::-webkit-scrollbar { width: 6px; }
      .absa-scroll::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); }
      .absa-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 3px; }
      .absa-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }
    </style>
  `;

  panel.innerHTML = html;

  // Add Close Button (top-right of panel, strictly positioned)
  const closeBtn = document.createElement("button");
  closeBtn.innerHTML = "×";
  Object.assign(closeBtn.style, {
    position: "absolute",
    top: "-15px",
    right: "-15px",
    width: "30px", height: "30px",
    background: "#2b2e4a",
    border: "2px solid rgba(255,255,255,0.1)",
    color: "white",
    borderRadius: "50%",
    cursor: "pointer",
    fontSize: "18px",
    display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: "0 2px 10px rgba(0,0,0,0.3)"
  });
  closeBtn.onclick = removePanel;
  panel.appendChild(closeBtn);

  // Bind footer buttons
  document.getElementById("absa-reanalyze").onclick = () => {
    removePanel();
    // Logic to re-trigger would ideally go through popup, but here we can just close
  };

  document.getElementById("absa-export").onclick = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(results, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "absa_results.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };
}

function showGeneralMessage(domain, confidence) {
  const panel = document.getElementById("absa-panel") || createBasePanel();
  if (!document.getElementById("absa-panel")) document.body.appendChild(panel);

  panel.innerHTML = `
    <div style="text-align:center; padding-top:20px;">
      <h3 style="margin-bottom:10px;">ℹ️ Analysis Skipped</h3>
      <p style="color:rgba(255,255,255,0.7); font-size:13px;">This video is not related to food reviews.</p>
      
      <div style="margin-top:20px; background:rgba(255,255,255,0.05); padding:10px; border-radius:10px;">
        <div style="font-size:11px; color:rgba(255,255,255,0.4);">Detected Domain</div>
        <div style="font-weight:bold; color:#c4b5fd;">${domain || "Unknown"}</div>
      </div>
      
      <button id="absa-close-general" style="
        margin-top:20px; width:100%; padding:10px; background:rgba(255,255,255,0.1); 
        border:none; color:white; border-radius:10px; cursor:pointer;">Close</button>
    </div>
  `;
  document.getElementById("absa-close-general").addEventListener("click", removePanel);
}


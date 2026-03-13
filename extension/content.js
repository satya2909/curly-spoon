// --- INJECTION GUARD ---
// Prevent multiple listeners if the extension popup clicks are executed multiple times
if (!window.hasAbsaContentScript) {
  window.hasAbsaContentScript = true;

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

      // ---- ROUTING ----
      if (data.route === "ABSA") {
        // Handle new grouped format (food_items) or old flat format (absa_result)
        let foodItems = null;
        if (data.food_items && data.food_items.length > 0) {
          foodItems = data.food_items;
        } else if (data.absa_result && data.absa_result.length > 0) {
          // Wrap old flat format into a single group
          foodItems = [{ food_item: "Aspects", aspects: data.absa_result }];
        }

        if (!foodItems || foodItems.length === 0) {
          showError("No aspects detected in this video");
          return;
        }
        showGroupedResults(foodItems, data.restaurant);
      } else {
        showGeneralMessage(data.domain, data.confidence);
      }
    } catch (err) {
      console.error(err);
      showError("Failed to analyze video: " + err.message);
    }
  }

  console.log("ABSA Content Script Loaded & Initialized");

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log("Received message:", msg);
    if (msg.type === "START_ABSA_ANALYSIS" && msg.url) {
      startAnalysis(msg.url, msg.useLlm);
    }
  });
} // End injection guard


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
      <button onclick="document.getElementById('absa-panel').remove()" style="
        margin-top:15px; padding:8px 20px; background:rgba(255,255,255,0.1); 
        border:none; color:white; border-radius:8px; cursor:pointer;">Close</button>
    </div>
  `;
}

function aspectCard(item) {
  const score = item.score || 5;
  const color = score <= 3 ? '#f87171' : (score <= 6 ? '#fbbf24' : '#4ade80');
  const bgColor = score <= 3 ? 'rgba(248,113,113,0.15)' : (score <= 6 ? 'rgba(251,191,36,0.15)' : 'rgba(74,222,128,0.15)');
  const barPct = (score / 10) * 100;
  const label = score <= 3 ? 'Negative' : (score <= 6 ? 'Neutral' : 'Positive');
  const evidenceHtml = item.evidence
    ? `<div style="font-size:11px; color:rgba(255,255,255,0.45); margin-top:6px; font-style:italic; line-height:1.4;">"${item.evidence}"</div>`
    : '';

  return `
    <div style="
      background: rgba(255,255,255,0.05);
      border-radius: 10px;
      padding: 10px 14px;
      margin-bottom: 8px;
      border-left: 3px solid ${color};
    ">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <div style="font-weight:600; font-size:13px; text-transform:capitalize;">${item.aspect}</div>
        <div style="background:${bgColor}; color:${color}; padding:2px 8px; border-radius:20px; font-size:12px; font-weight:700;">${score}/10</div>
      </div>
      <div style="background:rgba(255,255,255,0.08); border-radius:4px; height:5px; overflow:hidden;">
        <div style="width:${barPct}%; height:100%; background:${color}; border-radius:4px;"></div>
      </div>
      <div style="font-size:10px; color:rgba(255,255,255,0.4); margin-top:3px;">${label}</div>
      ${evidenceHtml}
    </div>
  `;
}

function avgScore(aspects) {
  if (!aspects || aspects.length === 0) return 5;
  return Math.round(aspects.reduce((s, a) => s + (a.score || 5), 0) / aspects.length);
}

function showGroupedResults(foodItems, restaurant) {
  const panel = document.getElementById("absa-panel");
  if (!panel) return;

  const totalAspects = foodItems.reduce((s, f) => s + (f.aspects || []).length, 0);

  let html = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
      <h3 style="margin:0; font-size:17px; font-weight:700;">🍽️ Food Analysis</h3>
      <span style="background:rgba(255,255,255,0.1); padding:3px 10px; border-radius:12px; font-size:11px; color:#c4b5fd;">
        ${foodItems.length} item${foodItems.length !== 1 ? 's' : ''} · ${totalAspects} aspects
      </span>
    </div>

    <div style="max-height:420px; overflow-y:auto; padding-right:4px; margin-bottom:16px;" class="absa-scroll">
  `;

  foodItems.forEach((food, idx) => {
    const aspects = food.aspects || [];
    const avg = avgScore(aspects);
    const headerColor = avg <= 3 ? '#f87171' : (avg <= 6 ? '#fbbf24' : '#4ade80');
    const headerBg   = avg <= 3 ? 'rgba(248,113,113,0.15)' : (avg <= 6 ? 'rgba(251,191,36,0.12)' : 'rgba(74,222,128,0.12)');
    const sentiment  = avg <= 3 ? 'Negative' : (avg <= 6 ? 'Neutral' : 'Positive');
    const sectionId  = `absa-food-${idx}`;

    html += `
      <div style="margin-bottom:14px; border-radius:14px; overflow:hidden; border:1px solid rgba(255,255,255,0.08);">
        
        <!-- Food item header (clickable toggle) -->
        <div
          onclick="const b=document.getElementById('${sectionId}'); b.style.display=b.style.display==='none'?'block':'none'; this.querySelector('.absa-chevron').style.transform=b.style.display==='none'?'rotate(0deg)':'rotate(180deg)';"
          style="
            display:flex; justify-content:space-between; align-items:center;
            padding:12px 16px;
            background:${headerBg};
            cursor:pointer;
            user-select:none;
          "
        >
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-size:18px;">🍽️</span>
            <div>
              <div style="font-size:15px; font-weight:700; color:white;">${food.food_item}</div>
              <div style="font-size:10px; color:rgba(255,255,255,0.45); margin-top:1px;">${aspects.length} aspect${aspects.length !== 1 ? 's' : ''}</div>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <div style="background:${headerBg}; color:${headerColor}; padding:3px 10px; border-radius:20px; font-size:12px; font-weight:700; border:1px solid ${headerColor}40;">
              ${sentiment} · ${avg}/10
            </div>
            <span class="absa-chevron" style="color:rgba(255,255,255,0.4); font-size:14px; transition:transform 0.2s;">▼</span>
          </div>
        </div>

        <!-- Aspects body -->
        <div id="${sectionId}" style="padding:10px 12px; background:rgba(0,0,0,0.15);">
    `;

    if (aspects.length === 0) {
      html += `<p style="text-align:center; color:rgba(255,255,255,0.35); font-size:12px;">No specific aspects found.</p>`;
    } else {
      aspects.forEach(item => { html += aspectCard(item); });
    }

    html += `
        </div>
      </div>
    `;
  });

  html += `</div>`;

  // Footer Buttons
  html += `
    <div style="display:flex; gap:10px;">
      <button id="absa-reanalyze" style="
        flex:1; padding:10px; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2);
        color:white; border-radius:10px; cursor:pointer; font-size:13px;
        display:flex; align-items:center; justify-content:center; gap:5px;
      ">🔄 Re-analyze</button>
      <button id="absa-export" style="
        flex:1; padding:10px; background:linear-gradient(90deg, #a855f7 0%, #ec4899 100%); border:none;
        color:white; border-radius:10px; cursor:pointer; font-size:13px; font-weight:600;
        display:flex; align-items:center; justify-content:center; gap:5px;
        box-shadow: 0 4px 10px rgba(236, 72, 153, 0.3);
      ">📥 Export</button>
    </div>
    <style>
      .absa-scroll::-webkit-scrollbar { width: 6px; }
      .absa-scroll::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); }
      .absa-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 3px; }
      .absa-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }
    </style>
  `;

  panel.innerHTML = html;

  // Close button
  const closeBtn = document.createElement("button");
  closeBtn.innerHTML = "×";
  Object.assign(closeBtn.style, {
    position: "absolute",
    top: "-15px", right: "-15px",
    width: "30px", height: "30px",
    background: "#2b2e4a",
    border: "2px solid rgba(255,255,255,0.1)",
    color: "white", borderRadius: "50%",
    cursor: "pointer", fontSize: "18px",
    display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: "0 2px 10px rgba(0,0,0,0.3)"
  });
  closeBtn.onclick = removePanel;
  panel.appendChild(closeBtn);

  document.getElementById("absa-reanalyze").onclick = () => removePanel();

  document.getElementById("absa-export").onclick = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ restaurant, food_items: foodItems }, null, 2));
    const a = document.createElement('a');
    a.setAttribute("href", dataStr);
    a.setAttribute("download", "absa_results.json");
    document.body.appendChild(a);
    a.click();
    a.remove();
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
      
      <button onclick="document.getElementById('absa-panel').remove()" style="
        margin-top:20px; width:100%; padding:10px; background:rgba(255,255,255,0.1); 
        border:none; color:white; border-radius:10px; cursor:pointer;">Close</button>
    </div>
  `;
}


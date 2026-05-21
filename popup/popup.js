/**
 * Toledo Lecture Downloader - Popup Script
 * 
 * Manages the extension's popup UI, queries the active tab for video data,
 * fetches available qualities from Kaltura's adaptive streaming manifest,
 * and triggers downloads with chosen resolution parameters.
 */

document.addEventListener("DOMContentLoaded", () => {
  const statusDot = document.getElementById("status-dot");
  const statusText = document.getElementById("status-text");
  const videoDetails = document.getElementById("video-details");
  const videoTitle = document.getElementById("video-title");
  const videoId = document.getElementById("video-id");
  const downloadBtn = document.getElementById("download-btn");
  const btnText = downloadBtn.querySelector(".btn-text");
  
  const qualityCard = document.getElementById("quality-card");
  const qualitySelect = document.getElementById("quality-select");
  
  const guideToggle = document.getElementById("guide-toggle");
  const guideContent = document.getElementById("guide-content");

  let activeVideo = null;

  // Toggle guide accordion
  guideToggle.addEventListener("click", () => {
    guideToggle.classList.toggle("open");
    guideContent.classList.toggle("hide");
  });

  // Query the active tab to check if there is an embedded video
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || tabs.length === 0) return;
    const activeTab = tabs[0];

    // Check if we are on a valid domain
    if (!activeTab.url || (!activeTab.url.includes("kuleuven.cloud") && !activeTab.url.includes("kuleuven.be"))) {
      setNoVideoState("Not on KU Leuven Toledo");
      return;
    }

    // Query content script
    chrome.tabs.sendMessage(activeTab.id, { action: "get_video_info" }, (response) => {
      // Handle when content script is not loaded or didn't respond
      if (chrome.runtime.lastError || !response) {
        setNoVideoState("Please refresh the page to scan");
        return;
      }

      if (response.detected) {
        setVideoDetectedState(response.entryId, response.title, response.ks);
      } else {
        setNoVideoState("No video found on this page");
      }
    });
  });

  function setNoVideoState(reason) {
    statusDot.className = "dot dot-searching";
    statusText.innerText = reason;
    videoDetails.classList.add("hide");
    qualityCard.classList.add("hide");
    downloadBtn.className = "download-btn disabled";
    downloadBtn.disabled = true;
    btnText.innerText = "No Lecture Detected";
  }

  function setVideoDetectedState(entryId, title, ks) {
    activeVideo = { entryId, title, ks };
    
    statusDot.className = "dot dot-success";
    statusText.innerText = "Lecture Detected!";
    
    videoTitle.innerText = title;
    videoId.innerText = entryId;
    videoDetails.classList.remove("hide");
    
    downloadBtn.className = "download-btn active";
    downloadBtn.disabled = false;
    btnText.innerText = "Download Lecture (MP4)";

    // Fetch dynamic resolutions from adaptive manifest
    fetchVideoQualities(entryId, ks);
  }

  // Parse HLS master manifest and extract resolutions + flavorIds
  function parseM3U8(m3u8Text) {
    const lines = m3u8Text.split('\n');
    const qualities = [];
    
    // Always support Highest/Source resolution
    qualities.push({
      flavorId: 'source',
      resolution: 'Original Source',
      label: 'Source (Oorspronkelijke kwaliteit)'
    });

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('#EXT-X-STREAM-INF:')) {
        // Extract Resolution parameter
        const resMatch = line.match(/RESOLUTION=([0-9]+x[0-9]+)/i);
        let resolution = resMatch ? resMatch[1] : 'Unknown';
        
        let displayLabel = resolution;
        if (resMatch) {
          const height = resolution.split('x')[1];
          displayLabel = `${height}p`;
        }

        // Search next lines for flavorId URL
        let urlLine = '';
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j].trim();
          if (nextLine && !nextLine.startsWith('#')) {
            urlLine = nextLine;
            break;
          }
        }

        if (urlLine) {
          const flavorMatch = urlLine.match(/\/flavorId\/([a-zA-Z0-9_]+)/i);
          if (flavorMatch && flavorMatch[1]) {
            qualities.push({
              flavorId: flavorMatch[1],
              resolution: resolution,
              label: `${displayLabel} (${resolution})`
            });
          }
        }
      }
    }

    // De-duplicate flavors if Kaltura returns multiple identical profiles
    const uniqueQualities = [];
    const seenFlavorIds = new Set();
    for (const q of qualities) {
      if (!seenFlavorIds.has(q.flavorId)) {
        seenFlavorIds.add(q.flavorId);
        uniqueQualities.push(q);
      }
    }

    return uniqueQualities;
  }

  // Fetch available transcodes from Kaltura's API
  function fetchVideoQualities(entryId, ks) {
    const partnerId = "2375821";
    const manifestUrl = `https://www.kaltura.com/p/${partnerId}/sp/${partnerId}00/playManifest/entryId/${entryId}/protocol/https/format/applehttp/a.m3u8${ks ? '?ks=' + encodeURIComponent(ks) : ''}`;

    fetch(manifestUrl)
      .then(response => {
        if (!response.ok) throw new Error("HTTP Status " + response.status);
        return response.text();
      })
      .then(text => {
        const qualities = parseM3U8(text);
        populateQualitySelect(qualities);
      })
      .catch(err => {
        console.warn("[ToledoDownloader] Failed to parse dynamic HLS resolutions:", err);
        // Fallback: Populate with source download only
        populateQualitySelect([
          { flavorId: 'source', resolution: 'Original Source', label: 'Source (Oorspronkelijke kwaliteit)' }
        ]);
      });
  }

  // Render dropdown options in UI
  function populateQualitySelect(qualities) {
    qualitySelect.innerHTML = "";
    qualities.forEach(q => {
      const opt = document.createElement("option");
      opt.value = q.flavorId;
      opt.textContent = q.label;
      qualitySelect.appendChild(opt);
    });
    qualityCard.classList.remove("hide");
  }

  // Handle download button click
  downloadBtn.addEventListener("click", () => {
    if (!activeVideo) return;

    btnText.innerText = "Downloading...";
    downloadBtn.className = "download-btn success";

    const selectedFlavorId = qualitySelect.value;
    
    chrome.runtime.sendMessage({
      action: "download_video",
      entryId: activeVideo.entryId,
      partnerId: "2375821",
      title: activeVideo.title,
      ks: activeVideo.ks,
      flavorId: selectedFlavorId
    }, (response) => {
      if (response && response.success) {
        btnText.innerText = "Started! Check downloads";
        setTimeout(() => {
          btnText.innerText = "Download Lecture (MP4)";
          downloadBtn.className = "download-btn active";
        }, 3000);
      } else {
        btnText.innerText = "Download Failed";
        downloadBtn.className = "download-btn disabled";
        setTimeout(() => {
          btnText.innerText = "Download Lecture (MP4)";
          downloadBtn.className = "download-btn active";
        }, 3000);
      }
    });
  });
});


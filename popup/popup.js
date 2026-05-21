/**
 * Toledo Lecture Downloader - Popup Script
 * 
 * Manages the extension's popup UI, queries the active tab for video data,
 * and triggers downloads.
 */

document.addEventListener("DOMContentLoaded", () => {
  const statusDot = document.getElementById("status-dot");
  const statusText = document.getElementById("status-text");
  const videoDetails = document.getElementById("video-details");
  const videoTitle = document.getElementById("video-title");
  const videoId = document.getElementById("video-id");
  const downloadBtn = document.getElementById("download-btn");
  const btnText = downloadBtn.querySelector(".btn-text");
  
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
  }

  // Handle download button click
  downloadBtn.addEventListener("click", () => {
    if (!activeVideo) return;

    btnText.innerText = "Downloading...";
    downloadBtn.className = "download-btn success";
    
    chrome.runtime.sendMessage({
      action: "download_video",
      entryId: activeVideo.entryId,
      partnerId: "2375821",
      title: activeVideo.title,
      ks: activeVideo.ks
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

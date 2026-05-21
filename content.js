/**
 * Toledo Lecture Downloader - Content Script
 * 
 * Automatically detects Kaltura videos embedded in Toledo / KU Leuven pages,
 * extracts their Entry IDs, and injects a sleek, modern download button.
 */

(function () {
  'use strict';

  // Standard KU Leuven partner ID
  const PARTNER_ID = "2375821";

  // Prevent multiple injections
  if (window.hasToledoDownloaderInjected) return;
  window.hasToledoDownloaderInjected = true;

  console.log("[ToledoDownloader] Content script loaded on: " + location.href);

  // Helper: Try to extract entryId from a string
  function extractEntryId(str) {
    if (!str) return null;
    
    // Pattern 1: /entryid/1_pm2lykwh
    const entryIdRegex1 = /\/entryid\/([a-zA-Z0-9_]+)/i;
    // Pattern 2: entry_id=1_pm2lykwh or entryId=1_pm2lykwh
    const entryIdRegex2 = /[?&]entry_?id=([a-zA-Z0-9_]+)/i;
    // Pattern 3: /entry_id/1_pm2lykwh
    const entryIdRegex3 = /\/entry_id\/([a-zA-Z0-9_]+)/i;

    let match = str.match(entryIdRegex1) || str.match(entryIdRegex2) || str.match(entryIdRegex3);
    if (match && match[1]) {
      return match[1];
    }
    return null;
  }

  // Scan scripts or page source for the Kaltura Session (KS) token
  function findKsToken() {
    const ksRegexGeneral = /(djJ8[a-zA-Z0-9_=-]{100,})/g;
    
    // 1. Search in all script contents
    const scripts = document.querySelectorAll('script');
    for (let script of scripts) {
      const content = script.textContent;
      if (content) {
        // Try exact config matching first
        const match = content.match(/"ks"\s*:\s*"([a-zA-Z0-9_=-]+)"/i) || 
                      content.match(/'ks'\s*:\s*'([a-zA-Z0-9_=-]+)'/i);
        if (match && match[1]) {
          return match[1];
        }
        // General search
        const genMatch = content.match(ksRegexGeneral);
        if (genMatch && genMatch[0]) {
          return genMatch[0];
        }
      }
    }

    // 2. Search in whole document HTML as fallback
    try {
      const docMatch = document.documentElement.innerHTML.match(ksRegexGeneral);
      if (docMatch && docMatch[0]) {
        return docMatch[0];
      }
    } catch (e) {}

    // 3. Search in current URL query parameters
    try {
      const urlKsMatch = location.href.match(/[?&]ks=([a-zA-Z0-9_=-]+)/i);
      if (urlKsMatch && urlKsMatch[1]) {
        return urlKsMatch[1];
      }
    } catch (e) {}

    return null;
  }

  // Scan current page and DOM for Kaltura entry ID
  function findEntryId() {
    // 1. Check current URL
    let entryId = extractEntryId(location.href);
    if (entryId) return entryId;

    // 2. Check all iframe sources on the page
    const iframes = document.querySelectorAll('iframe');
    for (let iframe of iframes) {
      entryId = extractEntryId(iframe.src);
      if (entryId) return entryId;
    }

    // 3. Check video tags or player elements
    const videos = document.querySelectorAll('video');
    for (let video of videos) {
      if (video.getAttribute('kentryid')) return video.getAttribute('kentryid');
      if (video.getAttribute('data-entry-id')) return video.getAttribute('data-entry-id');
      if (video.getAttribute('entry_id')) return video.getAttribute('entry_id');
      
      // Check poster attribute which often contains the entry ID in kaltura thumbnail urls
      const poster = video.getAttribute('poster');
      if (poster) {
        entryId = extractEntryId(poster);
        if (entryId) return entryId;
      }
    }

    // 4. Check typical Kaltura player script configurations in DOM
    const scripts = document.querySelectorAll('script');
    for (let script of scripts) {
      const content = script.textContent;
      if (content && content.includes('entryId')) {
        const match = content.match(/"entryId"\s*:\s*"([a-zA-Z0-9_]+)"/) || content.match(/entryId\s*:\s*'([a-zA-Z0-9_]+)'/);
        if (match && match[1]) {
          return match[1];
        }
      }
    }

    return null;
  }

  // Inject a beautiful download button onto the page
  function injectDownloadButton(entryId) {
    // Skip button injection inside Kaltura or other player embeds
    if (location.href.includes("kaltura.com") || location.href.includes("iframeembed") || location.href.includes("embedIframeJs")) {
      console.log("[ToledoDownloader] Skipping button injection in embed iframe, but scanning for video metadata...");
      return;
    }

    if (document.getElementById('toledo-download-btn-container')) return;

    // Get the title of the lecture
    let videoTitle = document.title || 'Lecture_Video';
    
    // Clean up title: remove typical suffixes like " - Toledo", Kaltura KAF wrappers, etc.
    videoTitle = videoTitle.replace(/\s*-\s*Toledo/gi, '')
                           .replace(/\s*-\s*Kaltura\s*Player/gi, '')
                           .replace(/Recording\s+/gi, 'Recording ')
                           .trim();

    // Create container
    const container = document.createElement('div');
    container.id = 'toledo-download-btn-container';
    
    // Modern Sleek CSS Styles
    const style = document.createElement('style');
    style.textContent = `
      #toledo-download-btn-container {
        position: fixed;
        bottom: 85px; /* Shifted up to sit safely above the media player controls bar */
        right: 20px;
        z-index: 2147483647; /* Ensure it is on top of everything including players */
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      }
      .toledo-dl-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        background: linear-gradient(135deg, #0f62fe 0%, #002d9c 100%);
        color: #ffffff;
        border: none;
        border-radius: 10px; /* More compact borders */
        padding: 8px 12px;   /* Sleeker, compact padding */
        font-size: 12px;     /* Subtle but clear text size */
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(15, 98, 254, 0.35);
        backdrop-filter: blur(10px);
        transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        user-select: none;
        outline: none;
      }
      .toledo-dl-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(15, 98, 254, 0.5);
        background: linear-gradient(135deg, #1670ff 0%, #0036b5 100%);
      }
      .toledo-dl-btn:active {
        transform: translateY(1px);
        box-shadow: 0 2px 8px rgba(15, 98, 254, 0.3);
      }
      .toledo-dl-icon {
        width: 14px;
        height: 14px;
        fill: currentColor;
        transition: transform 0.3s ease;
      }
      .toledo-dl-btn:hover .toledo-dl-icon {
        transform: translateY(2px);
      }
      
      /* Slide-in animation */
      @keyframes toledoSlideIn {
        from { transform: translateX(100px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      .toledo-animate-in {
        animation: toledoSlideIn 0.5s cubic-bezier(0.25, 0.8, 0.25, 1) forwards;
      }
    `;
    document.head.appendChild(style);

    // Create Button
    const button = document.createElement('button');
    button.className = 'toledo-dl-btn toledo-animate-in';
    button.title = `Download: ${videoTitle}`;
    
    // SVG icon of download
    button.innerHTML = `
      <svg class="toledo-dl-icon" viewBox="0 0 24 24">
        <path d="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z"/>
      </svg>
      <span>Download Lecture</span>
    `;

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Visual feedback on click
      const span = button.querySelector('span');
      const originalText = span.innerText;
      span.innerText = "Downloading...";
      button.style.background = "linear-gradient(135deg, #10b981 0%, #059669 100%)"; // green gradient
      button.style.boxShadow = "0 4px 12px rgba(16, 185, 129, 0.35)";
      
      // Request download from background script
      const ks = findKsToken();
      chrome.runtime.sendMessage({
        action: "download_video",
        entryId: entryId,
        partnerId: PARTNER_ID,
        title: videoTitle,
        ks: ks
      }, (response) => {
        setTimeout(() => {
          span.innerText = originalText;
          button.style.background = ""; // revert to CSS gradient
          button.style.boxShadow = "";  // revert to CSS shadow
        }, 3000);
      });
    });

    container.appendChild(button);
    document.body.appendChild(container);
    
    console.log(`[ToledoDownloader] Download button successfully injected for Entry ID: ${entryId}`);
  }

  // Periodic scanner to handle dynamic JS loading/SPAs
  let lastReportedEntryId = null;

  function scanAndInject() {
    const entryId = findEntryId();
    if (entryId) {
      injectDownloadButton(entryId);
      
      // Notify the background script so the popup can read it even across nested iframes
      if (lastReportedEntryId !== entryId) {
        lastReportedEntryId = entryId;
        
        let videoTitle = document.title || 'Lecture_Video';
        videoTitle = videoTitle.replace(/\s*-\s*Toledo/gi, '')
                               .replace(/\s*-\s*Kaltura\s*Player/gi, '')
                               .replace(/Recording\s+/gi, 'Recording ')
                               .trim();
        const ks = findKsToken();

        chrome.runtime.sendMessage({
          action: "video_detected",
          entryId: entryId,
          title: videoTitle,
          ks: ks
        });
      }
    }
  }

  // Listen for queries from popup.js
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "get_video_info") {
      const entryId = findEntryId();
      if (entryId) {
        let videoTitle = document.title || 'Lecture_Video';
        videoTitle = videoTitle.replace(/\s*-\s*Toledo/gi, '')
                               .replace(/\s*-\s*Kaltura\s*Player/gi, '')
                               .replace(/Recording\s+/gi, 'Recording ')
                               .trim();
        const ks = findKsToken();
        sendResponse({ detected: true, entryId: entryId, title: videoTitle, ks: ks });
      } else {
        sendResponse({ detected: false });
      }
    }
    return true;
  });

  // Run immediately and then on a small interval to handle lazy loading
  scanAndInject();
  const intervalId = setInterval(scanAndInject, 1500);

  // Stop scanning after 1 minute to save resources if no video is found
  setTimeout(() => {
    clearInterval(intervalId);
  }, 60000);

})();

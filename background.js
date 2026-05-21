/**
 * Toledo Lecture Downloader - Background Script
 * 
 * Handles cross-frame video detection caching, popup sync, and triggers downloads.
 * Performs dynamic server-side Kaltura API queries to auto-resolve and download
 * the absolute highest resolution transcode stream (e.g. 720p or 1080p HD) when
 * automatic downloads are triggered.
 */

// In-memory cache to store active video details mapped by tab ID (resolves iframe communication boundaries)
const activeVideosByTab = {};

// Helper to sanitize filenames for Windows/OSX/Linux filesystem
function sanitizeFilename(filename) {
  return filename
    .replace(/[\\/:*?"<>|]/g, "_")  // Replace illegal characters with underscore
    .replace(/\s+/g, " ")            // Normalize spaces
    .trim();
}

// Clear cached video entry when navigation occurs on a tab
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    delete activeVideosByTab[tabId];
    console.log(`[ToledoDownloader] Cleared active video cache for Tab ${tabId} due to navigation`);
  }
});

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  
  // 1. Content Script reports video detection (works from inside nested iframes!)
  if (message.action === "video_detected") {
    const tabId = sender.tab ? sender.tab.id : null;
    if (tabId) {
      activeVideosByTab[tabId] = {
        entryId: message.entryId,
        title: message.title,
        ks: message.ks,
        timestamp: Date.now()
      };
      console.log(`[ToledoDownloader] Video cached for Tab ${tabId}: ${message.entryId}`);
    }
    return false; // Synchronous response
  }
  
  // 2. Popup queries for the currently active tab's detected video
  if (message.action === "get_active_video") {
    const tabId = message.tabId;
    const video = activeVideosByTab[tabId];
    if (video) {
      sendResponse({ detected: true, entryId: video.entryId, title: video.title, ks: video.ks });
    } else {
      sendResponse({ detected: false });
    }
    return false; // Synchronous response
  }
  
  // 3. Download execution (auto-resolving highest quality transcode or specific selected flavor)
  if (message.action === "download_video") {
    const { entryId, partnerId, title, ks, flavorId } = message;
    
    console.log(`[ToledoDownloader] Download requested for Entry: ${entryId}, Title: ${title}, KS: ${!!ks}, Flavor: ${flavorId || 'auto-resolve highest'}`);
    
    const ksParam = ks ? `?ks=${encodeURIComponent(ks)}` : '';
    
    // Core function to trigger Chrome native download manager
    const triggerDownload = (url) => {
      const cleanTitle = sanitizeFilename(title || `Toledo_Video_${entryId}`);
      const finalFilename = `Toledo/${cleanTitle}.mp4`;

      chrome.downloads.download({
        url: url,
        filename: finalFilename,
        saveAs: true // Let the user select the folder, prepopulated with the clean filename!
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error("[ToledoDownloader] Download failed:", chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          console.log(`[ToledoDownloader] Download started successfully with ID: ${downloadId}`);
          sendResponse({ success: true, downloadId: downloadId });
        }
      });
    };

    // Case A: Specific resolution transcode flavorId chosen from the popup
    if (flavorId && flavorId !== "source") {
      const downloadUrl = `https://www.kaltura.com/p/${partnerId}/sp/${partnerId}00/playManifest/entryId/${entryId}/flavorId/${flavorId}/format/url/protocol/https${ksParam}`;
      triggerDownload(downloadUrl);
    } 
    // Case B: "Source" or automatic download requested (e.g. from floating screen button)
    else {
      // Query the official Kaltura API directly using the KS token to fetch all available transcodes
      const url = `https://www.kaltura.com/api_v3/service/flavorasset/action/list`;
      const formData = new FormData();
      formData.append("filter:entryIdEqual", entryId);
      if (ks) {
        formData.append("ks", ks);
      }
      formData.append("format", "1"); // JSON response

      fetch(url, {
        method: "POST",
        body: formData
      })
      .then(response => {
        if (!response.ok) throw new Error("Kaltura JSON API Status " + response.status);
        return response.json();
      })
      .then(data => {
        if (!data || !data.objects || !Array.isArray(data.objects)) {
          throw new Error("Invalid Kaltura API JSON response");
        }

        // Filter ready video assets
        const readyAssets = data.objects.filter(asset => {
          return (asset.status == 2 || asset.status == "2") && asset.width > 0;
        });

        if (readyAssets.length === 0) {
          throw new Error("No ready video transcode flavor assets found");
        }

        // Sort by height descending to put the highest resolution stream at index 0 (e.g. 1080p, 720p)
        readyAssets.sort((a, b) => b.height - a.height);

        const bestFlavor = readyAssets[0];
        console.log(`[ToledoDownloader] Auto-resolved highest quality transcode: ${bestFlavor.width}x${bestFlavor.height} (ID: ${bestFlavor.id})`);
        
        const downloadUrl = `https://www.kaltura.com/p/${partnerId}/sp/${partnerId}00/playManifest/entryId/${entryId}/flavorId/${bestFlavor.id}/format/url/protocol/https${ksParam}`;
        triggerDownload(downloadUrl);
      })
      .catch(err => {
        console.warn("[ToledoDownloader] Failed to auto-resolve highest quality transcode, falling back to original upload source:", err);
        // Fallback to original uploaded file flavorParamId/0
        const downloadUrl = `https://www.kaltura.com/p/${partnerId}/sp/${partnerId}00/playManifest/entryId/${entryId}/format/url/protocol/https/flavorParamId/0${ksParam}`;
        triggerDownload(downloadUrl);
      });
    }

    return true; // Keep message channel open for async response
  }
});

/**
 * Toledo Lecture Downloader - Background Script
 * 
 * Handles download requests and maps them to clean filenames via chrome.downloads API.
 */

// Helper to sanitize filenames for Windows/OSX/Linux filesystem
function sanitizeFilename(filename) {
  return filename
    .replace(/[\\/:*?"<>|]/g, "_")  // Replace illegal characters with underscore
    .replace(/\s+/g, " ")            // Normalize spaces
    .trim();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "download_video") {
    const { entryId, partnerId, title, ks, flavorId } = message;
    
    console.log(`[ToledoDownloader] Download requested for Entry: ${entryId}, Title: ${title}, KS: ${!!ks}, Flavor: ${flavorId || 'source'}`);
    
    const ksParam = ks ? `?ks=${encodeURIComponent(ks)}` : '';
    let downloadUrl;
    
    if (flavorId && flavorId !== "source") {
      // Direct progressive download for selected transcode flavor
      downloadUrl = `https://www.kaltura.com/p/${partnerId}/sp/${partnerId}00/playManifest/entryId/${entryId}/flavorId/${flavorId}/format/url/protocol/https${ksParam}`;
    } else {
      // Original source file (highest possible uploaded quality)
      downloadUrl = `https://www.kaltura.com/p/${partnerId}/sp/${partnerId}00/playManifest/entryId/${entryId}/format/url/protocol/https/flavorParamId/0${ksParam}`;
    }
    
    const cleanTitle = sanitizeFilename(title || `Toledo_Video_${entryId}`);
    const finalFilename = `Toledo/${cleanTitle}.mp4`;

    chrome.downloads.download({
      url: downloadUrl,
      filename: finalFilename,
      saveAs: true // Let the user select the folder, but prepopulate with the clean filename!
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error("[ToledoDownloader] Download failed:", chrome.runtime.lastError);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        console.log(`[ToledoDownloader] Download started with ID: ${downloadId}`);
        sendResponse({ success: true, downloadId: downloadId });
      }
    });

    return true; // Keep message channel open for async response
  }
});

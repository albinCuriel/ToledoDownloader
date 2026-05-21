# Toledo Lecture Downloader Chrome Extension 🎓🚀

A modern, premium Manifest V3 Google Chrome Extension designed for students to easily download lecture videos from KU Leuven's **Toledo** learning portal in the **absolute highest quality available** with a single click.

This project is fully open-source, allowing students, teachers, and developers to contribute, update, and deploy new features.

---

## ✨ Features

* **Highest Quality Downloads**: Automatically extracts the active Kaltura Session (`ks`) token and requests the original high-resolution source file (`flavorParamId/0`), bypassing low-quality transcodes.
* **Dual Download Modes**:
  * Injects a sleek **Download Lecture** button directly onto the screen next to the embedded Kaltura player.
  * Provides a gorgeous **Glassmorphic Extension Popup** in your browser toolbar with status indicators and a download toggle.
* **Dynamic, Clean File Naming**: Extracts the actual lecture title (e.g. `Recording guest lecture retailing (Els Breugelmans)`) and saves it neatly inside a `Toledo/` subfolder in your downloads, sanitizing any illegal filesystem characters.
* **Manifest V3 Compliant**: Built with modern security and performance guidelines for long-term Chrome compatibility.

---

## 🚀 Easy Installation Guide (For Students)

### Step 1: Download the Extension
1. Download this repository as a ZIP file (click **Code > Download ZIP** on GitHub).
2. Extract the ZIP folder anywhere on your computer (e.g. in your Documents or a designated extensions folder).

### Step 2: Load it in Google Chrome
1. Open Google Chrome and navigate to:
   ```text
   chrome://extensions/
   ```
2. In the top-right corner, toggle **Developer mode** to **ON**.
3. In the top-left corner, click **Load unpacked** (Uitpakken laden).
4. Select the extracted `ToledoDownloaderExtension` folder.

**Done!** The extension is now active. Refresh your Toledo page and start downloading!

---

## 🛠️ Technical Architecture

Unlike older userscripts that relied on deprecated endpoints or scraped low-resolution assets, this extension uses a resilient multi-stage pipeline:

1. **Content Script (`content.js`)**: Runs in the context of the Toledo frames and the Kaltura iframe (`kaltura-kaf.edu.kuleuven.cloud`).
   * It scans the DOM and scripts using regex to extract the Kaltura `entryId` and the active session token `ks` (identifiable by the `djJ8` signature).
   * It extracts the clean document title.
2. **Message Broker**: Communicates these tokens to the background script.
3. **Background Worker (`background.js`)**: Initiates direct progressive downloads.
   * If a `ks` token is present, it constructs a secure query to the original high-definition source endpoint:
     `https://www.kaltura.com/p/{partnerId}/sp/{partnerId}00/playManifest/entryId/{entryId}/format/url/protocol/https/flavorParamId/0?ks={ks}`
   * If no `ks` is found, it falls back to the default progressive transcode.
   * Triggers Chrome's native `downloads` API to save the video with a clean, customized title.

---

## 🤝 Contributing & Customization

Since this is open source, contributions are welcome! 
* **Want to support other universities?** You can easily update `manifest.json` and `content.js` to support your school's domain and Partner ID.
* **Want to submit a bug fix?** Open an Issue or submit a Pull Request.

---

## 📜 License

This project is licensed under the MIT License. Created for personal, educational, and offline viewing purposes only. Do not redistribute lecture materials without appropriate university permission.

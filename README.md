# Bumble Like Bot

A configurable Playwright-based Chrome automation tool designed specifically for the Bumble Web interface. It automates profile swiping, match collection, and account interactions.

**Key Features:**
* **Smart Element Waiting:** Waits for profiles to fully load and specific target elements, such as "Like" or "Pass" buttons, to appear before acting.
* **Realistic Interaction:** Performs real mouse clicks that mimic human behavior to help bypass basic bot detection systems.
* **Session Management:** Seamlessly handles login-dependent Bumble pages, managing active sessions and potential disconnects.
* **Auto-Refresh:** Automatically refreshes the page to maintain the loop when a configured waiting state appears (e.g., hitting the "That's everyone" screen or running out of daily likes).

---

# PLAYWRIGHT AUTO CLICK HELPER - SETUP AND USAGE

This folder contains a Playwright-based Chrome automation helper.
The shared package does not include a browser profile folder, so it does not contain the sender's login/session data.

## 1) REQUIREMENTS

- Windows
- Google Chrome
- Node.js

Download Node.js here:
[https://nodejs.org/](https://nodejs.org/)

After installing Node.js, you can check it with:
```bash
node --version
```

## 2) FIRST SETUP

Double-click this file:

`run-playwright-autoclick.bat`

On the first run, it installs the required packages automatically:

```bash
npm install
```

After the installation finishes, the automation starts.

## 3) CONFIG FILE

Settings are stored in:

`autoclick.config.json`

Example:

```json
{
  "targetUrl": "https://gew3.bumble.com/get-started",
  "target": "[data-qa-icon-name=\"floating-action-yes\"]",
  "intervalMs": 800,
  "clicksPerLoop": 1,
  "stopWhenMissing": true,
  "missLimit": 99,
  "headless": false,
  "slowMoMs": 0,
  "waitForTargetBeforeClick": true,
  "refreshWhenSelector": "[data-qa-role=\"cta-box-title\"]",
  "refreshWhenText": "all caught up",
  "refreshIntervalMs": 5000,
  "refreshUntilTargetVisible": true,
  "browserExecutablePath": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "userDataDir": "./playwright-profile"
}

```

## 4) SETTINGS EXPLAINED

**targetUrl:**
The website URL that will be opened.

**target:**
The element that will be clicked.
- CSS selector example: `"[data-qa-icon-name=\"floating-action-yes\"]"`
- JSPath example: `"document.querySelector(\"#main button\")"`
- Visible text example: `"text=START"`

**intervalMs:**
Delay between each loop.
800 means 0.8 seconds.

**clicksPerLoop:**
How many clicks will be performed in each loop.

**stopWhenMissing:**
Controls whether the automation stops when the target disappears.

**missLimit:**
How many times the target can be missing before stopping.

**headless:**
- `false` means Chrome will be visible.
- `true` means Chrome runs in the background without a visible window.

**slowMoMs:**
Adds delay to Playwright actions.
Keep it 0 for normal speed.

**waitForTargetBeforeClick:**
If true, the script waits until the target appears before starting clicks.

**refreshWhenSelector:**
If this selector is visible and the text matches, the script enters refresh mode.

**refreshWhenText:**
Text used to trigger refresh mode.
Example: `"all caught up"`

**refreshIntervalMs:**
Delay after each refresh.

**refreshUntilTargetVisible:**
If true, the script keeps refreshing until the target appears again.

**browserExecutablePath:**
Google Chrome executable path.
Default:
`C:\Program Files\Google\Chrome\Application\chrome.exe`

**userDataDir:**
Chrome profile folder used by Playwright.
Login/cookie/session data may be stored here after running the tool.

## 5) HOW TO RUN

1. Open `autoclick.config.json`.
2. Set `targetUrl`.
3. Set `target`.
4. Double-click `run-playwright-autoclick.bat`.
5. Chrome opens.
6. If login is required, log in inside the opened Chrome window.
7. When the target appears, the automation starts.

To stop the script, press this in the terminal window:

`q`

or:

`Ctrl + C`

## 6) COMMON ERRORS

**"node is not recognized"**
Node.js is not installed.
Install it from [https://nodejs.org/](https://nodejs.org/)

**"npm.ps1 cannot be loaded"**
This is a PowerShell execution policy issue.
`run-playwright-autoclick.bat` uses `npm.cmd`, so this should normally not happen.

**"Chrome not found"**
`browserExecutablePath` in `autoclick.config.json` is wrong.
The common Chrome path is:
`C:\Program Files\Google\Chrome\Application\chrome.exe`

**"Waiting for target: not-found"**
The page is open, but the target element is not available yet.
Log in if needed, or check the target selector.

**"It says clicked, but nothing happens"**
The selector may be targeting an icon instead of the real clickable parent.
Use the parent button or a more accurate selector.

**"It says refreshing, but the result does not change"**
Check `refreshWhenSelector` and `refreshWhenText`.
The page may also be returning the same state after refresh.

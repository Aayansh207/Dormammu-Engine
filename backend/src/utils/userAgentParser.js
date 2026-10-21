/**
 * User-Agent & Device Parser Utility
 * Extracts detailed browser, OS, and device category information
 */

function parseUserAgent(ua) {
  if (!ua || typeof ua !== "string") {
    return {
      browser: "Unknown Browser",
      browserVersion: "",
      os: "Unknown OS",
      deviceType: "Desktop",
      deviceLabel: "Unknown Device",
    };
  }

  // 1. Detect Browser & Version
  let browser = "Web Browser";
  let browserVersion = "";

  if (/Edg\/([\d.]+)/i.test(ua)) {
    browser = "Microsoft Edge";
    browserVersion = RegExp.$1.split(".")[0];
  } else if (/OPR\/([\d.]+)/i.test(ua) || /Opera\/([\d.]+)/i.test(ua)) {
    browser = "Opera";
    browserVersion = RegExp.$1.split(".")[0];
  } else if (/Chrome\/([\d.]+)/i.test(ua)) {
    browser = "Google Chrome";
    browserVersion = RegExp.$1.split(".")[0];
  } else if (/Firefox\/([\d.]+)/i.test(ua)) {
    browser = "Mozilla Firefox";
    browserVersion = RegExp.$1.split(".")[0];
  } else if (/Version\/([\d.]+).*Safari/i.test(ua)) {
    browser = "Apple Safari";
    browserVersion = RegExp.$1.split(".")[0];
  } else if (/PostmanRuntime\/([\d.]+)/i.test(ua)) {
    browser = "Postman API Client";
    browserVersion = RegExp.$1.split(".")[0];
  } else if (/curl\/([\d.]+)/i.test(ua)) {
    browser = "cURL CLI";
    browserVersion = RegExp.$1.split(".")[0];
  }

  // 2. Detect Operating System
  let os = "Unknown OS";
  if (/Windows NT 10\.0/i.test(ua)) {
    os = "Windows 10/11";
  } else if (/Windows NT 6\.3/i.test(ua)) {
    os = "Windows 8.1";
  } else if (/Windows NT 6\.2/i.test(ua)) {
    os = "Windows 8";
  } else if (/Windows NT 6\.1/i.test(ua)) {
    os = "Windows 7";
  } else if (/Windows/i.test(ua)) {
    os = "Windows";
  } else if (/iPhone/i.test(ua)) {
    os = "iOS (iPhone)";
  } else if (/iPad/i.test(ua)) {
    os = "iPadOS (iPad)";
  } else if (/Android/i.test(ua)) {
    os = "Android";
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    os = "macOS";
  } else if (/Linux/i.test(ua)) {
    os = "Linux";
  }

  // 3. Detect Device Category
  let deviceType = "Desktop";
  if (/iPhone|iPod|Mobile/i.test(ua) && !/iPad/i.test(ua)) {
    deviceType = "Mobile";
  } else if (/iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) {
    deviceType = "Tablet";
  }

  const browserDisplay = browserVersion ? `${browser} ${browserVersion}` : browser;
  const deviceLabel = `${browserDisplay} on ${os}`;

  return {
    browser,
    browserVersion,
    os,
    deviceType,
    deviceLabel,
  };
}

/**
 * Format and normalize client IP address
 */
function normalizeIp(ip) {
  if (!ip) return "127.0.0.1 (Localhost)";
  const cleanIp = ip.replace(/^::ffff:/, "").trim();
  if (cleanIp === "::1" || cleanIp === "127.0.0.1") {
    return "127.0.0.1 (Localhost)";
  }
  return cleanIp;
}

module.exports = {
  parseUserAgent,
  normalizeIp,
};

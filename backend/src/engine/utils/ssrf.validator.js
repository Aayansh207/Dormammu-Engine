/**
 * Webster Execution Engine - SSRF Protection Validator
 * Validates URLs and hostnames against private CIDRs, link-local metadata endpoints, and non-HTTP protocols.
 */

const dns = require("dns");
const { ErrorCodes, EngineError } = require("../contracts/errors");

// Helper to convert IPv4 string to 32-bit integer
function ipv4ToInt(ip) {
  return ip
    .split(".")
    .reduce((acc, octet) => ((acc << 8) + parseInt(octet, 10)) >>> 0, 0);
}

// Helper to check if IPv4 is in CIDR
function isInSubnet(ipInt, subnetIp, prefixLength) {
  const subnetInt = ipv4ToInt(subnetIp);
  const mask = prefixLength === 0 ? 0 : (~0 << (32 - prefixLength)) >>> 0;
  return (ipInt & mask) === (subnetInt & mask);
}

// List of restricted IPv4 CIDR blocks
const RESTRICTED_IPV4_SUBNETS = [
  { subnet: "0.0.0.0", prefix: 8, name: "Current Network" },
  { subnet: "10.0.0.0", prefix: 8, name: "Private 10.0.0.0/8" },
  { subnet: "127.0.0.0", prefix: 8, name: "Loopback 127.0.0.0/8" },
  { subnet: "169.254.0.0", prefix: 16, name: "Link-Local / Cloud Metadata (169.254.0.0/16)" },
  { subnet: "172.16.0.0", prefix: 12, name: "Private 172.16.0.0/12" },
  { subnet: "192.168.0.0", prefix: 16, name: "Private 192.168.0.0/16" },
  { subnet: "100.64.0.0", prefix: 10, name: "Carrier-Grade NAT" },
  { subnet: "198.18.0.0", prefix: 15, name: "Benchmark" },
];

function isPrivateIPv4(ip) {
  try {
    const ipInt = ipv4ToInt(ip);
    for (const { subnet, prefix, name } of RESTRICTED_IPV4_SUBNETS) {
      if (isInSubnet(ipInt, subnet, prefix)) {
        return { blocked: true, reason: name };
      }
    }
    return { blocked: false };
  } catch {
    return { blocked: true, reason: "Invalid IPv4 format" };
  }
}

function isPrivateIPv6(ip) {
  const normalized = ip.toLowerCase();
  if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") {
    return { blocked: true, reason: "IPv6 Loopback (::1)" };
  }
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) {
    return { blocked: true, reason: "IPv6 Unique Local (fc00::/7)" };
  }
  if (normalized.startsWith("fe80")) {
    return { blocked: true, reason: "IPv6 Link-Local (fe80::/10)" };
  }
  return { blocked: false };
}

/**
 * Validates a destination URL against SSRF rules.
 * Resolves DNS to ensure no private/loopback/metadata destinations are targeted.
 * @param {string} rawUrl
 * @param {Object} [options={}]
 * @param {boolean} [options.allowPrivateNetwork=false]
 * @returns {Promise<{ valid: boolean, parsedUrl: URL, ip: string }>}
 */
async function validateOutboundUrl(rawUrl, options = {}) {
  const allowPrivate = Boolean(options.allowPrivateNetwork);

  if (!rawUrl || typeof rawUrl !== "string") {
    throw new EngineError(ErrorCodes.SSRF_BLOCKED, "URL must be a non-empty string", { url: rawUrl });
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(rawUrl);
  } catch (err) {
    throw new EngineError(
      ErrorCodes.SSRF_BLOCKED,
      `Invalid URL format: ${err.message}`,
      { url: rawUrl }
    );
  }

  // Enforce http / https protocols only
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new EngineError(
      ErrorCodes.SSRF_BLOCKED,
      `Unsupported protocol '${parsedUrl.protocol}'. Only http: and https: are allowed.`,
      { protocol: parsedUrl.protocol, url: rawUrl }
    );
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  // Common localhost / metadata hostnames
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "169.254.169.254" || hostname === "metadata.google.internal") {
    if (!allowPrivate) {
      throw new EngineError(
        ErrorCodes.SSRF_BLOCKED,
        `SSRF Protection: Access to local or cloud metadata host '${hostname}' is blocked`,
        { hostname, url: rawUrl }
      );
    }
  }

  if (allowPrivate) {
    return { valid: true, parsedUrl, ip: null };
  }

  // Resolve hostname via DNS to prevent DNS rebinding attacks
  try {
    const lookupResult = await dns.promises.lookup(hostname, { all: true });
    for (const record of lookupResult) {
      const { address, family } = record;
      if (family === 4) {
        const check = isPrivateIPv4(address);
        if (check.blocked) {
          throw new EngineError(
            ErrorCodes.SSRF_BLOCKED,
            `SSRF Protection: Destination IP '${address}' resolved from '${hostname}' is restricted (${check.reason})`,
            { hostname, ip: address, reason: check.reason }
          );
        }
      } else if (family === 6) {
        const check = isPrivateIPv6(address);
        if (check.blocked) {
          throw new EngineError(
            ErrorCodes.SSRF_BLOCKED,
            `SSRF Protection: Destination IPv6 '${address}' resolved from '${hostname}' is restricted (${check.reason})`,
            { hostname, ip: address, reason: check.reason }
          );
        }
      }
    }

    return {
      valid: true,
      parsedUrl,
      ip: lookupResult[0] ? lookupResult[0].address : null,
    };
  } catch (err) {
    if (err instanceof EngineError) throw err;
    throw new EngineError(
      ErrorCodes.SSRF_BLOCKED,
      `DNS resolution failed for host '${hostname}': ${err.message}`,
      { hostname, originalError: err.message }
    );
  }
}

module.exports = {
  validateOutboundUrl,
  isPrivateIPv4,
  isPrivateIPv6,
};

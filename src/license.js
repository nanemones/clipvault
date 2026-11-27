// Zero-backend Gumroad License Key verification for ClipVault Pro ($9.99 one-time).

(function (globalScope) {
  const GUMROAD_PRODUCT_ID = "jJJ4cQ9Q43wdEB6QmqpBbw=="
  const GUMROAD_CHECKOUT_URL = "https://nicolastic1642.gumroad.com/l/clipvault-pro"
  const STORAGE_KEY = "clipvault_pro_license"

  async function verifyGumroadLicense(licenseKey, fetchImpl = fetch) {
    const trimmed = (licenseKey || "").trim()
    if (!trimmed) {
      return { valid: false, error: "Please enter a license key." }
    }

    const body = new URLSearchParams({
      product_id: GUMROAD_PRODUCT_ID,
      license_key: trimmed,
      increment_uses_count: "false",
    })

    const response = await fetchImpl("https://api.gumroad.com/v2/licenses/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    })

    const data = await response.json().catch(() => null)
    if (!response.ok || !data?.success) {
      return {
        valid: false,
        error: data?.message || "Invalid license key. Please double-check and try again.",
      }
    }

    if (data.purchase?.refunded || data.purchase?.chargebacked) {
      return { valid: false, error: "This license key has been refunded." }
    }

    return {
      valid: true,
      licenseKey: trimmed,
      email: data.purchase?.email || "",
      verifiedAt: new Date().toISOString(),
    }
  }

  async function getSavedLicense() {
    if (typeof chrome === "undefined" || !chrome.storage?.local) return null
    const stored = await chrome.storage.local.get(STORAGE_KEY)
    return stored?.[STORAGE_KEY] || null
  }

  async function saveLicense(licenseInfo) {
    if (typeof chrome === "undefined" || !chrome.storage?.local) return
    await chrome.storage.local.set({ [STORAGE_KEY]: licenseInfo })
  }

  async function clearLicense() {
    if (typeof chrome === "undefined" || !chrome.storage?.local) return
    await chrome.storage.local.remove(STORAGE_KEY)
  }

  const api = {
    GUMROAD_PRODUCT_ID,
    GUMROAD_CHECKOUT_URL,
    verifyGumroadLicense,
    getSavedLicense,
    saveLicense,
    clearLicense,
  }

  globalScope.ClipVaultLicense = api
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api
  }
})(typeof globalThis !== "undefined" ? globalThis : window)

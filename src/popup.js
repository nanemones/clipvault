// Popup controller for ClipVault. Zero innerHTML with untrusted data.

(() => {
  const state = { article: null, isPro: false }

  const els = {
    planBadge: document.getElementById("plan-badge"),
    articleTitle: document.getElementById("article-title"),
    articleMeta: document.getElementById("article-meta"),
    previewBox: document.getElementById("preview-box"),
    previewText: document.getElementById("preview-text"),
    actionsWrap: document.getElementById("actions-wrap"),
    btnMd: document.getElementById("btn-md"),
    btnCopyMd: document.getElementById("btn-copy-md"),
    btnTxt: document.getElementById("btn-txt"),
    btnRescan: document.getElementById("btn-rescan"),
    btnObsidian: document.getElementById("btn-obsidian"),
    btnPdf: document.getElementById("btn-pdf"),
    btnHtml: document.getElementById("btn-html"),
    btnDigest: document.getElementById("btn-digest"),
    toast: document.getElementById("toast"),
    proBox: document.getElementById("pro-box"),
    proActiveBox: document.getElementById("pro-active-box"),
    licenseInput: document.getElementById("license-input"),
    btnActivate: document.getElementById("btn-activate"),
    btnDeactivate: document.getElementById("btn-deactivate"),
    licenseMsg: document.getElementById("license-msg"),
    buyLink: document.getElementById("buy-link"),
  }

  let toastTimer = null
  function showToast(msg, isError = false) {
    els.toast.textContent = msg
    els.toast.classList.toggle("error", isError)
    els.toast.classList.remove("hidden")
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => els.toast.classList.add("hidden"), 2800)
  }

  function slugify(name) {
    return (
      String(name || "article")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 52) || "article"
    )
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1500)
  }

  function updateProUI() {
    if (state.isPro) {
      els.planBadge.textContent = "PRO"
      els.planBadge.className = "badge badge-pro"
      els.proBox.classList.add("hidden")
      els.proActiveBox.classList.remove("hidden")
    } else {
      els.planBadge.textContent = "FREE"
      els.planBadge.className = "badge badge-free"
      els.proBox.classList.remove("hidden")
      els.proActiveBox.classList.add("hidden")
    }
  }

  function requirePro(label) {
    if (state.isPro) return true
    showToast(`${label} is a ClipVault Pro feature ($9.99 once).`, true)
    els.licenseInput.focus()
    return false
  }

  async function scanPage() {
    els.articleTitle.textContent = "Extracting article..."
    els.articleMeta.textContent = "Scanning active tab"
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id) throw new Error("No active tab")

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["src/reader.js"],
      })

      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.ClipVaultReader?.extractArticleFromDocument(document) || null,
      })

      if (!result || !result.markdown) {
        els.articleTitle.textContent = "No article content detected"
        els.articleMeta.textContent = "Open an article, blog post, or docs page"
        els.previewBox.classList.add("hidden")
        els.actionsWrap.classList.add("hidden")
        return
      }

      state.article = result
      els.articleTitle.textContent = result.title
      const bits = [
        `${result.readingMinutes} min read`,
        `${result.wordCount.toLocaleString()} words`,
        result.codeBlocks.length ? `${result.codeBlocks.length} code` : null,
      ].filter(Boolean)
      els.articleMeta.textContent = bits.join(" · ")
      els.previewText.textContent = result.markdown.slice(0, 380) + (result.markdown.length > 380 ? "..." : "")
      els.previewBox.classList.remove("hidden")
      els.actionsWrap.classList.remove("hidden")
    } catch {
      els.articleTitle.textContent = "Cannot clip browser system page"
      els.articleMeta.textContent = "Open any standard webpage and click ClipVault"
      els.previewBox.classList.add("hidden")
      els.actionsWrap.classList.add("hidden")
    }
  }

  els.btnRescan.addEventListener("click", scanPage)

  els.btnMd.addEventListener("click", () => {
    if (!state.article) return
    const md = ClipVaultFormatters.toCleanMarkdown(state.article)
    downloadBlob(new Blob([md], { type: "text/markdown;charset=utf-8" }), `${slugify(state.article.title)}.md`)
    showToast("Downloaded clean Markdown!")
  })

  els.btnCopyMd.addEventListener("click", async () => {
    if (!state.article) return
    const md = ClipVaultFormatters.toCleanMarkdown(state.article)
    await navigator.clipboard.writeText(md)
    showToast("Copied Markdown to clipboard!")
  })

  els.btnTxt.addEventListener("click", () => {
    if (!state.article) return
    const txt = ClipVaultFormatters.toPlainText(state.article)
    downloadBlob(new Blob([txt], { type: "text/plain;charset=utf-8" }), `${slugify(state.article.title)}.txt`)
    showToast("Downloaded plain text!")
  })

  els.btnObsidian.addEventListener("click", () => {
    if (!requirePro("Obsidian YAML Note") || !state.article) return
    const note = ClipVaultFormatters.toObsidianNote(state.article)
    downloadBlob(new Blob([note], { type: "text/markdown;charset=utf-8" }), `${slugify(state.article.title)}.md`)
    showToast("Downloaded Obsidian note with YAML!")
  })

  els.btnPdf.addEventListener("click", () => {
    if (!requirePro("Clean Print PDF") || !state.article) return
    const html = ClipVaultFormatters.toOfflineHtml(state.article, { autoPrint: true })
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }))
    chrome.tabs.create({ url })
    showToast("Opened print-ready PDF view!")
  })

  els.btnHtml.addEventListener("click", () => {
    if (!requirePro("Offline HTML Archive") || !state.article) return
    const html = ClipVaultFormatters.toOfflineHtml(state.article, { autoPrint: false })
    downloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), `${slugify(state.article.title)}.html`)
    showToast("Downloaded offline HTML archive!")
  })

  els.btnDigest.addEventListener("click", () => {
    if (!requirePro("Code & Links Digest") || !state.article) return
    const digest = ClipVaultFormatters.toStudyDigest(state.article)
    downloadBlob(new Blob([digest], { type: "text/markdown;charset=utf-8" }), `${slugify(state.article.title)}-digest.md`)
    showToast("Downloaded Code & Links study digest!")
  })

  els.btnActivate.addEventListener("click", async () => {
    const key = els.licenseInput.value.trim()
    els.licenseMsg.classList.add("hidden")
    els.btnActivate.disabled = true
    els.btnActivate.textContent = "..."
    try {
      const res = await ClipVaultLicense.verifyGumroadLicense(key)
      if (!res.valid) {
        els.licenseMsg.textContent = res.error
        els.licenseMsg.classList.remove("hidden")
      } else {
        await ClipVaultLicense.saveLicense(res)
        state.isPro = true
        updateProUI()
        showToast("ClipVault Pro activated!")
      }
    } catch {
      els.licenseMsg.textContent = "Network error verifying license."
      els.licenseMsg.classList.remove("hidden")
    } finally {
      els.btnActivate.disabled = false
      els.btnActivate.textContent = "Activate"
    }
  })

  els.btnDeactivate.addEventListener("click", async () => {
    await ClipVaultLicense.clearLicense()
    state.isPro = false
    updateProUI()
    showToast("Pro license removed.")
  })

  ;(async () => {
    if (ClipVaultLicense?.GUMROAD_CHECKOUT_URL) {
      els.buyLink.href = ClipVaultLicense.GUMROAD_CHECKOUT_URL
    }
    const saved = await ClipVaultLicense.getSavedLicense()
    state.isPro = Boolean(saved?.valid)
    updateProUI()
    await scanPage()
  })()
})()

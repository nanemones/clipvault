// Readability-style article extractor & DOM-to-Markdown converter for ClipVault.
// Runs 100% locally in the active tab when invoked via activeTab + scripting.

(function (globalScope) {
  const NOISE_SELECTORS = [
    "script", "style", "noscript", "iframe", "svg", "canvas",
    "nav", "header", "footer", "aside", "form", "button",
    "[role='navigation']", "[role='banner']", "[role='complementary']",
    "[aria-hidden='true']",
    ".sidebar", ".nav", ".navbar", ".footer", ".cookie", ".cookies",
    ".newsletter", ".subscribe", ".advertisement", ".ads", ".ad-slot",
    ".social-share", ".share-buttons", ".comments", "#comments", ".related-posts",
  ]

  function normalizeSpace(str) {
    return String(str || "").replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ")
  }

  function detectCodeLang(el) {
    const cls = `${el.className || ""} ${el.parentElement?.className || ""}`
    const match = cls.match(/(?:language-|lang-)([a-z0-9+#_-]+)/i)
    return match ? match[1].toLowerCase() : ""
  }

  function domNodeToMarkdown(node, baseUrl, stats) {
    if (!node) return ""
    if (node.nodeType === 3) {
      return normalizeSpace(node.nodeValue || "")
    }
    if (node.nodeType !== 1) return ""

    const tag = node.tagName.toUpperCase()
    if (["SCRIPT", "STYLE", "NOSCRIPT", "SVG", "IFRAME", "BUTTON", "NAV", "FOOTER", "ASIDE"].includes(tag)) {
      return ""
    }

    const childrenMd = () =>
      Array.from(node.childNodes)
        .map((c) => domNodeToMarkdown(c, baseUrl, stats))
        .join("")

    if (/^H[1-6]$/.test(tag)) {
      const level = Number(tag[1])
      const text = childrenMd().trim()
      return text ? `\n\n${"#".repeat(level)} ${text}\n\n` : ""
    }

    if (tag === "P") {
      const text = childrenMd().trim()
      return text ? `\n\n${text}\n\n` : ""
    }

    if (tag === "BR") return "  \n"
    if (tag === "HR") return "\n\n---\n\n"

    if (tag === "STRONG" || tag === "B") {
      const t = childrenMd().trim()
      return t ? `**${t}**` : ""
    }
    if (tag === "EM" || tag === "I") {
      const t = childrenMd().trim()
      return t ? `*${t}*` : ""
    }

    if (tag === "PRE") {
      const codeEl = node.querySelector("code") || node
      const lang = detectCodeLang(codeEl)
      const code = (codeEl.textContent || "").replace(/\n+$/, "")
      if (!code.trim()) return ""
      if (stats) stats.codeBlocks.push({ lang, code })
      return `\n\n\`\`\`${lang}\n${code}\n\`\`\`\n\n`
    }

    if (tag === "CODE") {
      const code = (node.textContent || "").trim()
      return code ? `\`${code.replace(/`/g, "\\`")}\`` : ""
    }

    if (tag === "BLOCKQUOTE") {
      const inner = childrenMd().trim()
      if (!inner) return ""
      const quoted = inner
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n")
      return `\n\n${quoted}\n\n`
    }

    if (tag === "A") {
      const text = childrenMd().trim()
      const rawHref = node.getAttribute("href") || ""
      if (!rawHref || rawHref.startsWith("javascript:") || rawHref.startsWith("#")) {
        return text
      }
      let href = rawHref
      try {
        href = new URL(rawHref, baseUrl || "https://example.com").href
      } catch {}
      if (stats && text) {
        stats.links.push({ text: text.slice(0, 120), url: href })
      }
      return text ? `[${text}](${href})` : href
    }

    if (tag === "IMG") {
      const alt = (node.getAttribute("alt") || "").trim()
      const rawSrc = node.getAttribute("src") || node.getAttribute("data-src") || ""
      if (!rawSrc || rawSrc.startsWith("data:")) return ""
      let src = rawSrc
      try {
        src = new URL(rawSrc, baseUrl || "https://example.com").href
      } catch {}
      return `\n\n![${alt}](${src})\n\n`
    }

    if (tag === "UL" || tag === "OL") {
      const items = Array.from(node.children).filter((c) => c.tagName === "LI")
      const lines = items
        .map((li, idx) => {
          const text = domNodeToMarkdown(li, baseUrl, stats).trim().replace(/\n+/g, "\n  ")
          if (!text) return ""
          const prefix = tag === "OL" ? `${idx + 1}. ` : "- "
          return `${prefix}${text}`
        })
        .filter(Boolean)
      return lines.length ? `\n\n${lines.join("\n")}\n\n` : ""
    }

    if (tag === "LI") {
      return childrenMd().trim()
    }

    return childrenMd()
  }

  function cleanMarkdownSpacing(md) {
    return String(md || "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  }

  function scoreElement(el) {
    if (!el) return -1
    const text = (el.textContent || "").trim()
    if (text.length < 120) return 0
    const pCount = el.querySelectorAll("p").length
    const linkTextLen = Array.from(el.querySelectorAll("a")).reduce(
      (sum, a) => sum + (a.textContent || "").length,
      0
    )
    const linkDensity = linkTextLen / Math.max(1, text.length)
    let score = text.length * (1 - Math.min(0.85, linkDensity)) + pCount * 80
    if (el.tagName === "ARTICLE") score *= 1.35
    if (el.tagName === "MAIN") score *= 1.2
    return score
  }

  function countWords(text) {
    const trimmed = String(text || "").trim()
    if (!trimmed) return 0
    // Support both Latin words and CJK characters
    const cjk = (trimmed.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) || []).length
    const latin = trimmed
      .replace(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g, " ")
      .split(/\s+/)
      .filter(Boolean).length
    return cjk + latin
  }

  function extractArticleFromDocument(doc) {
    const url = doc.location?.href || ""
    const title =
      doc.querySelector('meta[property="og:title"]')?.getAttribute("content")?.trim() ||
      doc.querySelector("article h1, main h1, h1")?.textContent?.trim() ||
      doc.title?.trim() ||
      "Untitled Article"

    const author =
      doc.querySelector('meta[name="author"]')?.getAttribute("content")?.trim() ||
      doc.querySelector('meta[property="article:author"]')?.getAttribute("content")?.trim() ||
      doc.querySelector('[rel="author"]')?.textContent?.trim() ||
      ""

    const published =
      doc.querySelector('meta[property="article:published_time"]')?.getAttribute("content")?.trim() ||
      doc.querySelector("time[datetime]")?.getAttribute("datetime")?.trim() ||
      ""

    const siteName =
      doc.querySelector('meta[property="og:site_name"]')?.getAttribute("content")?.trim() ||
      (() => {
        try {
          return new URL(url).hostname.replace(/^www\./, "")
        } catch {
          return ""
        }
      })()

    // Find highest-scoring main content container
    const candidates = Array.from(
      doc.querySelectorAll("article, main, [role='main'], .post-content, .article-content, .entry-content, .markdown-body, section")
    )
    let bestEl = doc.body
    let bestScore = 0
    for (const cand of candidates) {
      const s = scoreElement(cand)
      if (s > bestScore) {
        bestScore = s
        bestEl = cand
      }
    }

    const clone = bestEl.cloneNode(true)
    for (const sel of NOISE_SELECTORS) {
      try {
        clone.querySelectorAll(sel).forEach((n) => n.remove())
      } catch {}
    }

    const stats = { codeBlocks: [], links: [] }
    const markdown = cleanMarkdownSpacing(domNodeToMarkdown(clone, url, stats))
    const plainText = (clone.textContent || "").replace(/\s+/g, " ").trim()
    const wordCount = countWords(plainText)
    const readingMinutes = Math.max(1, Math.round(wordCount / 220))

    // Deduplicate links
    const seenUrls = new Set()
    const uniqueLinks = []
    for (const l of stats.links) {
      if (!seenUrls.has(l.url)) {
        seenUrls.add(l.url)
        uniqueLinks.push(l)
      }
    }

    return {
      title,
      url,
      author,
      published,
      siteName,
      wordCount,
      readingMinutes,
      markdown,
      plainText,
      codeBlocks: stats.codeBlocks,
      links: uniqueLinks,
    }
  }

  const api = {
    countWords,
    cleanMarkdownSpacing,
    extractArticleFromDocument,
  }

  globalScope.ClipVaultReader = api
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api
  }
})(typeof globalThis !== "undefined" ? globalThis : window)

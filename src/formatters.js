// Output formatters for ClipVault.
// Free: Clean Markdown, Plain Text.
// Pro: Obsidian YAML Note, Print-Ready PDF / Offline Single-File HTML, Code & Links Digest.

(function (globalScope) {
  function escapeYaml(str) {
    return String(str || "")
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\r?\n/g, " ")
      .trim()
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
  }

  function toCleanMarkdown(article) {
    const meta = []
    if (article.url) meta.push(`> Source: ${article.url}`)
    if (article.author) meta.push(`> Author: ${article.author}`)
    if (article.readingMinutes) {
      meta.push(`> Reading Time: ~${article.readingMinutes} min (${article.wordCount || 0} words)`)
    }
    const header = [`# ${article.title || "Untitled"}`, meta.join("\n")].filter(Boolean).join("\n\n")
    return `${header}\n\n${article.markdown || ""}`.trim() + "\n"
  }

  function toPlainText(article) {
    const parts = [
      article.title || "Untitled",
      article.url ? `Source: ${article.url}` : "",
      "=".repeat(40),
      article.plainText || "",
    ].filter(Boolean)
    return parts.join("\n\n") + "\n"
  }

  function toObsidianNote(article, options = {}) {
    const dateStr = (options.clippedAt || new Date().toISOString()).slice(0, 10)
    const tags = Array.isArray(options.tags) && options.tags.length > 0
      ? options.tags
      : ["clippings", "web"]

    const frontmatter = [
      "---",
      `title: "${escapeYaml(article.title || "Untitled")}"`,
      `source: "${escapeYaml(article.url || "")}"`,
      article.author ? `author: "${escapeYaml(article.author)}"` : null,
      article.siteName ? `site: "${escapeYaml(article.siteName)}"` : null,
      article.published ? `published: "${escapeYaml(article.published.slice(0, 10))}"` : null,
      `clipped: ${dateStr}`,
      `reading_time: "${article.readingMinutes || 1} min"`,
      `words: ${article.wordCount || 0}`,
      `tags: [${tags.map((t) => `"${escapeYaml(t)}"`).join(", ")}]`,
      "---",
    ]
      .filter(Boolean)
      .join("\n")

    return `${frontmatter}\n\n# ${article.title || "Untitled"}\n\n${article.markdown || ""}\n`
  }

  function toStudyDigest(article) {
    const sections = [`# Study Digest: ${article.title || "Untitled"}`]
    if (article.url) sections.push(`Source: ${article.url}`)

    const blocks = article.codeBlocks || []
    sections.push(`## Code Snippets (${blocks.length})`)
    if (blocks.length === 0) {
      sections.push("_No code blocks detected on this page._")
    } else {
      blocks.forEach((b, i) => {
        sections.push(`### Snippet ${i + 1}\n\n\`\`\`${b.lang || ""}\n${b.code}\n\`\`\``)
      })
    }

    const links = article.links || []
    sections.push(`## Reference Links (${links.length})`)
    if (links.length === 0) {
      sections.push("_No external links detected._")
    } else {
      sections.push(links.map((l) => `- [${l.text}](${l.url})`).join("\n"))
    }

    return sections.join("\n\n") + "\n"
  }

  function markdownToSafeHtml(md) {
    const lines = String(md || "").split("\n")
    const out = []
    let inCode = false
    let codeBuf = []
    let inList = false

    const inlineFormat = (s) =>
      escapeHtml(s)
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/\*([^*]+)\*/g, "<em>$1</em>")
        .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')

    for (const line of lines) {
      if (line.startsWith("```")) {
        if (inCode) {
          out.push(`<pre><code>${escapeHtml(codeBuf.join("\n"))}</code></pre>`)
          codeBuf = []
          inCode = false
        } else {
          if (inList) { out.push("</ul>"); inList = false }
          inCode = true
        }
        continue
      }
      if (inCode) {
        codeBuf.push(line)
        continue
      }
      const trimmed = line.trim()
      if (!trimmed) {
        if (inList) { out.push("</ul>"); inList = false }
        continue
      }
      const heading = trimmed.match(/^(#{1,6})\s+(.*)$/)
      if (heading) {
        if (inList) { out.push("</ul>"); inList = false }
        const lvl = heading[1].length
        out.push(`<h${lvl}>${inlineFormat(heading[2])}</h${lvl}>`)
        continue
      }
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        if (!inList) { out.push("<ul>"); inList = true }
        out.push(`<li>${inlineFormat(trimmed.slice(2))}</li>`)
        continue
      }
      if (trimmed.startsWith("> ")) {
        if (inList) { out.push("</ul>"); inList = false }
        out.push(`<blockquote>${inlineFormat(trimmed.slice(2))}</blockquote>`)
        continue
      }
      if (trimmed === "---") {
        if (inList) { out.push("</ul>"); inList = false }
        out.push("<hr/>")
        continue
      }
      if (inList) { out.push("</ul>"); inList = false }
      out.push(`<p>${inlineFormat(trimmed)}</p>`)
    }
    if (inList) out.push("</ul>")
    if (inCode) out.push(`<pre><code>${escapeHtml(codeBuf.join("\n"))}</code></pre>`)
    return out.join("\n")
  }

  function toOfflineHtml(article, options = {}) {
    const autoPrint = Boolean(options.autoPrint)
    const bodyHtml = markdownToSafeHtml(article.markdown || "")
    const metaParts = [
      article.siteName ? escapeHtml(article.siteName) : null,
      article.author ? `By ${escapeHtml(article.author)}` : null,
      `${article.readingMinutes || 1} min read`,
      `${article.wordCount || 0} words`,
    ].filter(Boolean)

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(article.title || "ClipVault Article")}</title>
  <style>
    body { max-width: 740px; margin: 40px auto; padding: 0 24px 64px; font-family: Georgia, "Times New Roman", serif; color: #1a202c; line-height: 1.75; font-size: 17px; background: #fff; }
    h1, h2, h3, h4 { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; line-height: 1.3; margin-top: 1.6em; }
    h1 { font-size: 2em; margin-top: 0; }
    .meta { font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 13px; color: #64748b; border-bottom: 1px solid #e2e8f0; padding-bottom: 14px; margin-bottom: 24px; }
    .meta a { color: #d97706; text-decoration: none; }
    pre { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; overflow-x: auto; font-size: 13px; line-height: 1.5; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.9em; background: #f1f5f9; padding: 2px 5px; border-radius: 4px; }
    pre code { background: none; padding: 0; }
    blockquote { border-left: 3px solid #d97706; margin: 1.2em 0; padding: 4px 16px; color: #475569; background: #fffbeb; }
    a { color: #b45309; }
    @media print { body { margin: 0; max-width: 100%; font-size: 12pt; } .no-print { display: none; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(article.title || "Untitled")}</h1>
  <div class="meta">
    ${metaParts.join(" · ")}
    ${article.url ? `<br/><a href="${escapeHtml(article.url)}">${escapeHtml(article.url)}</a>` : ""}
  </div>
  <article>${bodyHtml}</article>
  ${autoPrint ? "<script>window.onload=function(){window.print()}</script>" : ""}
</body>
</html>`
  }

  const api = {
    toCleanMarkdown,
    toPlainText,
    toObsidianNote,
    toStudyDigest,
    toOfflineHtml,
  }

  globalScope.ClipVaultFormatters = api
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api
  }
})(typeof globalThis !== "undefined" ? globalThis : window)

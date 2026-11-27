import { describe, expect, test } from "bun:test"
import reader from "../src/reader.js"
import formatters from "../src/formatters.js"
import license from "../src/license.js"

describe("ClipVault Reader & Word Counter", () => {
  test("counts mixed English and CJK words accurately", () => {
    expect(reader.countWords("Hello world 測試中文")).toBe(6)
    expect(reader.countWords("")).toBe(0)
  })

  test("cleans excess blank lines in Markdown", () => {
    expect(reader.cleanMarkdownSpacing("a  \n\n\n\nb")).toBe("a\n\nb")
  })
})

describe("ClipVault Formatters", () => {
  const sample = {
    title: 'How to Build "Fast" Local Tools',
    url: "https://example.com/post",
    author: "Alice",
    siteName: "example.com",
    published: "2026-11-27T00:00:00Z",
    wordCount: 440,
    readingMinutes: 2,
    markdown: "## Intro\n\nThis is **bold** and `inline()`.\n\n```js\nconsole.log(1)\n```\n\n> A quote",
    plainText: "Intro This is bold and inline().",
    codeBlocks: [{ lang: "js", code: "console.log(1)" }],
    links: [{ text: "Docs", url: "https://example.com/docs" }],
  }

  test("toCleanMarkdown includes title, source, and body", () => {
    const md = formatters.toCleanMarkdown(sample)
    expect(md).toContain('# How to Build "Fast" Local Tools')
    expect(md).toContain("> Source: https://example.com/post")
    expect(md).toContain("```js")
  })

  test("toObsidianNote escapes quotes in YAML frontmatter", () => {
    const note = formatters.toObsidianNote(sample, { clippedAt: "2026-11-27T12:00:00Z" })
    expect(note).toContain('title: "How to Build \\"Fast\\" Local Tools"')
    expect(note).toContain("clipped: 2026-11-27")
    expect(note).toContain('tags: ["clippings", "web"]')
  })

  test("toOfflineHtml escapes XSS and injects print script when autoPrint is true", () => {
    const html = formatters.toOfflineHtml(
      { ...sample, title: "<script>alert(1)</script>" },
      { autoPrint: true }
    )
    expect(html).not.toContain("<script>alert(1)</script>")
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;")
    expect(html).toContain("window.print()")
  })

  test("toStudyDigest lists code snippets and reference links", () => {
    const digest = formatters.toStudyDigest(sample)
    expect(digest).toContain("## Code Snippets (1)")
    expect(digest).toContain("## Reference Links (1)")
    expect(digest).toContain("[Docs](https://example.com/docs)")
  })
})

describe("ClipVault License", () => {
  test("verifies valid key and rejects refunded key", async () => {
    const okFetch = async () => ({
      ok: true,
      json: async () => ({ success: true, purchase: { email: "u@test.com", refunded: false } }),
    })
    const refFetch = async () => ({
      ok: true,
      json: async () => ({ success: true, purchase: { refunded: true } }),
    })
    expect((await license.verifyGumroadLicense("KEY-1", okFetch)).valid).toBe(true)
    expect((await license.verifyGumroadLicense("KEY-2", refFetch)).valid).toBe(false)
  })
})

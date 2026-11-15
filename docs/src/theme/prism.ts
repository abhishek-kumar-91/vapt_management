import type { PrismTheme } from "prism-react-renderer"

/**
 * Code themes drawn from the Pentest Scout palette: ink for keywords, the chart
 * teal for strings, chart amber for literals, and the muted ink for comments.
 */
function scoutTheme(c: {
  plain: string
  background: string
  comment: string
  keyword: string
  fn: string
  string: string
  literal: string
  punctuation: string
  tag: string
}): PrismTheme {
  return {
    plain: { color: c.plain, backgroundColor: c.background },
    styles: [
      { types: ["comment", "prolog", "doctype", "cdata"], style: { color: c.comment, fontStyle: "italic" } },
      { types: ["punctuation", "operator"], style: { color: c.punctuation } },
      { types: ["keyword", "atrule", "important", "selector"], style: { color: c.keyword } },
      { types: ["function", "class-name", "maybe-class-name"], style: { color: c.fn } },
      { types: ["string", "char", "attr-value", "regex", "inserted", "url"], style: { color: c.string } },
      { types: ["number", "boolean", "constant", "symbol", "unit"], style: { color: c.literal } },
      { types: ["tag", "builtin", "property", "attr-name", "deleted"], style: { color: c.tag } },
      { types: ["variable", "parameter"], style: { color: c.plain } },
      { types: ["bold"], style: { fontWeight: "600" } },
      { types: ["italic"], style: { fontStyle: "italic" } },
    ],
  }
}

export const scoutLight = scoutTheme({
  plain: "oklch(0.24 0 0)",
  background: "oklch(0.97 0 0)",
  comment: "oklch(0.52 0 0)",
  keyword: "oklch(0.2 0 0)",
  fn: "oklch(0.47 0.15 300)",
  string: "oklch(0.47 0.1 175)",
  literal: "oklch(0.5 0.12 60)",
  punctuation: "oklch(0.45 0 0)",
  tag: "oklch(0.45 0.13 250)",
})

export const scoutDark = scoutTheme({
  plain: "oklch(0.92 0 0)",
  background: "oklch(0.19 0 0)",
  comment: "oklch(0.66 0 0)",
  keyword: "oklch(0.96 0 0)",
  fn: "oklch(0.78 0.11 300)",
  string: "oklch(0.78 0.1 175)",
  literal: "oklch(0.82 0.12 75)",
  punctuation: "oklch(0.72 0 0)",
  tag: "oklch(0.76 0.1 250)",
})

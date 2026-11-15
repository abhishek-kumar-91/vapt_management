import type * as Preset from "@docusaurus/preset-classic"
import type { Config } from "@docusaurus/types"

import { scoutDark, scoutLight } from "./src/theme/prism"

const config: Config = {
  title: "Pentest Scout Docs",
  tagline: "Developer documentation for the Pentest Scout VAPT console.",
  favicon: "img/favicon.svg",

  // Set these to the real host when the docs are deployed.
  url: "https://docs.pentest-scout.local",
  baseUrl: "/",

  // Internal security tooling: keep it out of search engines.
  noIndex: true,
  onBrokenLinks: "throw",
  onBrokenAnchors: "throw",

  future: { v4: true },

  i18n: { defaultLocale: "en", locales: ["en"] },

  markdown: {
    mermaid: true,
    hooks: { onBrokenMarkdownLinks: "throw" },
  },
  themes: [
    "@docusaurus/theme-mermaid",
    [
      "@easyops-cn/docusaurus-search-local",
      {
        hashed: true,
        docsDir: "content",
        docsRouteBasePath: "/",
        indexBlog: false,
        highlightSearchTermsOnTargetPage: true,
        explicitSearchResultPath: true,
      },
    ],
  ],

  presets: [
    [
      "classic",
      {
        docs: {
          path: "content",
          routeBasePath: "/",
          sidebarPath: "./sidebars.ts",
          showLastUpdateTime: false,
        },
        blog: false,
        theme: { customCss: "./src/css/custom.css" },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: { respectPrefersColorScheme: true },
    docs: { sidebar: { hideable: true, autoCollapseCategories: false } },
    tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
    navbar: {
      title: "Pentest Scout",
      logo: { alt: "Pentest Scout", src: "img/logo.svg", width: 28, height: 28 },
      items: [
        { type: "docSidebar", sidebarId: "docs", position: "left", label: "Docs" },
        { to: "/reference/lib", position: "left", label: "API reference" },
        { to: "/design-system/foundations", position: "left", label: "Design system" },
        {
          href: "http://localhost:3000/dashboard",
          position: "right",
          label: "Open console",
        },
      ],
    },
    footer: {
      copyright:
        "Pentest Scout · Application Security Testing SOP v1.0. All records in this repository are sample data.",
    },
    prism: {
      theme: scoutLight,
      darkTheme: scoutDark,
      additionalLanguages: ["bash", "json", "python", "diff"],
    },
    mermaid: {
      theme: { light: "base", dark: "base" },
      options: {
        fontFamily: "Figtree Variable, ui-sans-serif, system-ui, sans-serif",
      },
    },
  } satisfies Preset.ThemeConfig,
}

export default config

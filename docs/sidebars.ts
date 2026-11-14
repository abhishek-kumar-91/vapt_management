import type { SidebarsConfig } from "@docusaurus/plugin-content-docs"

const sidebars: SidebarsConfig = {
  docs: [
    "intro",
    {
      type: "category",
      label: "Getting started",
      collapsible: false,
      items: ["getting-started/setup", "getting-started/project-structure", "getting-started/first-change"],
    },
    {
      type: "category",
      label: "Concepts",
      collapsible: false,
      items: ["concepts/domain-model", "concepts/sop-rules", "concepts/finding-lifecycle", "concepts/health"],
    },
    {
      type: "category",
      label: "Architecture",
      collapsible: false,
      items: [
        "architecture/overview",
        "architecture/state",
        "architecture/metrics",
        "architecture/reports",
        "architecture/data-pipeline",
        "architecture/database",
        "architecture/security",
      ],
    },
    {
      type: "category",
      label: "Design system",
      collapsible: false,
      items: ["design-system/foundations", "design-system/components", "design-system/theming"],
    },
    {
      type: "category",
      label: "Guides",
      collapsible: false,
      items: ["guides/add-a-product", "guides/add-a-page", "guides/add-a-store-action", "guides/deployment"],
    },
    {
      type: "category",
      label: "Reference",
      collapsible: false,
      items: ["reference/lib", "reference/scripts", "reference/glossary"],
    },
    "contributing",
  ],
}

export default sidebars

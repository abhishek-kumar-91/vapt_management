import type { FieldSpec } from "@/components/forms/form-fields"
import { COMPANY_SIZES, DATA_SENSITIVITY, INDUSTRIES } from "@/lib/orgs"

/** Field lists shared by every form that collects the same thing (onboarding and the console). */

const choose = (values: readonly string[], placeholder: string) => [
  { value: "", label: placeholder },
  ...values.map((v) => ({ value: v, label: v })),
]

export const PRODUCT_FIELDS: FieldSpec[] = [
  { name: "name", label: "Product name", maxLength: 80, placeholder: "Customer web app", required: true },
  {
    name: "tier",
    label: "Tier",
    type: "select",
    half: true,
    defaultValue: "2",
    options: [
      { value: "1", label: "Tier 1 · business-critical" },
      { value: "2", label: "Tier 2 · important" },
      { value: "3", label: "Tier 3 · standard" },
    ],
  },
  {
    name: "dataSensitivity",
    label: "Data sensitivity",
    type: "select",
    half: true,
    optional: true,
    options: choose(DATA_SENSITIVITY, "Not sure yet"),
  },
  { name: "domain", label: "Domain or URL", placeholder: "app.company.com", half: true, optional: true },
  { name: "technology", label: "Technology", placeholder: "Next.js, Postgres", half: true, optional: true },
]

export const companyFields = (defaults?: Record<string, string>): FieldSpec[] => [
  { name: "name", label: "Company name", autoComplete: "organization", maxLength: 80, required: true, defaultValue: defaults?.name },
  { name: "industry", label: "Industry", type: "select", half: true, required: true, options: choose(INDUSTRIES, "Choose one"), defaultValue: defaults?.industry },
  { name: "size", label: "Company size", type: "select", half: true, required: true, options: choose(COMPANY_SIZES, "Choose one"), defaultValue: defaults?.size },
  { name: "website", label: "Website", type: "url", placeholder: "company.com", maxLength: 200, optional: true, defaultValue: defaults?.website },
]

export const SLUG_FIELD: FieldSpec = {
  name: "slug",
  label: "Workspace address",
  placeholder: "acme",
  maxLength: 40,
  description: "Lower-case letters, numbers and dashes. Leave blank to use the company name. It can’t change later.",
}

export const testingRequestFields = (products: { slug: string; name: string }[]): FieldSpec[] => [
  {
    name: "product",
    label: "Product",
    type: "select",
    required: true,
    options: [{ value: "", label: "Choose a product" }, ...products.map((p) => ({ value: p.slug, label: p.name }))],
  },
  {
    name: "scope",
    label: "What should be tested",
    type: "textarea",
    required: true,
    maxLength: 4000,
    placeholder: "e.g. The customer web app and its API: sign-in, payments and the admin panel.",
  },
  { name: "environment", label: "Environment", placeholder: "https://staging.company.com", half: true, optional: true },
  { name: "contact", label: "Contact for access", placeholder: "Name and email", half: true, optional: true },
  { name: "preferredStart", label: "Preferred start", type: "date", half: true, placeholder: "Any time", optional: true },
  { name: "preferredEnd", label: "Preferred end", type: "date", half: true, placeholder: "Any time", optional: true },
  { name: "notes", label: "Anything else", type: "textarea", maxLength: 4000, optional: true },
]

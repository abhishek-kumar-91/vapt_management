/** Development only: the link an email would carry, so flows can be tested without a mail provider. */
export function DevLink({ href }: { href?: string | null }) {
  if (!href) return null
  return (
    <p className="rounded-2xl bg-muted px-4 py-3 text-sm break-all">
      <span className="font-medium">Development: </span>
      the email isn’t sent.{" "}
      <a href={href} className="font-medium text-primary underline-offset-4 hover:underline">
        Open the link
      </a>
    </p>
  )
}

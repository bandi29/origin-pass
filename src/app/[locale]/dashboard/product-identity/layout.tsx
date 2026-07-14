import { spacing } from "@/design-system/tokens"

export default function ProductIdentityModuleLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className={spacing.pageStack}>{children}</div>
}

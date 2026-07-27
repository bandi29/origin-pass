import {
  Circle,
  Document,
  Image,
  Page,
  Path,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer"

export type PrintLayoutType = "hangtag-2x3" | "avery-5160" | "thermal-4x6"

/** @deprecated Prefer PrintLayoutType */
export type HangtagLayoutType = PrintLayoutType

export type PrintLabelData = {
  productTitle: string
  variantName: string
  serialNumber: string
  scanUrl: string
  linkType: "gs1" | "standard"
  /** Digits-only padded GTIN when available. */
  gtinDisplay: string | null
  /** Formatted AI line, e.g. `(01) 00810012345675`. */
  gtinAi01: string | null
  qrDataUrl: string
  /** Primary compliance label under the QR. */
  footerText: string
}

/** @deprecated Prefer PrintLabelData */
export type HangtagLabelData = PrintLabelData

/** Physical page sizes in PDF points (72 pt = 1 in). */
export const LAYOUT_PAGE_SIZE: Record<
  PrintLayoutType,
  { width: number; height: number; label: string }
> = {
  "hangtag-2x3": { width: 144, height: 216, label: '2x3" Hangtag' },
  "thermal-4x6": { width: 288, height: 432, label: '4x6" Thermal' },
  "avery-5160": { width: 612, height: 792, label: "Avery 5160 Sheet" },
}

/** Avery 5160: 3x10 grid, each sticker 2.625in x 1in on US Letter. */
const AVERY = {
  cols: 3,
  rows: 10,
  labelW: 2.625 * 72,
  labelH: 1 * 72,
  marginLeft: 0.1875 * 72,
  marginTop: 0.5 * 72,
  gapX: 0.125 * 72,
  gapY: 0,
}

const styles = StyleSheet.create({
  hangtagPage: {
    padding: 10,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-start",
    backgroundColor: "#ffffff",
  },
  thermalPage: {
    padding: 18,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-start",
    backgroundColor: "#ffffff",
  },
  averyPage: {
    backgroundColor: "#ffffff",
  },
  averyCell: {
    position: "absolute",
    paddingHorizontal: 6,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#111111",
    textAlign: "center",
  },
  titleLarge: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#111111",
    textAlign: "center",
    marginTop: 6,
  },
  subtitle: {
    fontSize: 7,
    fontFamily: "Helvetica",
    color: "#444444",
    textAlign: "center",
    marginTop: 2,
  },
  subtitleLarge: {
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#444444",
    textAlign: "center",
    marginTop: 3,
  },
  footer: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: "#1a5f2a",
    textAlign: "center",
    marginTop: 6,
  },
  footerLarge: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#1a5f2a",
    textAlign: "center",
    marginTop: 8,
  },
  gtin: {
    fontSize: 7,
    fontFamily: "Courier",
    color: "#111111",
    textAlign: "center",
    marginTop: 4,
    letterSpacing: 0.4,
  },
  gtinLarge: {
    fontSize: 10,
    fontFamily: "Courier",
    color: "#111111",
    textAlign: "center",
    marginTop: 6,
    letterSpacing: 0.6,
  },
  linkTag: {
    fontSize: 5,
    fontFamily: "Helvetica",
    color: "#666666",
    textAlign: "center",
    marginLeft: 6,
  },
  averyTitle: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#111111",
  },
  averySub: {
    fontSize: 5.5,
    fontFamily: "Helvetica",
    color: "#444444",
    marginTop: 1,
  },
  averyFooter: {
    fontSize: 4.5,
    fontFamily: "Helvetica-Bold",
    color: "#1a5f2a",
    marginTop: 2,
  },
  averyGtin: {
    fontSize: 5,
    fontFamily: "Courier",
    color: "#111111",
    marginTop: 1,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
})

/** Stylized EU eco-design / recycling mark for print. */
function EuEcoBadge({ size = 28 }: { size?: number }) {
  const s = size
  return (
    <View style={{ width: s, height: s, alignItems: "center", justifyContent: "center" }}>
      <Svg width={s} height={s} viewBox="0 0 64 64">
        <Circle cx="32" cy="32" r="30" stroke="#1a5f2a" strokeWidth="2" fill="#f3faf4" />
        <Path
          d="M32 14c-7.2 0-13.4 4.2-16.2 10.2l4.6 2.1C22.4 21.8 26.9 19 32 19c5.8 0 10.7 3.6 12.7 8.7l4.9-1.8C46.7 18.6 39.9 14 32 14z"
          fill="#1a5f2a"
        />
        <Path d="M48.2 28.5l-5.2 9.1-1.8-5.4-5.5-1.9 12.5-4.6z" fill="#1a5f2a" />
        <Path
          d="M18.2 27.8c-1.8 4.1-1.5 8.9 1.1 12.7l4.1-3.1c-1.7-2.5-1.9-5.6-0.7-8.3l-4.5-1.3z"
          fill="#1a5f2a"
        />
        <Path
          d="M22.5 44.5c3.1 3.6 7.8 5.5 12.7 4.9l0.5-5c-3.5 0.4-6.9-1-9.1-3.6l-4.1 3.7z"
          fill="#1a5f2a"
        />
        <Path d="M35.2 44.2l8.8-6.2-1.2 5.6 4.8 3.1-12.4 2.1z" fill="#1a5f2a" />
      </Svg>
      <Text
        style={{
          position: "absolute",
          bottom: 2,
          fontSize: Math.max(4, size * 0.18),
          fontFamily: "Helvetica-Bold",
          color: "#1a5f2a",
        }}
      >
        EU
      </Text>
    </View>
  )
}

function LabelBody({ label, compact }: { label: PrintLabelData; compact?: boolean }) {
  const qrSize = compact ? 70 : 120
  const idLine = label.gtinAi01 || (label.serialNumber ? `S/N ${label.serialNumber}` : null)
  return (
    <View style={{ width: "100%", alignItems: "center" }}>
      <Text style={compact ? styles.title : styles.titleLarge}>{label.productTitle}</Text>
      {label.variantName ? (
        <Text style={compact ? styles.subtitle : styles.subtitleLarge}>{label.variantName}</Text>
      ) : null}
      <View style={{ marginTop: compact ? 8 : 12 }}>
        <Image src={label.qrDataUrl} style={{ width: qrSize, height: qrSize }} />
      </View>
      <Text style={compact ? styles.footer : styles.footerLarge}>{label.footerText}</Text>
      <View style={styles.badgeRow}>
        <EuEcoBadge size={compact ? 22 : 32} />
        <Text style={styles.linkTag}>
          {label.linkType === "gs1" ? "GS1 Digital Link" : "OriginPass Link"}
        </Text>
      </View>
      {idLine ? <Text style={compact ? styles.gtin : styles.gtinLarge}>{idLine}</Text> : null}
    </View>
  )
}

function AveryLabelCell({ label }: { label: PrintLabelData }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", width: "100%", height: "100%" }}>
      <Image src={label.qrDataUrl} style={{ width: 52, height: 52, marginRight: 6 }} />
      <View style={{ flex: 1, justifyContent: "center" }}>
        <Text style={styles.averyTitle} wrap={false}>
          {label.productTitle}
        </Text>
        {label.variantName ? (
          <Text style={styles.averySub} wrap={false}>
            {label.variantName}
          </Text>
        ) : null}
        <Text style={styles.averyFooter} wrap={false}>
          {label.footerText}
        </Text>
        {label.gtinAi01 ? (
          <Text style={styles.averyGtin} wrap={false}>
            {label.gtinAi01}
          </Text>
        ) : null}
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
          <EuEcoBadge size={12} />
          <Text style={{ fontSize: 4, color: "#1a5f2a", marginLeft: 3, fontFamily: "Helvetica-Bold" }}>
            EU Eco-Design
          </Text>
        </View>
      </View>
    </View>
  )
}

/** Single 2in x 3in apparel hangtag (144 x 216 pt). */
export function Hangtag2x3({ label }: { label: PrintLabelData }) {
  const page = LAYOUT_PAGE_SIZE["hangtag-2x3"]
  return (
    <Document title={`OriginPass ${page.label}`} author="OriginPass" creator="OriginPass">
      <Page size={[page.width, page.height]} style={styles.hangtagPage}>
        <LabelBody label={label} compact />
      </Page>
    </Document>
  )
}

/** Single 4in x 6in thermal / packaging label (288 x 432 pt). */
export function Thermal4x6({ label }: { label: PrintLabelData }) {
  const page = LAYOUT_PAGE_SIZE["thermal-4x6"]
  return (
    <Document title={`OriginPass ${page.label}`} author="OriginPass" creator="OriginPass">
      <Page size={[page.width, page.height]} style={styles.thermalPage}>
        <LabelBody label={label} />
      </Page>
    </Document>
  )
}

/** Avery 5160 US Letter sheet - 30 stickers (3x10), each 2.625in x 1in. */
export function Avery5160Sheet({ label }: { label: PrintLabelData }) {
  const page = LAYOUT_PAGE_SIZE["avery-5160"]
  const cells: Array<{ col: number; row: number }> = []
  for (let row = 0; row < AVERY.rows; row++) {
    for (let col = 0; col < AVERY.cols; col++) {
      cells.push({ col, row })
    }
  }

  return (
    <Document title={`OriginPass ${page.label}`} author="OriginPass" creator="OriginPass">
      <Page size={[page.width, page.height]} style={styles.averyPage}>
        {cells.map(({ col, row }) => {
          const left = AVERY.marginLeft + col * (AVERY.labelW + AVERY.gapX)
          const top = AVERY.marginTop + row * (AVERY.labelH + AVERY.gapY)
          return (
            <View
              key={`${col}-${row}`}
              style={{
                ...styles.averyCell,
                left,
                top,
                width: AVERY.labelW,
                height: AVERY.labelH,
              }}
            >
              <AveryLabelCell label={label} />
            </View>
          )
        })}
      </Page>
    </Document>
  )
}

/** Dispatch document by layout type (used by the export-pdf API). */
export function PrintDocument({
  layoutType,
  label,
}: {
  layoutType: PrintLayoutType
  label: PrintLabelData
}) {
  if (layoutType === "thermal-4x6") return <Thermal4x6 label={label} />
  if (layoutType === "avery-5160") return <Avery5160Sheet label={label} />
  return <Hangtag2x3 label={label} />
}

/** @deprecated Prefer PrintDocument */
export function HangtagDocument({
  layoutType,
  label,
}: {
  layoutType: PrintLayoutType
  label: PrintLabelData
}) {
  return <PrintDocument layoutType={layoutType} label={label} />
}

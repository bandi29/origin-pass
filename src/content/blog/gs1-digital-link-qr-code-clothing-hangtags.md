---
title: "How to Generate GS1 Digital Link QR Codes for Clothing Hangtags Without Redesigning Your Packaging"
description: "A step-by-step workflow for mapping apparel GTINs, generating GS1 Digital Link QR codes, and exporting print-ready hangtag and thermal-label PDFs."
slug: "gs1-digital-link-qr-code-clothing-hangtags"
date: "2026-07-27"
updated: "2026-07-27"
author: "OriginPass"
primaryKeyword: "GS1 Digital Link QR Code Hangtag"
---

# How to Generate GS1 Digital Link QR Codes for Clothing Hangtags Without Redesigning Your Packaging

Adding QR codes to garments sounds simple until it reaches production. The designer needs a new dieline, the factory needs approved artwork, the print shop asks about size and quiet zones, and operations must decide whether every color and size receives a different code.

For fashion brands preparing for EU digital-product-information requirements, that friction can delay an otherwise straightforward project. The practical solution is a **GS1 Digital Link QR Code Hangtag** workflow that works with existing Shopify variants and adds a secondary hangtag or label—without redesigning the primary packaging.

> **Important:** The EU ESPR requires a standards-compatible data carrier and persistent unique product identifier where a product-specific delegated act requires a Digital Product Passport. It does not currently say that every apparel passport must use GS1 Digital Link. GS1 Digital Link is a strong interoperability choice for brands already using GTINs.

## What Is GS1 Digital Link?

A traditional QR code often stores an ordinary marketing URL:

```text
https://yourbrand.com/products/linen-shirt
```

That link does not necessarily express a globally recognized product identifier. Handles can change, storefronts can migrate, and one page may contain many variants.

GS1 Digital Link represents GS1 identifiers using web URI syntax. For a GTIN, the numeric Application Identifier is `01`:

```text
https://id.yourbrand.com/01/09506000134376
```

Here:

- `https://id.yourbrand.com` is the resolver domain.
- `01` identifies the following value as a GTIN.
- `09506000134376` is the GTIN represented in the URI.

A standards-aware application can interpret the identifier, while a smartphone opens it as a web address. The resolver can then direct the user to a passport or another authorized resource.

### Why Not Use a Direct Product-Page Link?

A direct link can be useful, but a persistent identity layer offers more control:

- The printed QR can keep working after a Shopify theme or URL change.
- A variant can have its own identifier even when variants share a product page.
- Different link types can be served from the same identity.
- The brand can change the passport destination without reprinting the code.
- Supply-chain systems can recognize the GTIN embedded in the URI.

Do not invent GTINs. Use legitimate identifiers licensed through GS1 or another authorized source applicable to your market.

## The Zero-Packaging-Redesign Workflow

You do not need to reopen every garment box or rebuild every printed sleeve. Start with an additive format:

- A small secondary apparel hangtag
- A thermal label attached to the existing swing tag
- An Avery-style sheet label applied during fulfillment
- A QR sticker placed on accompanying documentation

The final placement should follow the applicable product rules and survive the expected handling environment.

## Step 1: Assign GTINs to Shopify Size and Color Variants

A Shopify product can contain multiple sellable variants. A navy shirt in medium and a navy shirt in large normally represent distinct trade items and should not silently share one GTIN.

1. In Shopify Admin, open **Products**.
2. Select the apparel product.
3. Open each size/color variant.
4. Confirm the internal **SKU**.
5. Enter the assigned GTIN, UPC, or EAN in the **Barcode** field.
6. Repeat for every sellable variant.
7. Export the catalog and scan for blank or duplicate barcode values.

Use this simple control table:

| Variant | SKU | GTIN/barcode | Passport status |
| --- | --- | --- | --- |
| Black / S | TEE-BLK-S | 09506000134376 | Ready |
| Black / M | TEE-BLK-M | 09506000134383 | Ready |
| Black / L | TEE-BLK-L | Missing | Blocked |

> **Quality rule:** Never use the Shopify SKU as though it were a GTIN. The SKU is brand-defined; the GTIN follows GS1 identification rules.

## Step 2: Create a Persistent Digital Link

For each eligible variant, construct a URI using your resolver domain and the correct identifier.

```text
https://id.yourbrand.com/01/09506000134376
```

If your underlying GTIN is stored in a shorter presentation form, follow the current GS1 Digital Link standard for valid URI expression and normalization. Do not blindly add zeros without validating the check digit and identifier format.

The resolver should recognize the GTIN, locate the correct variant, return a mobile-friendly destination, survive storefront changes, and protect non-public records.

OriginPass can connect the identifier to the interactive product passport while keeping the QR destination manageable from one dashboard.

## Step 3: Choose a Print Layout

The right output depends on where the code is applied and how the printer operates.

### 2 x 3-Inch Apparel Hangtags

This format provides room for:

- Brand name or logo
- QR code
- "Scan for materials, origin, and care"
- Product or variant name
- Human-readable GTIN
- Optional legal or care copy

Keep the code away from holes, folds, foil, stitching, textured stock, and trimmed edges.

### 4 x 6-Inch Thermal Rolls

Thermal labels work well for factories, warehouses, and small-batch fulfillment. A 4 x 6-inch canvas can contain one large garment label or several smaller labels, depending on printer settings and cutting workflow.

For reliable output:

- Generate artwork at the exact label dimensions.
- Print at 100% scale.
- Disable "Fit to page."
- Use dark output on a light, non-reflective background.
- Test the lowest-quality printer used in production.

### 30-Up Avery-Compatible Sheets

Sheet labels are useful for pilots and lower volumes. The PDF must match the exact label product's margins, pitch, gutters, and page size. "30-up" alone is not enough to guarantee alignment across all templates.

Print one proof on plain paper, place it behind the label sheet, and check the alignment against a light source before loading adhesive stock.

## Step 4: Export Vector PDF Artwork

A **print-ready QR hangtag PDF** should preserve sharp edges. Vector artwork is preferable because the QR modules remain crisp when the print shop scales or places the design.

Before sending the file:

1. Confirm the page dimensions.
2. Embed fonts or convert approved text to outlines.
3. Preserve a clear quiet zone around the code.
4. Use strong contrast.
5. Avoid resampling the QR into a blurry bitmap.
6. Add a human-readable GTIN or reference.
7. Confirm that the file contains the correct variant code.

> **Print-shop note:** Request output at actual size with no automatic scaling. Ask for a physical proof whenever the substrate, laminate, varnish, or print process changes.

## Step 5: Test Consumer and Operational Scanning

Do not approve a QR code by viewing the PDF on a monitor. Print it at final size and test the real material.

### Smartphone Test

Scan with:

- A current iPhone camera
- A current Android camera
- Low and bright lighting
- The actual intended scan distance
- The label on a curved or hanging garment

The scan should open quickly and route to the correct mobile passport without requiring a special application.

### Industrial and Workflow Test

An industrial scanner's behavior depends on its imaging capability, configuration, and software. Traditional laser-only 1D scanners cannot read QR codes. A 2D imager may capture the code, but the receiving system must understand the encoded data and GS1 Digital Link URI if you expect it to extract or resolve the GTIN.

Test:

1. Whether the scanner reads QR Code symbology.
2. Whether it outputs the full URI.
3. Whether middleware parses Application Identifier `01`.
4. Whether the correct GTIN reaches the inventory or traceability system.
5. Whether the same symbol still works for consumer smartphone access.

This dual-use test prevents a common mistake: assuming that because a phone opens the URL, every warehouse system will automatically resolve the GTIN.

## How to Automate the Workflow in Three Minutes With OriginPass

For a prepared Shopify catalog, OriginPass reduces the repeated setup work.

### 1. Connect Your Shopify Catalog

Install OriginPass and select the products or collection you want to prepare. OriginPass imports the relevant products, variants, SKUs, and barcode fields, then flags missing or duplicate identifiers.

### 2. Select the Label Layout

Choose the production format:

- **2 x 3-inch apparel hangtag**
- **4 x 6-inch thermal label**
- **30-up Avery-compatible sheet**

Preview the product name, variant, GTIN, QR code, and scan instruction before export.

### 3. Download the Vector PDF

Generate the batch and download the print-ready PDF. Send it directly to the factory or print shop, or print it on-site for a pilot.

Before full production, scan at least one physical label from every artwork template and printing method.

## Export Your First QR Hangtags

You can introduce a persistent product identity without delaying the next packaging run. Start with a secondary hangtag or label, validate the workflow on a small product batch, and expand after the scans and data are confirmed.

**[Install OriginPass on the Shopify App Store](https://apps.shopify.com/originpass)** to connect your catalog and export your first batch of print-ready QR hangtags for free.

> OriginPass supports product-data and compliance-readiness workflows. Final legal requirements depend on the applicable EU product-specific rules and your role in the supply chain.

## Authoritative Sources

- [GS1 Digital Link URI Syntax standard](https://www.gs1.org/docs/Digital-Link/GS1_Digital_Link_Standard_URI_Syntax_r_i1-2-1_2022-02-08.pdf)
- [GS1 QR Code best practices](https://ref.gs1.org/docs/2023/QR-Code_powered-by-GS1-best-practices)
- [Regulation (EU) 2024/1781 — ESPR](https://eur-lex.europa.eu/eli/reg/2024/1781/oj/eng)
- [Shopify Help: Understanding barcodes](https://help.shopify.com/en/manual/fulfillment/setup/packaging/barcodes)

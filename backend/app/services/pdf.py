"""Dependency-free branded PDF rendering for documents (quotations, invoices).

Implements a minimal PDF 1.4 writer with a hand-built content stream so the
API can serve real `application/pdf` downloads without external libraries.
Text is rendered in Helvetica; non-Latin-1 characters are replaced.
"""
from typing import List, Tuple, Optional


PAGE_W = 595.0   # A4 width  in points
PAGE_H = 842.0   # A4 height in points
MARGIN = 48.0
CONTENT_TOP = PAGE_H - 92.0


def _pdf_str(value: str) -> str:
    """Escape a string for a PDF literal string object."""
    return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _latin1(value: str) -> str:
    return value.encode("latin-1", errors="replace").decode("latin-1")


def _truncate(value: str, max_chars: int) -> str:
    value = value.replace("\n", " ")
    return value if len(value) <= max_chars else value[: max_chars - 1] + "\u2026"


class _Doc:
    """Collects PDF objects and writes the final file bytes."""

    def __init__(self) -> None:
        self.objects: List[Tuple[bytes, int]] = []  # (object body, offset)

    def add(self, body) -> int:
        raw = body if isinstance(body, bytes) else body.encode("latin-1", errors="replace")
        self.objects.append((raw, 0))
        return len(self.objects)

    def build(self) -> bytes:
        out = bytearray(b"%PDF-1.4\n")
        offsets = [0] * len(self.objects)
        for i, (body, _) in enumerate(self.objects):
            offsets[i] = len(out)
            out += b"%d 0 obj\n" % (i + 1)
            out += body
            out += b"endobj\n"
        xref_start = len(out)
        out += b"xref\n0 %d\n" % (len(self.objects) + 1)
        out += b"0000000000 65535 f \n"
        for off in offsets:
            out += b"%010d 00000 n \n" % off
        out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (
            len(self.objects) + 1,
            xref_start,
        )
        return bytes(out)


def _content_doc(
    brand: str,
    doc_kind: str,
    doc_number: str,
    meta_lines: List[Tuple[str, str]],
    title: str,
    columns: List[str],
    rows: List[List[str]],
    totals: List[Tuple[str, str]],
    notes: List[str],
) -> bytes:
    doc = _Doc()
    doc.add(b"<< /Type /Catalog /Pages 2 0 R >>")
    doc.add(b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
    page = (
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
        b"/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>"
    )
    doc.add(page)
    doc.add(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    doc.add(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")

    width = PAGE_W - 2 * MARGIN
    col_widths = [width * 0.36] + [width * 0.10] * 2 + [width * 0.14] * 3
    if len(columns) < len(col_widths):
        col_widths = col_widths[: len(columns)]
    col_widths = [w * (width / sum(col_widths)) for w in col_widths]

    y = CONTENT_TOP
    s: List[str] = []

    def text(size: int, x: float, yy: float, content: str, bold: bool = False, right: bool = False) -> float:
        font = "/F2" if bold else "/F1"
        op = "Tj"
        s.append(f"BT {font} {size} Tf {x:.1f} {yy:.1f} Td ({_pdf_str(content)}) Tj ET")
        return yy

    # ---- brand band ----
    s.append(f"0.0588 0.0902 0.1647 rg 0 740 {PAGE_W} 102 re f")
    s.append("1 1 1 rg")
    text(22, MARGIN, 800, _latin1(brand), bold=True)
    text(11, MARGIN, 782, _latin1(f"{doc_kind}  \u2022  {doc_number}"), right=False)
    text(10, MARGIN, 766, _latin1(" & ".join(f"{k}: {v}" for k, v in meta_lines)), right=False)
    s.append("0 0 0 rg")

    y = 712.0
    text(16, MARGIN, y, _latin1(title), bold=True)
    y -= 26.0

    # ---- table header ----
    s.append("0.945 0.961 0.973 rg ")
    for i, col in enumerate(columns):
        cx = MARGIN + sum(col_widths[:i])
        cw = col_widths[i]
        s.append(f"{cx:.1f} {y - 22:.1f} {cw:.1f} 22 re f")
        text(8, cx + 6, y - 14, _latin1(col[: 20]), bold=True)
    y -= 26.0

    row_h = 20.0
    for idx, row in enumerate(rows):
        if y < 80:
            break
        for i, cell in enumerate(row):
            cx = MARGIN + sum(col_widths[: min(i, len(col_widths) - 1)])
            cw = col_widths[min(i, len(col_widths) - 1)]
            max_chars = max(10, int(cw / (0.5 * 9)))
            align_right = i >= len(columns) - 3
            xpos = cx + cw - 6 if align_right else cx + 6
            text(9, xpos, y - 14, _latin1(_truncate(str(cell), max_chars)), right=align_right)
        if idx % 2 == 0:
            s.append(f"0.984 0.988 0.992 rg {MARGIN:.1f} {y - 20:.1f} {width:.1f} {row_h:.1f} re f")
        y -= row_h

    # footer line above totals
    s.append(f"0.85 0.9 0.95 RG 1 w {MARGIN:.1f} {y + 12:.1f} {width:.1f} 0 re S")

    for label, value in totals:
        text(10, PAGE_W - MARGIN - 90, y - 8, _latin1(label), bold=True, right=True)
        text(10, PAGE_W - MARGIN - 130, y - 8, _latin1(str(value)), right=True)
        y -= 20.0

    for note in notes:
        y -= 16.0
        text(9, MARGIN, y, _latin1(_truncate(note, 105)))

    s.append(
        f"0.25 0.55 0.75 RG 0.6 w {PAGE_W / 2 - 80:.1f} {28:.1f} {160:.1f} 0 re S"
    )
    text(8, PAGE_W / 2 - 76, 24, "Project Labs  \u2022  www.projectlabs.test", right=False)
    text(8, PAGE_W / 2 - 76, 12, "Generated from PROJECT LABS platform", right=False)

    content = "\n".join(s) + "\n"
    raw = content.encode("latin-1", errors="replace")
    doc.add(b"<< /Length %d >>\nstream\n" % len(raw) + raw + b"\nendstream")
    return doc.build()


def quotation_pdf_bytes(
    quotation_number: str,
    version: int,
    title: str,
    issued_date: str,
    valid_until: str,
    status: str,
    customer_lines: List[Tuple[str, str]],
    items: List[dict],
    subtotal: float,
    discount: float,
    tax: float,
    total: float,
    currency: str,
    payment_terms: Optional[str] = None,
    customer_message: Optional[str] = None,
) -> bytes:
    rows = [
        [
            i.get("name") or "",
            str(i.get("quantity") or ""),
            f"{float(i.get('unit_price') or 0):,.2f}",
            f"{float(i.get('discount') or 0):,.2f}",
            f"{float(i.get('tax') or 0):,.2f}",
            f"{float(i.get('total') or 0):,.2f}",
        ]
        for i in items
    ]
    notes = [f"Payment terms: {payment_terms}"] if payment_terms else []
    if customer_message:
        notes.append(f"Customer message: {customer_message}")
    return _content_doc(
        brand="PROJECT LABS",
        doc_kind="Quotation",
        doc_number=f"{quotation_number} (v{version})",
        meta_lines=[("Issued", issued_date), ("Valid until", valid_until), ("Status", status)],
        title=title,
        columns=["Item", "Qty", "Unit Price", "Discount", "Tax", "Total"],
        rows=rows,
        totals=[
            ("Subtotal", f"{subtotal:,.2f} {currency}"),
            ("Discount", f"-{discount:,.2f}"),
            ("Tax", f"+{tax:,.2f}"),
            ("TOTAL", f"{total:,.2f} {currency}"),
        ],
        notes=notes,
    )


def invoice_pdf_bytes(
    invoice_number: str,
    title: str,
    status: str,
    issued_date: str,
    due_date: str,
    customer_lines: List[Tuple[str, str]],
    items: List[dict],
    subtotal: float,
    discount: float,
    tax: float,
    total: float,
    currency: str,
    notes: Optional[str] = None,
) -> bytes:
    rows = [
        [
            i.get("description") or "",
            str(i.get("quantity") or ""),
            f"{float(i.get('unit_price') or 0):,.2f}",
            f"{float(i.get('discount') or 0):,.2f}",
            f"{float(i.get('tax') or 0):,.2f}",
            f"{float(i.get('total') or 0):,.2f}",
        ]
        for i in items
    ]
    _ = customer_lines  # reserved for billed-to block
    return _content_doc(
        brand="PROJECT LABS",
        doc_kind="Invoice",
        doc_number=invoice_number,
        meta_lines=[("Issued", issued_date), ("Due", due_date), ("Status", status)],
        title=title,
        columns=["Item", "Qty", "Unit Price", "Discount", "Tax", "Total"],
        rows=rows,
        totals=[
            ("Subtotal", f"{subtotal:,.2f} {currency}"),
            ("Discount", f"-{discount:,.2f}"),
            ("Tax", f"+{tax:,.2f}"),
            ("TOTAL", f"{total:,.2f} {currency}"),
        ],
        notes=[f"Notes: {notes}"] if notes else [],
    )
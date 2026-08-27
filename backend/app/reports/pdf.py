# app/reports/pdf.py

import io
from datetime import datetime
try:
    from reportlab.lib.pagesizes import letter
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.pdfgen import canvas
except ImportError:
    import subprocess
    import sys
    print("ReportLab package not found. Installing dynamically...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "reportlab==4.1.0"])
    from reportlab.lib.pagesizes import letter
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas to dynamically compute and draw total page count,
    running headers, and running footers on every page except the cover.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        # Page 1 is the cover page - do not draw header/footer
        if self._pageNumber > 1:
            self.saveState()
            self.setFont("Helvetica", 9)
            self.setFillColor(colors.HexColor("#64748B"))
            
            # Header
            self.drawString(54, 750, "SigmaSec Security Platform — Vulnerability Scan Report")
            self.setStrokeColor(colors.HexColor("#E2E8F0"))
            self.setLineWidth(0.5)
            self.line(54, 742, 558, 742)
            
            # Footer
            page_text = f"Page {self._pageNumber} of {page_count}"
            self.drawRightString(558, 40, page_text)
            self.drawString(54, 40, "CONFIDENTIAL — FOR INTERNAL USE ONLY")
            self.line(54, 52, 558, 52)
            
            self.restoreState()


class ScanReport:
    """
    Compiles scans and findings database records into a professional PDF document.
    """
    def __init__(self, scan, findings, template: str = "executive"):
        self.scan = scan
        self.findings = findings
        self.template = template

    def generate(self) -> bytes:
        buffer = io.BytesIO()
        # standard letter size: 612 x 792 points. Margins: 0.75 in (54 pt)
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=54,
            leftMargin=54,
            topMargin=72,
            bottomMargin=72
        )
        
        story = []
        
        # 1. Cover Page
        self._add_cover(story)
        story.append(PageBreak())
        
        # 2. Executive Summary Page
        self._add_executive_summary(story)
        story.append(PageBreak())
        
        # 3. Top 10 (AI summaries + remediation + reachability)
        self._add_top_10(story)
        
        # 4. Full list (Only for technical template)
        if self.template == "technical":
            story.append(PageBreak())
            self._add_full_list(story)
            
        doc.build(story, canvasmaker=NumberedCanvas)
        buffer.seek(0)
        return buffer.getvalue()

    def _add_cover(self, story):
        styles = getSampleStyleSheet()
        
        title_style = ParagraphStyle(
            "CoverTitle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=30,
            leading=36,
            textColor=colors.HexColor("#0F172A"),
            spaceAfter=15
        )
        
        subtitle_style = ParagraphStyle(
            "CoverSubtitle",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=15,
            leading=20,
            textColor=colors.HexColor("#4F46E5"),
            spaceAfter=40
        )
        
        meta_label_style = ParagraphStyle(
            "CoverMetaLabel",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#475569")
        )
        
        meta_val_style = ParagraphStyle(
            "CoverMetaValue",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#0F172A")
        )
        
        # Header Accent Bar
        accent_bar = Table([[""]], colWidths=[504], rowHeights=[6])
        accent_bar.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#4F46E5")),
            ('BOTTOMPADDING', (0,0), (-1,-1), 0),
            ('TOPPADDING', (0,0), (-1,-1), 0),
        ]))
        story.append(accent_bar)
        story.append(Spacer(1, 35))
        
        story.append(Paragraph("SigmaSec Platform", subtitle_style))
        story.append(Paragraph("Vulnerability Assessment Report", title_style))
        story.append(Spacer(1, 20))
        
        # Metadata Table
        created_at_str = self.scan.created_at.strftime("%B %d, %Y at %H:%M UTC") if self.scan.created_at else "N/A"
        meta_data = [
            [Paragraph("Target Asset:", meta_label_style), Paragraph(self.scan.target, meta_val_style)],
            [Paragraph("Scan Type(s):", meta_label_style), Paragraph(", ".join(self.scan.scan_types).upper(), meta_val_style)],
            [Paragraph("Report Template:", meta_label_style), Paragraph(self.template.capitalize(), meta_val_style)],
            [Paragraph("Execution Date:", meta_label_style), Paragraph(created_at_str, meta_val_style)],
            [Paragraph("Scan ID:", meta_label_style), Paragraph(str(self.scan.id), meta_val_style)],
        ]
        
        meta_table = Table(meta_data, colWidths=[110, 394])
        meta_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 8),
            ('TOPPADDING', (0,0), (-1,-1), 8),
            ('LINEBELOW', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ]))
        story.append(meta_table)
        story.append(Spacer(1, 45))
        
        # Severity summary grid
        severity_title_style = ParagraphStyle(
            "SevTitle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=13,
            leading=16,
            textColor=colors.HexColor("#0F172A"),
            spaceAfter=15
        )
        story.append(Paragraph("Vulnerability Count by Severity", severity_title_style))
        
        counts = self.scan.findings_count
        
        def make_badge_cell(label, count, bg_color, text_color):
            lbl_style = ParagraphStyle("Lbl_" + label, fontName="Helvetica-Bold", fontSize=9, textColor=text_color, alignment=1)
            cnt_style = ParagraphStyle("Cnt_" + label, fontName="Helvetica-Bold", fontSize=18, textColor=text_color, alignment=1)
            t = Table([[Paragraph(count, cnt_style)], [Paragraph(label.upper(), lbl_style)]], colWidths=[90])
            t.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,-1), bg_color),
                ('ALIGN', (0,0), (-1,-1), 'CENTER'),
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ('BOTTOMPADDING', (0,0), (-1,-1), 6),
                ('TOPPADDING', (0,0), (-1,-1), 6),
            ]))
            return t

        badge_table = Table([[
            make_badge_cell("Critical", str(counts.get("critical", 0)), colors.HexColor("#FEE2E2"), colors.HexColor("#991B1B")),
            make_badge_cell("High", str(counts.get("high", 0)), colors.HexColor("#FFEDD5"), colors.HexColor("#9A3412")),
            make_badge_cell("Medium", str(counts.get("medium", 0)), colors.HexColor("#FEF9C3"), colors.HexColor("#854D0E")),
            make_badge_cell("Low", str(counts.get("low", 0)), colors.HexColor("#DBEAFE"), colors.HexColor("#1E40AF")),
            make_badge_cell("Info", str(counts.get("info", 0)), colors.HexColor("#F1F5F9"), colors.HexColor("#334155")),
        ]], colWidths=[96, 96, 96, 96, 96])
        badge_table.setStyle(TableStyle([
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ]))
        story.append(badge_table)

    def _add_executive_summary(self, story):
        styles = getSampleStyleSheet()
        
        section_title_style = ParagraphStyle(
            "SectionTitle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=18,
            leading=22,
            textColor=colors.HexColor("#0F172A"),
            spaceAfter=15
        )
        
        body_style = ParagraphStyle(
            "ExecBody",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=11,
            leading=17,
            textColor=colors.HexColor("#334155")
        )
        
        story.append(Paragraph("Executive Summary", section_title_style))
        story.append(Spacer(1, 10))
        
        summary_text = self.scan.exec_summary or (
            "An executive summary is currently being generated. "
            "Please review the technical findings registry for direct details."
        )
        
        summary_table = Table([[Paragraph(summary_text, body_style)]], colWidths=[504])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F8FAFC")),
            ('TOPPADDING', (0,0), (-1,-1), 14),
            ('BOTTOMPADDING', (0,0), (-1,-1), 14),
            ('LEFTPADDING', (0,0), (-1,-1), 18),
            ('RIGHTPADDING', (0,0), (-1,-1), 14),
            ('LINELEFT', (0,0), (-1,-1), 4, colors.HexColor("#4F46E5")),
        ]))
        story.append(summary_table)
        story.append(Spacer(1, 25))
        
        sub_title_style = ParagraphStyle(
            "ExecSubTitle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=13,
            leading=16,
            textColor=colors.HexColor("#0F172A"),
            spaceAfter=10
        )
        story.append(Paragraph("Risk & Security Posture Assessment", sub_title_style))
        
        total_findings = len(self.findings)
        critical_and_high = self.scan.findings_count.get("critical", 0) + self.scan.findings_count.get("high", 0)
        
        posture_description = (
            f"The comprehensive vulnerability audit of <b>{self.scan.target}</b> identified <b>{total_findings}</b> security findings. "
            f"Of these, <b>{critical_and_high}</b> are categorized as Critical or High severity. "
            "These findings pose active vectors of threat, representing pathways of potential intrusion or data exposure. "
            "Organizations should target remediation operations on Critical and High items immediately."
        )
        if total_findings == 0:
            posture_description = (
                f"The security scan of <b>{self.scan.target}</b> detected no vulnerabilities. "
                "The scanned endpoints adhere to standard baseline expectations, presenting a clean posture."
            )
            
        story.append(Paragraph(posture_description, body_style))

    def _add_top_10(self, story):
        styles = getSampleStyleSheet()
        
        section_title_style = ParagraphStyle(
            "SectionTitle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=18,
            leading=22,
            textColor=colors.HexColor("#0F172A"),
            spaceAfter=15
        )
        
        finding_title_style = ParagraphStyle(
            "FindingTitle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=15,
            textColor=colors.HexColor("#1E293B")
        )
        
        meta_style = ParagraphStyle(
            "FindingMeta",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=11,
            textColor=colors.HexColor("#64748B")
        )
        
        body_style = ParagraphStyle(
            "FindingBody",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=9,
            leading=13,
            textColor=colors.HexColor("#334155")
        )
        
        header_lbl_style = ParagraphStyle(
            "HeaderLbl",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8.5,
            leading=11,
            textColor=colors.HexColor("#475569")
        )
        
        story.append(Paragraph("Top 10 Prioritized Vulnerabilities", section_title_style))
        story.append(Spacer(1, 10))
        
        top_10 = sorted(self.findings, key=lambda x: x.priority_score or 0.0, reverse=True)[:10]
        
        if not top_10:
            story.append(Paragraph("No vulnerabilities were identified in this scan.", body_style))
            return
            
        severity_colors = {
            "critical": colors.HexColor("#EF4444"),
            "high": colors.HexColor("#F97316"),
            "medium": colors.HexColor("#FACC15"),
            "low": colors.HexColor("#3B82F6"),
            "info": colors.HexColor("#6B7280"),
        }
        
        for idx, f in enumerate(top_10):
            finding_flowables = []
            
            sev_val = f.severity.value if hasattr(f.severity, "value") else str(f.severity)
            sev_color = severity_colors.get(sev_val.lower(), colors.HexColor("#6B7280"))
            
            # Header line: Title & score
            header_data = [
                [
                    Paragraph(f"<b>#{idx+1}. {f.title}</b>", finding_title_style),
                    Paragraph(f"Score: <b>{f.priority_score or 0.0:.2f}</b>", ParagraphStyle("Prio", fontName="Helvetica", fontSize=9, textColor=colors.HexColor("#4F46E5"), alignment=2))
                ]
            ]
            header_table = Table(header_data, colWidths=[370, 110])
            header_table.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ('BOTTOMPADDING', (0,0), (-1,-1), 4),
                ('TOPPADDING', (0,0), (-1,-1), 4),
            ]))
            finding_flowables.append(header_table)
            
            # Metadata row
            reach_val = f.reachability.value if hasattr(f.reachability, "value") else str(f.reachability)
            meta_txt = (
                f"<b>Severity:</b> <font color='{sev_color.hexval()}'>{sev_val.upper()}</font>  |  "
                f"<b>CVE:</b> {f.cve_id or 'N/A'}  |  "
                f"<b>Reachability:</b> {reach_val.upper()}  |  "
                f"<b>Tool:</b> {f.tool.upper()}"
            )
            finding_flowables.append(Paragraph(meta_txt, meta_style))
            finding_flowables.append(Spacer(1, 8))
            
            # AI plain-English summary
            finding_flowables.append(Paragraph("<b>AI Summary:</b>", header_lbl_style))
            summary_txt = f.ai_plain_english or f.description or "No description or summary available."
            finding_flowables.append(Paragraph(summary_txt, body_style))
            finding_flowables.append(Spacer(1, 6))
            
            # Reachability analysis
            if f.reachability_reason:
                finding_flowables.append(Paragraph("<b>Reachability Analysis:</b>", header_lbl_style))
                finding_flowables.append(Paragraph(f.reachability_reason, body_style))
                finding_flowables.append(Spacer(1, 6))
                
            # Remediation
            if f.ai_remediation:
                finding_flowables.append(Paragraph("<b>Remediation Plan:</b>", header_lbl_style))
                remed_list = []
                for step_idx, step in enumerate(f.ai_remediation):
                    # Check if step contains a patch diff
                    if "Recommended Patch Diff" in step or "diff --git" in step:
                        code_style = ParagraphStyle(
                            "CodeStyle",
                            fontName="Courier",
                            fontSize=7,
                            leading=9,
                            textColor=colors.HexColor("#0F172A")
                        )
                        # Replace spaces with non-breaking spaces and newlines with <br/>
                        formatted_patch = step.replace("\n", "<br/>").replace(" ", "&nbsp;")
                        patch_table = Table([[Paragraph(formatted_patch, code_style)]], colWidths=[456])
                        patch_table.setStyle(TableStyle([
                            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F1F5F9")),
                            ('PADDING', (0,0), (-1,-1), 6),
                            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                        ]))
                        remed_list.append(patch_table)
                        remed_list.append(Spacer(1, 4))
                    else:
                        remed_list.append(Paragraph(f"{step_idx+1}. {step}", body_style))
                
                finding_flowables.extend(remed_list)
            
            # Group finding fields inside a single container table
            container_table = Table([[finding_flowables]], colWidths=[480])
            container_table.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#FFFFFF")),
                ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
                ('TOPPADDING', (0,0), (-1,-1), 10),
                ('BOTTOMPADDING', (0,0), (-1,-1), 10),
                ('LEFTPADDING', (0,0), (-1,-1), 10),
                ('RIGHTPADDING', (0,0), (-1,-1), 10),
            ]))
            
            story.append(KeepTogether([
                container_table,
                Spacer(1, 12)
            ]))

    def _add_full_list(self, story):
        styles = getSampleStyleSheet()
        
        section_title_style = ParagraphStyle(
            "SectionTitle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=18,
            leading=22,
            textColor=colors.HexColor("#0F172A"),
            spaceAfter=15
        )
        
        table_hdr_style = ParagraphStyle(
            "TableHdr",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8.5,
            leading=11,
            textColor=colors.HexColor("#0F172A")
        )
        
        table_cell_style = ParagraphStyle(
            "TableCell",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=10,
            textColor=colors.HexColor("#334155")
        )
        
        story.append(Paragraph("Full Vulnerability Registry", section_title_style))
        story.append(Spacer(1, 10))
        
        sorted_findings = sorted(self.findings, key=lambda x: x.priority_score or 0.0, reverse=True)
        
        table_data = [
            [
                Paragraph("Severity", table_hdr_style),
                Paragraph("CVE ID / Tool", table_hdr_style),
                Paragraph("Vulnerability Title", table_hdr_style),
                Paragraph("Score", table_hdr_style),
                Paragraph("Status", table_hdr_style)
            ]
        ]
        
        severity_colors_hex = {
            "critical": "#EF4444",
            "high": "#F97316",
            "medium": "#FACC15",
            "low": "#3B82F6",
            "info": "#6B7280",
        }
        
        for f in sorted_findings:
            sev_val = f.severity.value if hasattr(f.severity, "value") else str(f.severity)
            sev_color = severity_colors_hex.get(sev_val.lower(), "#6B7280")
            
            cve_or_tool = f.cve_id or f.tool.upper()
            
            sev_cell = Paragraph(f"<font color='{sev_color}'><b>{sev_val.upper()}</b></font>", table_cell_style)
            cve_cell = Paragraph(cve_or_tool, table_cell_style)
            title_cell = Paragraph(f.title, table_cell_style)
            score_cell = Paragraph(f"{f.priority_score or 0.0:.2f}", table_cell_style)
            
            status_val = f.status.value if hasattr(f.status, "value") else str(f.status)
            status_cell = Paragraph(status_val.replace("_", " ").capitalize(), table_cell_style)
            
            table_data.append([sev_cell, cve_cell, title_cell, score_cell, status_cell])
            
        # Standard letter width is 612, - 108 margins = 504.
        findings_table = Table(table_data, colWidths=[65, 90, 244, 40, 65])
        findings_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#F8FAFC")),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
            ('TOPPADDING', (0,0), (-1,-1), 5),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F8FAFC")]),
        ]))
        
        story.append(findings_table)

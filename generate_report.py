"""
CampusFind - Academic Project Report Generator
Generates a comprehensive, professional Microsoft Word (.docx) document
for submission to faculty and professors for the Advanced Cloud Computing project.
"""

import os
import docx
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn

def create_report():
    doc = Document()

    # Configure 1 inch margins
    sections = doc.sections
    for section in sections:
        section.top_margin = Inches(1.0)
        section.bottom_margin = Inches(1.0)
        section.left_margin = Inches(1.0)
        section.right_margin = Inches(1.0)

    # Color Palette constants
    NAVY = RGBColor(30, 58, 138)       # #1E3A8A - Primary Header
    BLUE = RGBColor(37, 99, 235)       # #2563EB - Secondary
    DARK_GRAY = RGBColor(51, 65, 85)   # #334155 - Body
    LIGHT_GRAY = "F1F5F9"              # Table background
    NAVY_HEX = "1E3A8A"                # Table header background

    # Helper: Set cell background color
    def set_cell_background(cell, fill_hex):
        shading = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
        cell._tc.get_or_add_tcPr().append(shading)

    # Helper: Set cell margins
    def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
        tcPr = cell._tc.get_or_add_tcPr()
        tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}><w:top w:w="{top}" w:type="dxa"/><w:bottom w:w="{bottom}" w:type="dxa"/><w:left w:w="{left}" w:type="dxa"/><w:right w:w="{right}" w:type="dxa"/></w:tcMar>')
        tcPr.append(tcMar)

    # Helper: Add styled heading
    def add_heading_1(text):
        h = doc.add_paragraph()
        h.paragraph_format.space_before = Pt(18)
        h.paragraph_format.space_after = Pt(6)
        h.paragraph_format.keep_with_next = True
        run = h.add_run(text)
        run.font.name = "Arial"
        run.font.size = Pt(16)
        run.font.bold = True
        run.font.color.rgb = NAVY
        return h

    def add_heading_2(text):
        h = doc.add_paragraph()
        h.paragraph_format.space_before = Pt(14)
        h.paragraph_format.space_after = Pt(4)
        h.paragraph_format.keep_with_next = True
        run = h.add_run(text)
        run.font.name = "Arial"
        run.font.size = Pt(13)
        run.font.bold = True
        run.font.color.rgb = BLUE
        return h

    def add_heading_3(text):
        h = doc.add_paragraph()
        h.paragraph_format.space_before = Pt(10)
        h.paragraph_format.space_after = Pt(2)
        h.paragraph_format.keep_with_next = True
        run = h.add_run(text)
        run.font.name = "Arial"
        run.font.size = Pt(11)
        run.font.bold = True
        run.font.color.rgb = DARK_GRAY
        return h

    def add_body(text, bold_prefix="", italic=False):
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(6)
        p.paragraph_format.line_spacing = 1.15
        if bold_prefix:
            r_bold = p.add_run(bold_prefix)
            r_bold.font.name = "Calibri"
            r_bold.font.size = Pt(11)
            r_bold.font.bold = True
            r_bold.font.color.rgb = DARK_GRAY
        r = p.add_run(text)
        r.font.name = "Calibri"
        r.font.size = Pt(11)
        r.font.italic = italic
        r.font.color.rgb = DARK_GRAY
        return p

    def add_bullet(text, bold_prefix=""):
        p = doc.add_paragraph(style='List Bullet')
        p.paragraph_format.space_after = Pt(3)
        p.paragraph_format.line_spacing = 1.15
        if bold_prefix:
            r_bold = p.add_run(bold_prefix)
            r_bold.font.name = "Calibri"
            r_bold.font.size = Pt(11)
            r_bold.font.bold = True
            r_bold.font.color.rgb = DARK_GRAY
        r = p.add_run(text)
        r.font.name = "Calibri"
        r.font.size = Pt(11)
        r.font.color.rgb = DARK_GRAY
        return p

    def add_callout(title, text):
        tbl = doc.add_table(rows=1, cols=1)
        tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
        cell = tbl.cell(0, 0)
        set_cell_background(cell, "EFF6FF") # Light blue tint
        set_cell_margins(cell, top=140, bottom=140, left=200, right=200)

        # Border styling: thick left blue border
        tcPr = cell._tc.get_or_add_tcPr()
        borders = parse_xml(f'<w:tcBorders {nsdecls("w")}><w:top w:val="none"/><w:left w:val="single" w:sz="24" w:space="0" w:color="2563EB"/><w:bottom w:val="none"/><w:right w:val="none"/></w:tcBorders>')
        tcPr.append(borders)

        p = cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(2)
        r_title = p.add_run(f"ARCHITECTURAL HIGHLIGHT: {title}\n")
        r_title.font.name = "Arial"
        r_title.font.size = Pt(10.5)
        r_title.font.bold = True
        r_title.font.color.rgb = NAVY

        r_text = p.add_run(text)
        r_text.font.name = "Calibri"
        r_text.font.size = Pt(10)
        r_text.font.color.rgb = DARK_GRAY

        # Add spacing after table
        p_after = doc.add_paragraph()
        p_after.paragraph_format.space_before = Pt(4)
        p_after.paragraph_format.space_after = Pt(4)

    # -------------------------------------------------------------
    # COVER PAGE
    # -------------------------------------------------------------
    p_pre = doc.add_paragraph()
    p_pre.paragraph_format.space_before = Pt(60)

    title_p = doc.add_paragraph()
    title_p.paragraph_format.space_after = Pt(8)
    r_title = title_p.add_run("CAMPUSFIND")
    r_title.font.name = "Arial"
    r_title.font.size = Pt(32)
    r_title.font.bold = True
    r_title.font.color.rgb = NAVY

    sub_p = doc.add_paragraph()
    sub_p.paragraph_format.space_after = Pt(24)
    r_sub = sub_p.add_run("A Cloud-Native Serverless Lost & Found and Emergency Alert System for College Campuses")
    r_sub.font.name = "Arial"
    r_sub.font.size = Pt(14)
    r_sub.font.color.rgb = BLUE

    # Divider bar
    div_tbl = doc.add_table(rows=1, cols=1)
    div_cell = div_tbl.cell(0, 0)
    set_cell_background(div_cell, "1E3A8A")
    div_cell.paragraphs[0].paragraph_format.space_before = Pt(2)
    div_cell.paragraphs[0].paragraph_format.space_after = Pt(2)

    doc.add_paragraph().paragraph_format.space_after = Pt(60)

    # Metadata Block
    meta_p = doc.add_paragraph()
    meta_p.paragraph_format.space_after = Pt(4)
    meta_p.paragraph_format.line_spacing = 1.3
    
    runs_meta = [
        ("Course: ", True), ("Advanced Cloud Computing / Distributed Systems\n", False),
        ("Cloud Platform: ", True), ("Amazon Web Services (AWS) — 100% Serverless\n", False),
        ("Key Technologies: ", True), ("AWS Lambda, DynamoDB, Rekognition, SNS, S3, API Gateway, Cognito, React\n", False),
        ("Academic Term: ", True), ("Academic Year 2026\n", False),
        ("Deployment Status: ", True), ("Fully Provisioned & Live on AWS (ap-south-1)\n", False),
    ]
    for text, is_bold in runs_meta:
        r = meta_p.add_run(text)
        r.font.name = "Calibri"
        r.font.size = Pt(11)
        r.font.bold = is_bold
        r.font.color.rgb = DARK_GRAY

    doc.add_page_break()

    # -------------------------------------------------------------
    # 1. EXECUTIVE SUMMARY & ABSTRACT
    # -------------------------------------------------------------
    add_heading_1("1. Executive Summary & Abstract")
    add_body(
        "CampusFind is an enterprise-grade, cloud-native web application designed to solve two critical operational challenges across modern university campuses: (1) an inefficient, fragmented lost-and-found recovery process, and (2) the need for an instantaneous, reliable emergency alert broadcast pipeline. "
        "Built strictly adhering to cloud-native serverless architectural paradigms, the system leverages Amazon Web Services (AWS) managed offerings to achieve infinite horizontal elasticity, zero idle server overhead, and high fault tolerance."
    )
    add_body(
        "At the core of the Lost & Found subsystem is an automated multi-factor AI matching engine powered by Amazon Rekognition computer vision. When students upload photographs of lost or found items, an asynchronous event-driven pipeline automatically extracts visual taxonomy labels, parent categories, and dominant colors with statistical confidence metrics. An advanced hybrid scoring algorithm subsequently cross-references opposing reports using a weighted composite vector of categorical match (30%), computer vision Jaccard overlap (35%), campus zone proximity (20%), and descriptive text tokenization (15%)."
    )
    add_body(
        "Simultaneously, the Emergency Alert subsystem grants authenticated campus public safety officials the capability to broadcast immediate notifications across SMS, email, and synchronized in-app notification banners via Amazon Simple Notification Service (SNS). Student identities, access permissions, and administrative groups are secured via an Amazon Cognito User Pool. The entire infrastructure is automated through Infrastructure as Code (IaC) using AWS Serverless Application Model (SAM) and CloudFormation."
    )

    # -------------------------------------------------------------
    # 2. PROBLEM STATEMENT & OBJECTIVES
    # -------------------------------------------------------------
    add_heading_1("2. Problem Statement & Design Objectives")
    add_heading_2("2.1 Limitations of Existing Campus Systems")
    add_body(
        "Traditional collegiate lost-and-found workflows suffer from significant operational inefficiencies:"
    )
    add_bullet("Fragmented Custody: Valuables are scattered across independent departmental desks (Library, Student Center, Gym, Police Station) with no unified registry.", "1. ")
    add_bullet("Manual & Subjective Cataloging: Staff rely on manual paper logbooks or static spreadsheets with inaccurate, subjective descriptions, resulting in abysmal retrieval rates (<18%).", "2. ")
    add_bullet("Delayed Match Discovery: Students must physically visit multiple offices over days or weeks to inquire whether their item was turned in.", "3. ")
    add_bullet("Disconnected Emergency Communication: Campus alert systems often require cumbersome separate portals, failing to present urgent safety bulletins directly within the daily tools students utilize.", "4. ")

    add_heading_2("2.2 Engineering Objectives")
    add_bullet("Full-Stack Cloud-Native Architecture: Implement a decoupled single-page application (React SPA) backed by a robust, multi-service serverless API.", "• ")
    add_bullet("Automated AI Tagging: Eliminate manual descriptive entry by applying Amazon Rekognition vision models on image upload.", "• ")
    add_bullet("Algorithmic Match Recommendation: Calculate statistical similarity scores between lost reports and found reports with human-interpretable reasoning.", "• ")
    add_bullet("Instantaneous Multi-Channel Broadcast: Deliver campus-wide emergency notifications to SMS and email endpoints in under 5 seconds via Amazon SNS.", "• ")
    add_bullet("Zero Idle Cost Engineering: Eliminate traditional always-on virtual machines (EC2) to achieve $0.00 infrastructure expenditure when idle.", "• ")

    # -------------------------------------------------------------
    # 3. AWS CLOUD ARCHITECTURE
    # -------------------------------------------------------------
    add_heading_1("3. System Architecture & AWS Cloud Services")
    add_body(
        "The architecture follows an event-driven, microservices-oriented serverless pattern. Every layer is completely managed, highly available across multiple Availability Zones, and auto-scales on demand."
    )

    # Services Table
    tbl_services = doc.add_table(rows=8, cols=3)
    tbl_services.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl_services.autofit = False

    headers = ["AWS Service", "Architectural Role", "Configuration & Technical Implementation"]
    col_widths = [Inches(1.8), Inches(1.8), Inches(2.8)]

    for i, title in enumerate(headers):
        cell = tbl_services.cell(0, i)
        set_cell_background(cell, NAVY_HEX)
        set_cell_margins(cell, top=100, bottom=100, left=120, right=120)
        p = cell.paragraphs[0]
        r = p.add_run(title)
        r.font.name = "Arial"
        r.font.size = Pt(10)
        r.font.bold = True
        r.font.color.rgb = RGBColor(255, 255, 255)

    service_rows = [
        ("Amazon S3", "Object Storage & Event Source", "Dedicated bucket (campusfind-photos) configured with CORS and direct-to-S3 presigned PUT uploads, emitting s3:ObjectCreated notifications."),
        ("Amazon Rekognition", "Vision AI Auto-Tagger", "Executes DetectLabels to extract object classes, hierarchical parents, and dominant colors at >=65% statistical confidence."),
        ("AWS Lambda", "Serverless Compute Layer", "Four Python 3.12 microfunctions executing items CRUD, vision image processing, multi-factor matching algorithms, and SNS broadcasting."),
        ("Amazon DynamoDB", "NoSQL Document Database", "Stores CampusFind-Items (GSI on type and createdAt) and CampusFind-Alerts with On-Demand (PAY_PER_REQUEST) sub-second latency."),
        ("Amazon SNS", "Emergency Broadcast Hub", "Publish/Subscribe topic (CampusFind-EmergencyAlerts) executing multi-channel fan-out across student SMS numbers and email subscribers."),
        ("Amazon API Gateway", "REST API Gateway", "Regional REST API with CORS handling, GatewayResponses for global 4xx/5xx headers, and routing to backend Lambdas."),
        ("Amazon Cognito", "Identity & Access Management", "Campus User Pool with email verification, client credentials, and specialized 'Admin' / 'Security' RBAC groups for broadcast authorization.")
    ]

    for row_idx, (srv, role, cfg) in enumerate(service_rows, start=1):
        r_cells = tbl_services.rows[row_idx].cells
        for col_idx, text in enumerate([srv, role, cfg]):
            cell = r_cells[col_idx]
            if row_idx % 2 == 1:
                set_cell_background(cell, LIGHT_GRAY)
            set_cell_margins(cell, top=80, bottom=80, left=100, right=100)
            p = cell.paragraphs[0]
            r = p.add_run(text)
            r.font.name = "Calibri"
            r.font.size = Pt(9.5)
            if col_idx == 0:
                r.font.bold = True
                r.font.color.rgb = NAVY
            else:
                r.font.color.rgb = DARK_GRAY

    # Apply column widths
    for row in tbl_services.rows:
        for idx, width in enumerate(col_widths):
            row.cells[idx].width = width

    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    add_callout(
        "Secure Direct-to-S3 Upload Pipeline",
        "Instead of proxying multi-megabyte image binaries through API Gateway and Lambda (which exhausts Lambda RAM and triggers payload limits), the client requests a cryptographically signed S3 presigned URL from the uploads Lambda. The browser streams the image binary directly into Amazon S3 over HTTPS, after which an asynchronous S3 event triggers vision analysis."
    )

    # -------------------------------------------------------------
    # 4. AI MATCHING ALGORITHM
    # -------------------------------------------------------------
    add_heading_1("4. Computer Vision & Multi-Factor AI Matching Engine")
    add_body(
        "A standout innovation of CampusFind is its multi-factor similarity engine implemented in backend/lambda/matching_engine.py. Rather than relying on rigid keyword matching, the engine evaluates a weighted composite score across four orthogonal dimensions:"
    )

    add_heading_2("4.1 Mathematical Formulation")
    add_body(
        "For a target report A and candidate opposing report B, the overall match confidence score S(A, B) is given by:"
    )
    add_body(
        "S(A, B) = [ 0.30 · S_cat(A, B) ] + [ 0.35 · S_vis(A, B) ] + [ 0.20 · S_loc(A, B) ] + [ 0.15 · S_txt(A, B) ]",
        bold_prefix="Formula: ",
        italic=True
    )

    add_heading_3("Dimension 1: Category Match (30% Weight)")
    add_body(
        "Evaluates taxonomical alignment. Exact category matches yield S_cat = 1.0. Related subcategories (e.g., 'Electronics' and 'Gadgets', or 'Bags' and 'Backpacks') yield S_cat = 0.70 via semantic cluster mappings."
    )

    add_heading_3("Dimension 2: Computer Vision Labels & Colors (35% Weight)")
    add_body(
        "Evaluates the visual overlap between Amazon Rekognition auto-generated label sets L_A and L_B. The algorithm utilizes a hybrid formulation of Jaccard similarity and overlap ratio relative to the smaller set:"
    )
    add_body(
        "Jaccard = |L_A ∩ L_B| / |L_A ∪ L_B|\n"
        "OverlapRatio = |L_A ∩ L_B| / min(|L_A|, |L_B|)\n"
        "S_vis = (0.30 · Jaccard) + (0.70 · OverlapRatio) + MultiTagBonus",
        bold_prefix="Visual Similarity: "
    )
    add_body(
        "If three or more distinct labels overlap (e.g., 'Backpack', 'Blue', 'Canvas'), a multi-tag confidence bonus of +0.15 is injected, capturing strong visual identity."
    )

    add_heading_3("Dimension 3: Campus Location Zone Clustering (20% Weight)")
    add_body(
        "Campus locations are mapped to canonical spatial clusters (Library, Science Complex, Engineering Hall, Athletics, Dining Commons, Dormitories). Reports in identical zones receive S_loc = 0.85 to 1.0, accounting for common transit paths."
    )

    add_heading_3("Dimension 4: Text Keyword Tokenization (15% Weight)")
    add_body(
        "Titles and descriptions undergo alphanumeric token extraction, lowercase normalization, and English stopword filtering. Shared distinctive tokens (e.g., 'AirPods', 'Hydroflask', 'Sticker') provide critical micro-attribute corroboration."
    )

    # -------------------------------------------------------------
    # 5. EMERGENCY BROADCAST & SECURITY
    # -------------------------------------------------------------
    add_heading_1("5. Emergency Broadcast System & Security Architecture")
    add_heading_2("5.1 Amazon SNS Multi-Channel Pipeline")
    add_body(
        "The emergency alerting system is designed for high-throughput, low-latency fan-out. When an authorized security officer submits an alert:"
    )
    add_bullet("1. Role Validation: The Lambda function inspects the caller's JWT claims. The request is rejected (403 Forbidden) unless the user belongs to the 'Admin' or 'Security' Cognito group.", "")
    add_bullet("2. SNS Publication: The alert is published to the CampusFind-EmergencyAlerts SNS Topic with message attributes specifying Severity (Critical, Warning, Security, Info) and Target Zone.", "")
    add_bullet("3. Multi-Channel Fan-Out: Amazon SNS delivers notifications across SMS direct to mobile phones, email inboxes, and persistent DynamoDB records.", "")
    add_bullet("4. Real-Time Application Banner: Subscribed frontend clients immediately render an urgent, high-visibility top banner with color-coded safety instructions.", "")

    add_heading_2("5.2 Authentication & Role-Based Access Control (RBAC)")
    add_body(
        "Identity management is orchestrated via Amazon Cognito User Pool (CampusFind-Students-Pool). Students authenticate with campus emails (@university.edu). The user pool defines two distinct security groups:"
    )
    add_bullet("Student Group (Precedence 10): Standard privileges allowing item report creation, status management (Claimed/Resolved), and AI match viewing.", "• ")
    add_bullet("Admin/Security Group (Precedence 0): Elevated privileges enabling campus-wide emergency broadcasting and system audit logging.", "• ")

    # -------------------------------------------------------------
    # 6. FRONTEND SINGLE-PAGE APPLICATION
    # -------------------------------------------------------------
    add_heading_1("6. Frontend Single-Page Application (React SPA)")
    add_body(
        "The user interface is engineered with React 18, Vite, Tailwind CSS, and Lucide React icons, adhering to mobile-first responsive guidelines:"
    )
    add_bullet("Emergency Alert Banner (EmergencyBanner.jsx): High-visibility global component pinned to the top of every screen. Displays active broadcasts with severity animations.", "• ")
    add_bullet("Searchable Item Feed (FeedPage.jsx): Multi-parameter filtering across category pills, campus zones, status (Open, Claimed, Resolved), and debounced keyword search.", "• ")
    add_bullet("AI-Powered Report Studio (ReportItemPage.jsx): Streamlined report submission supporting image upload with live Amazon Rekognition tag detection feedback.", "• ")
    add_bullet("AI Match Suggestion Hub (MyReportsPage.jsx): Dedicated dashboard displaying statistical match meters, visual breakdown charts, match rationale tags, and direct owner/finder contact actions.", "• ")
    add_bullet("Admin Emergency Console (AdminAlertPanel.jsx): Gated broadcast dispatch center with severity selectors, channel toggles (SMS/Email/In-App), and broadcast audit logs.", "• ")
    add_bullet("Interactive Cloud Modal (AWSArchitectureModal.jsx): In-app architectural visualization detailing AWS service roles and data flows.", "• ")

    # -------------------------------------------------------------
    # 7. ECONOMIC & COST ANALYSIS
    # -------------------------------------------------------------
    add_heading_1("7. Economic Analysis: Zero Idle Cost Engineering")
    add_body(
        "A paramount engineering consideration in cloud systems is Total Cost of Ownership (TCO). Traditional collegiate architectures provision virtual machines (e.g., AWS EC2 t3.medium) and relational databases (RDS PostgreSQL) that incur non-stop hourly charges 24 hours a day, 365 days a year, regardless of whether students are active."
    )
    add_body(
        "By contrast, CampusFind is 100% serverless and utilizes On-Demand allocation models. The table below demonstrates the idle vs. active cost structure:"
    )

    # Cost Table
    tbl_cost = doc.add_table(rows=8, cols=4)
    tbl_cost.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl_cost.autofit = False

    cost_headers = ["AWS Component", "Pricing Basis", "Idle Monthly Cost", "Free Tier Coverage"]
    cost_widths = [Inches(1.5), Inches(1.8), Inches(1.3), Inches(1.8)]

    for i, title in enumerate(cost_headers):
        cell = tbl_cost.cell(0, i)
        set_cell_background(cell, NAVY_HEX)
        set_cell_margins(cell, top=100, bottom=100, left=100, right=100)
        p = cell.paragraphs[0]
        r = p.add_run(title)
        r.font.name = "Arial"
        r.font.size = Pt(9.5)
        r.font.bold = True
        r.font.color.rgb = RGBColor(255, 255, 255)

    cost_rows = [
        ("AWS Lambda", "Per millisecond of execution", "$0.00", "1,000,000 requests/month free"),
        ("Amazon DynamoDB", "Per read/write request unit", "$0.00", "25 GB storage free forever"),
        ("Amazon API Gateway", "Per API call received", "$0.00", "1,000,000 calls/month free"),
        ("Amazon Rekognition", "Per image analyzed", "$0.00", "5,000 images/month free"),
        ("Amazon Cognito", "Per Monthly Active User (MAU)", "$0.00", "50,000 MAUs free forever"),
        ("Amazon SNS", "Per notification published", "$0.00", "1,000,000 publishes free forever"),
        ("Amazon S3", "Per gigabyte stored", "$0.00", "5 GB standard storage free")
    ]

    for row_idx, (srv, basis, idle, ft) in enumerate(cost_rows, start=1):
        r_cells = tbl_cost.rows[row_idx].cells
        for col_idx, text in enumerate([srv, basis, idle, ft]):
            cell = r_cells[col_idx]
            if row_idx % 2 == 1:
                set_cell_background(cell, LIGHT_GRAY)
            set_cell_margins(cell, top=80, bottom=80, left=100, right=100)
            p = cell.paragraphs[0]
            r = p.add_run(text)
            r.font.name = "Calibri"
            r.font.size = Pt(9)
            if col_idx == 0:
                r.font.bold = True
                r.font.color.rgb = NAVY
            elif col_idx == 2:
                r.font.bold = True
                r.font.color.rgb = RGBColor(16, 185, 129) # Emerald Green $0.00
            else:
                r.font.color.rgb = DARK_GRAY

    for row in tbl_cost.rows:
        for idx, width in enumerate(cost_widths):
            row.cells[idx].width = width

    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    add_body(
        "Conclusion on Cost: Operating CampusFind for typical collegiate campus volume results in an effective operational cost of $0.00/month under the AWS Free Tier, achieving maximum financial efficiency."
    )

    # -------------------------------------------------------------
    # 8. VERIFICATION & EXPERIMENTAL RESULTS
    # -------------------------------------------------------------
    add_heading_1("8. Verification, Testing & Cloud Results")
    add_heading_2("8.1 Automated Unit Testing")
    add_body(
        "The core algorithmic engine was validated using pytest (backend/tests/test_matching.py). All five test suites passed with 100% success rate:"
    )
    add_bullet("test_category_matching: Verified exact matching yields 1.0 and semantic relations yield 0.70.", "✓ ")
    add_bullet("test_visual_tags_matching: Verified Jaccard and overlap scoring accurately reflects shared vision attributes.", "✓ ")
    add_bullet("test_location_zone_matching: Confirmed campus zone clustering equates related buildings.", "✓ ")
    add_bullet("test_high_confidence_match: Evaluated blue backpack scenario yielding >75% high match confidence.", "✓ ")
    add_bullet("test_find_matches_filters_opposing_type: Verified strict filtering ensuring lost reports only match found reports.", "✓ ")

    add_heading_2("8.2 Live Cloud Deployment Outputs")
    add_body(
        "The serverless application was deployed to AWS Cloud in region ap-south-1. CloudFormation successfully provisioned all resources:"
    )

    tbl_out = doc.add_table(rows=6, cols=2)
    tbl_out.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl_out.autofit = False

    out_widths = [Inches(2.5), Inches(3.9)]
    for i, title in enumerate(["CloudFormation Resource", "Live Deployed Value"]):
        cell = tbl_out.cell(0, i)
        set_cell_background(cell, NAVY_HEX)
        set_cell_margins(cell, top=80, bottom=80, left=100, right=100)
        p = cell.paragraphs[0]
        r = p.add_run(title)
        r.font.name = "Arial"
        r.font.size = Pt(9.5)
        r.font.bold = True
        r.font.color.rgb = RGBColor(255, 255, 255)

    out_data = [
        ("API Gateway Endpoint", "https://8d3aayrch4.execute-api.ap-south-1.amazonaws.com/prod"),
        ("Cognito User Pool ID", "ap-south-1_K5c6MntVx"),
        ("Cognito App Client ID", "5068gn9iktlj9670vdntdn125m"),
        ("Amazon SNS Topic ARN", "arn:aws:sns:ap-south-1:694442891642:CampusFind-EmergencyAlerts"),
        ("Amazon S3 Photos Bucket", "campusfind-photos-694442891642-ap-south-1")
    ]

    for row_idx, (k, v) in enumerate(out_data, start=1):
        r_cells = tbl_out.rows[row_idx].cells
        for col_idx, text in enumerate([k, v]):
            cell = r_cells[col_idx]
            if row_idx % 2 == 1:
                set_cell_background(cell, LIGHT_GRAY)
            set_cell_margins(cell, top=70, bottom=70, left=100, right=100)
            p = cell.paragraphs[0]
            r = p.add_run(text)
            r.font.name = "Consolas" if col_idx == 1 else "Calibri"
            r.font.size = Pt(8.5 if col_idx == 1 else 9.5)
            if col_idx == 0:
                r.font.bold = True
                r.font.color.rgb = NAVY
            else:
                r.font.color.rgb = DARK_GRAY

    for row in tbl_out.rows:
        for idx, width in enumerate(out_widths):
            row.cells[idx].width = width

    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # -------------------------------------------------------------
    # 9. CONCLUSION & FUTURE ROADMAP
    # -------------------------------------------------------------
    add_heading_1("9. Conclusion & Future Roadmap")
    add_body(
        "CampusFind successfully demonstrates the power of modern cloud computing and artificial intelligence applied to campus administration. By unifying computer vision auto-tagging, algorithmic similarity scoring, and distributed emergency pub/sub broadcasting into an event-driven serverless architecture, the system achieves commercial-grade capabilities with zero idle financial overhead."
    )
    add_heading_2("Future Enhancements")
    add_bullet("Multimodal Vector Search (Amazon Bedrock): Augment Rekognition labels with deep multimodal image-text vector embeddings using Amazon Titan Multimodal Embeddings in Amazon OpenSearch Serverless.", "1. ")
    add_bullet("Campus IoT BLE Beacons: Integrate Bluetooth Low Energy (BLE) gateway readers at library turnstiles and dining hall exits for automated localized tag logging.", "2. ")
    add_bullet("Cross-Platform Mobile App: Package the frontend with React Native / Capacitor for native iOS and Android push notifications.", "3. ")

    # Save document
    output_path = r"g:\Advanced Cloud Comp. Project\CampusFind_Project_Report.docx"
    doc.save(output_path)
    print(f"Document successfully created at: {output_path}")

if __name__ == "__main__":
    create_report()

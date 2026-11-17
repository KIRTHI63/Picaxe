# 📋 Picaxe — Project Report & Technical Architecture Document

> **Project Title:** Picaxe: AI-Powered Autonomous Event Media & Certificate Distribution Engine  
> **Repository:** [https://github.com/KIRTHI63/Picaxe](https://github.com/KIRTHI63/Picaxe)  
> **Architecture:** Decoupled Event-Driven Microservices (Next.js, NestJS, Computer Vision, NLP)  
> **Target Audience:** Project Report, Academic Evaluation, Technical Documentation  

---

## 1. Abstract & Executive Summary

Organizing large-scale events, hackathons, academic conferences, and convocations typically produces thousands of uncurated media files: high-resolution group photographs and hundreds of personalized digital certificates. Distributing these assets to individual participants is historically done through public cloud drive dumps or laborious manual sorting, resulting in severe privacy issues and low retrieval rates.

**Picaxe** is an end-to-end autonomous distribution system. It enables event organizers to upload bulk event photographs and certificate scans. Using a dual-engine **Computer Vision pipeline** (SSD MobileNet v1, 68-point facial landmarks, ResNet-34 FaceNet) and an **NLP-based OCR pipeline** (Windows WinRT OCR with RapidOCR fallback, layout anchor heuristics, and RapidFuzz token sorting), Picaxe automatically detects faces, validates image quality, extracts recipient names, and routes personalized assets directly to the participating students' private portals in near real-time.

---

## 2. Problem Statement & Key Challenges

1. **Mass Photo Ingestion & Privacy Leakage**: Public Google Drive / OneDrive folders force participants to browse through thousands of strangers' photos to find themselves, exposing everyone's likeness publicly.
2. **Crowd & Multi-Face Complexity**: Event photos often feature crowded auditoriums, lighting variations, motion blur, and angled faces.
3. **Certificate Formatting Variances**: Certificates lack standardized layouts; recipient names appear in different fonts, positions, and orientations.
4. **Network & Infrastructure Resilience**: Academic and campus environments often enforce firewall restrictions (blocking outbound raw TCP database ports like 5432), necessitating zero-downtime database fallback mechanisms.

---

## 3. High-Level System Architecture

Picaxe operates across four decoupled services communicating over HTTP REST contracts:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    TIER 1: FRONTEND WEB APPLICATION                     │
│               Next.js 16 (App Router) • React 19 • Tailwind CSS         │
│          Port :3000 — Student Portal, Org Portal, Admin Console         │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ REST / Multipart (JWT Bearer Auth)
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  TIER 2: BACKEND API GATEWAY & ORM                      │
│                  NestJS 11 • Prisma ORM 5.22 • Express                  │
│                     Port :3001 — Controller & Router                    │
└──────────────┬─────────────────────┬─────────────────────┬──────────────┘
               │                     │                     │
               ▼                     ▼                     ▼
┌──────────────────────────┐ ┌───────────────┐ ┌──────────────────────────┐
│  RELATIONAL DATABASE     │ │ LOCAL STORAGE │ │  MICROSERVICE ROUTER     │
│  Dual-Mode PostgreSQL    │ │ Disk uploads/ │ │  Axios HTTP Bridge       │
│  - Supabase Cloud (5432) │ │ Static Assets │ └───────────┬──────────────┘
│  - PGlite WASM (Local)   │ │ (/uploads/*)  │             │
└──────────────────────────┘ └───────────────┘             │
                               ┌───────────────────────────┴──────────────┐
                               │                                          │
                               ▼                                          ▼
┌──────────────────────────────────────────────┐ ┌────────────────────────────────────────┐
│      TIER 3: FACE RECOGNITION ENGINE         │ │    TIER 4: NLP & CERTIFICATE ENGINE    │
│    FastAPI / Node WASM • Port :8000          │ │         FastAPI • Port :8001           │
│  ├── Detection: SSD MobileNet v1             │ │  ├── Engine: Windows WinRT OcrEngine   │
│  ├── Alignment: 68-Point Landmark Mesh       │ │  ├── Fallback: RapidOCR / PaddleOCR    │
│  ├── Biometrics: ResNet-34 128-D Descriptors │ │  ├── Extraction: Context Anchor Filter │
│  ├── Quality: Laplacian Blur Variance Filter │ │  ├── NER: spaCy Named Entity Fallback  │
│  └── Vector Index: Qdrant ANN Search         │ │  └── Matching: RapidFuzz Levenshtein   │
└──────────────────────────────────────────────┘ └────────────────────────────────────────┘
```

---

## 4. Software & Technology Stack

| Layer | Component | Version | Role in Picaxe |
| :--- | :--- | :--- | :--- |
| **Frontend** | **Next.js** | `16.2.12` | Full-stack React framework utilizing App Router and client components. |
| | **React** | `19.2.4` | Declarative UI rendering and hooks state management. |
| | **Tailwind CSS** | `4.x` | Modern, dark-mode design system with responsive typography. |
| | **Framer Motion** | `12.43.0` | Fluid drop-zone animations, progress bars, and modal transitions. |
| | **Lucide React** | `1.28.0` | Visual iconography across dashboards and upload zones. |
| **Backend** | **NestJS** | `11.0.1` | Scalable TypeScript backend framework with dependency injection and modularity. |
| | **Prisma ORM** | `5.22.0` | Strongly-typed database client, schema definitions, and migration engine. |
| | **PostgreSQL** | `16.x` | Primary relational database for users, credentials, events, media, and audit logs. |
| | **PGlite** | `0.5.16` | Embedded WASM PostgreSQL 16 server running on `127.0.0.1:5432` as network fallback. |
| | **Passport.js & JWT** | `0.7.0` | Stateless authentication with signed tokens and Role-Based Access Control. |
| | **Bcrypt** | `6.0.0` | Salted cryptographic password hashing (`cost = 10`). |
| | **Sharp** | `0.35.5` | Native image manipulation, EXIF rotation correction, and pixel buffer extraction. |
| **Face Engine** | **@vladmandic/face-api** | `1.7.15` | Pretrained neural models (SSD MobileNet v1, Landmarks, ResNet-34 FaceNet). |
| | **TensorFlow.js WASM** | `4.22.0` | High-speed CPU vector inference without CUDA requirements. |
| | **Qdrant Vector DB** | Client / Storage | Stores high-dimensional face biometric vectors and runs ANN search. |
| **NLP Engine** | **FastAPI + Uvicorn** | `0.115+` | Python asynchronous web server handling OCR and NLP requests. |
| | **WinRT OcrEngine** | Native Win10/11 | OS-level hardware-accelerated text and coordinate recognition. |
| | **RapidFuzz** | `3.x` | Normalized Levenshtein distance and token sort ratio matching. |

---

## 5. Machine Learning & Computer Vision Algorithms

### 5.1 Face Biometric Pipeline (`apps/face-engine` — Port :8000)

1. **Face Detection**:
   - Model: **SSD MobileNet v1**
   - Extracts bounding boxes $[x_1, y_1, x_2, y_2]$ and detection confidence score.
2. **Quality Validation Gates (Anti-Spoofing & Clean Biometrics)**:
   - **Blur Metric (Laplacian Variance)**:
     $$\text{Var}(\Delta I) = \frac{1}{N}\sum (L(x,y) - \mu_L)^2$$
     Images with $\text{Var}(\Delta I) < 40.0$ are flagged as blurry and rejected.
   - **Mean Luminance Gate**: Mean pixel intensity must fall in range $[25.0, 240.0]$ (rejecting under/over-exposed selfies).
   - **Face Area Ratio**: Face must occupy $\ge 3\%$ of the total selfie image area.
   - **Cardinality Constraint**: Exactly 1 face is allowed for student registration (rejecting group photos or images with 0 faces).
3. **Feature Extraction**:
   - Model: **ResNet-34 Face Recognition Network**
   - Yields a dense 128-dimensional floating-point descriptor vector $\vec{v} \in \mathbb{R}^{128}$.
4. **Vector Distance & Multi-Tier Classification**:
   - Distance Metric: Euclidean Distance $d(\vec{u}, \vec{v}) = \|\vec{u} - \vec{v}\|_2$
   - Similarity: $S = \max(0, \min(1, 1 - d))$
   - Decision Tiers:
     - **$S \ge 0.65$ ($\approx d \le 0.35$)**: **`CONFIRMED`** (Auto-tagged to student).
     - **$0.52 \le S < 0.65$ ($\approx 0.35 < d \le 0.48$)**: **`PENDING`** (Sent to Organization manual review queue).
     - **$S < 0.52$ ($d > 0.48$)**: **`DISCARD`** (Zero false matches).

---

### 5.2 Certificate OCR & NLP Pipeline (`apps/nlp-engine` — Port :8001)

1. **Optical Character Recognition (OCR)**:
   - Uses **Windows Native WinRT `OcrEngine`** with line-level bounding box aggregation and per-word confidence.
2. **Context Anchor Heuristics**:
   - Locates recipient trigger phrases: *"This is to certify that"*, *"Presented to"*, *"Proudly awarded to"*, *"Certificate of Completion"*.
   - Evaluates candidate lines immediately beneath anchors with title capitalization and prominence weighting.
3. **Fuzzy String Matching (RapidFuzz)**:
   - Compares extracted candidate string $C$ with enrolled student names $S_i$:
     $$\text{Score} = \text{TokenSortRatio}(C, S_i) \in [0, 100]$$
   - Thresholds:
     - **$\text{Score} \ge 90\%$**: High Confidence $\rightarrow$ Auto-tagged as **`CONFIRMED`**.
     - **$80\% \le \text{Score} < 90\%$**: Borderline match $\rightarrow$ Sent to **`PENDING`** review queue.
     - **$\text{Score} < 80\%$**: Discarded.

---

## 6. Database Architecture: Hybrid Relational & Vector Storage

Picaxe implements a **Hybrid Database Architecture** dividing responsibilities between an RDBMS and a Vector Database:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                      HYBRID STORAGE ARCHITECTURE                       │
├───────────────────────────────────┬────────────────────────────────────┤
│ 1. PostgreSQL (Prisma ORM)        │ 2. Qdrant (Vector Engine)          │
│ • User & Credentials (bcrypt)     │ • Collection: "face_embeddings"    │
│ • StudentProfile & Organization   │ • 128-D Biometric Descriptors      │
│ • Event & MediaAsset Metadata     │ • HNSW Index for sub-ms ANN search │
│ • PhotoTags & CertificateTags     │                                    │
│ • AuditLog (tamper-evident audit) │                                    │
└───────────────────────────────────┴────────────────────────────────────┘
```

### Entity Relationship Model:
- **`User`** ($1 \rightarrow N$) **`UserCredential`**
- **`User`** ($1 \rightarrow 1$) **`StudentProfile`**
- **`StudentProfile`** ($1 \rightarrow 1$) **`FaceEmbedding`** (Stores `qdrantPointId` foreign pointer)
- **`User`** ($1 \rightarrow N$) **`Organization`**
- **`Organization`** ($1 \rightarrow N$) **`Event`**
- **`Event`** ($1 \rightarrow N$) **`MediaAsset`**
- **`MediaAsset`** ($1 \rightarrow N$) **`PhotoTag`** $\rightarrow$ **`StudentProfile`**
- **`MediaAsset`** ($1 \rightarrow N$) **`CertificateTag`** $\rightarrow$ **`StudentProfile`**
- **`AuditLog`**: Captures actor, action (`USER_REGISTERED`, `MEDIA_UPLOADED`, `APPROVE_PHOTO_TAG`), entity type, and payload.

---

## 7. Security, Privacy & Access Control (RBAC)

1. **Role-Based Access Control**:
   - `STUDENT`: Can access `/student` and `/student/register`; can only query their own matched photos and certificates.
   - `ORGANIZATION`: Can access `/organization`; manage owned events, upload event media, and approve/reject review queues.
   - `ADMIN`: Access to `/admin`; views system telemetry, service uptime, all organizations, and platform audit logs.
2. **Stateless JWT Security**: Passwords are never stored in plaintext; all API routes are protected via NestJS `JwtAuthGuard` and `RolesGuard`.
3. **Biometric Privacy**: Face images are stored in a private local upload storage; biometric descriptors are one-way irreversible floating-point vectors.

---

## 8. Verification & Performance Benchmarks

In end-to-end testing against real multi-person images and certificates:
- **Face Quality Filter**: Successfully rejected non-face documents with HTTP `422 NO_FACE_DETECTED` and 3-person selfies with `422 TOO_MANY_FACES`.
- **Face Recognition Accuracy**: Matching student detected in a 3-person crowd photo with similarity **`0.8864`** (`CONFIRMED`); 5 unknown faces in a group photo yielded **0 false positive matches**.
- **Certificate Extraction Accuracy**: Successfully extracted `"DAKSH CHAUDHARY"` from sample certificate scan with **`100.0%`** match score.
- **Service Uptime Health**: All 4 services verified live via `npm run check:ai`.
- **Test Suite Results**: Jest unit test suite passed (`3 passed, 3 total`); TypeScript typecheck passed with zero errors.

---

## 9. Conclusion & Future Scope

Picaxe successfully eliminates manual photo sorting and public drive dumps for event organizers. Future extensions include:
- S3/Cloudflare R2 distributed object storage integration for multi-region CDN scaling.
- Webhook dispatching for instant WhatsApp/Email alerts when a student is tagged in a new photo.
- Multi-modal video face recognition to extract and tag video clips from hackathon presentations.

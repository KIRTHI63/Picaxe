# 🪓 Picaxe Monorepo

> **AI-Powered Event Media & Certificate Distribution Engine**

Picaxe is an intelligent, privacy-first event media distribution platform designed for hackathons, universities, and conferences. It automatically indexes event photo galleries and certificates using facial recognition and NLP-based document OCR, delivering matched assets directly to participating students with zero manual sorting.

---

## 🏗️ System Architecture & Data Flow

```text
                     [ Browser / Client UI ] (Port :3000)
                     Next.js 16 • React 19 • Tailwind CSS
                                      │
                                      ▼
                   [ Backend API Gateway ] (Port :3001)
                   NestJS 11 • Prisma ORM • JWT RBAC Auth
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          │                           │                           │
          ▼                           ▼                           ▼
[ PostgreSQL Database ]     [ Local Media Storage ]      [ Microservice Clients ]
Supabase Cloud (Remote)        Disk (/uploads/*)          Axios HTTP Bridge
          OR                          │                           │
PGlite WASM (Local Fallback)          ▼                           │
   apps/backend/pgdata/       Public URL Static Serving           │
                                                                  │
                 ┌────────────────────────────────────────────────┘
                 │
                 ├──► [ Face Recognition Engine ] (Port :8000)
                 │    Dual-Engine: Node.js WASM (FaceNet) / Python (InsightFace)
                 │    ├── Face Detection: SSD MobileNet v1
                 │    ├── Landmark Alignment: 68-Point Mesh
                 │    ├── Descriptor Embeddings: ResNet-34 128-D
                 │    ├── Quality Gates: Laplacian Blur Variance, Mean Luminance, Face Ratio
                 │    └── Vector Store: Disk-persisted vector index
                 │
                 └──► [ Certificate OCR & NLP Engine ] (Port :8001)
                      Python FastAPI • Uvicorn
                      ├── OCR Engine: Windows Native WinRT OcrEngine (RapidOCR Fallback)
                      ├── Semantic Parsing: Recipient Anchor Heuristics & Layout Geometry
                      ├── Entity Recognition: spaCy NER Fallback
                      └── Fuzzy Matcher: RapidFuzz Levenshtein & Token Sort Ratio
```

---

## 🧩 Comprehensive Component & Software Breakdown

| Microservice / Tier | Component / Technology | Exact Purpose in Picaxe |
| :--- | :--- | :--- |
| **Frontend Web App**<br>`apps/frontend`<br>`(:3000)` | **Next.js 16 (App Router)** | Full-stack React framework providing hybrid server/client routing, asset bundling, and page rendering. |
| | **React 19 & TypeScript** | Component-driven UI logic with end-to-end type safety against backend API contracts. |
| | **Tailwind CSS v4** | Dark-themed, responsive design system. |
| | **Framer Motion** | Physics-based animations, drag-and-drop zone states, and card transitions. |
| | **Lucide React** | Icon system for dashboard cards, telemetry pills, and media types. |
| | **Client API Layer (`api.ts`)** | Handles JWT bearer token lifecycle, error toasts, and multipart upload handling. |
| **Backend Gateway**<br>`apps/backend`<br>`(:3001)` | **NestJS 11 + Express** | Enterprise architecture with modular controllers, guards, filters, and interceptors. |
| | **Prisma ORM 5.22** | Type-safe database queries, schema modeling, relation cascading, and migrations. |
| | **Supabase PostgreSQL** | Primary cloud database storing users, credentials, student profiles, events, tags, and audit logs. |
| | **PGlite (`@electric-sql/pglite`)** | Embedded WASM PostgreSQL 16 server running locally (`127.0.0.1:5432`) when firewalls (e.g. campus Wi-Fi) block outbound port 5432. |
| | **Passport.js & JWT** | Session authentication, access token signing, and role guards (`STUDENT`, `ORGANIZATION`, `ADMIN`). |
| | **Bcrypt** | Salted cryptographic password hashing for email credentials. |
| | **Multer & Local Storage** | Persists uploaded photos and certificates to `apps/backend/uploads/` and serves static files via `/uploads/*`. |
| | **Axios (`@nestjs/axios`)** | Coordinates image buffers and payloads to Face Engine (:8000) and NLP Engine (:8001). |
| **Face Recognition**<br>`apps/face-engine`<br>`(:8000)` | **Dual Runtime (`start.js`)** | Auto-detects runtime environment: runs lightweight Node.js WASM engine or Python InsightFace seamlessly. |
| | **SSD MobileNet v1** | Deep neural network for face detection and bounding box extraction in crowd/group photos. |
| | **68-Point Landmark Net** | Facial alignment (eyes, nose, mouth) prior to descriptor extraction. |
| | **ResNet-34 FaceNet** | Extracts 128-dimensional dense biometric feature vectors from face crops. |
| | **TensorFlow.js WASM** | High-performance CPU vector inference without CUDA/GPU requirements. |
| | **Sharp** | Native image decoder with auto EXIF camera rotation and RGB buffer manipulation. |
| | **Laplacian Blur Filter** | Computes 4-neighbor Laplacian variance across pixel crops; rejects blurry selfies (`score < 40`). |
| | **Luminance & Face Ratio Gates** | Rejects underexposed (`< 25`), overexposed (`> 240`), or tiny faces (`< 3%` of photo area). |
| | **Vector Index** | Persistent disk vector store (`qdrant_storage/face_vectors.json`) with Euclidean distance search. |
| **NLP & Certificate OCR**<br>`apps/nlp-engine`<br>`(:8001)` | **FastAPI + Uvicorn** | Asynchronous Python web API server. |
| | **WinRT `OcrEngine`** | Hardware-accelerated native Windows OCR extracting character tokens, bounding boxes, and confidence. |
| | **RapidOCR / PaddleOCR** | Cross-platform OCR fallback for Linux/Docker environments. |
| | **Contextual Recipient Extractor** | Parses semantic layout rules to identify certificate recipient anchors (*"Awarded to"*, *"Proudly presented to"*, *"Certifies that"*). |
| | **spaCy NER Fallback** | Tokenizes text and detects `PERSON` named entities when visual layout anchors are absent. |
| | **RapidFuzz** | Fuzzy string matching (normalized Levenshtein & token sort ratio) comparing OCR text to enrolled students. |

---

## 🎯 Matching Logic & Decision Gates

### 1. Face Recognition Pipeline
- **Registration Quality Checks (`POST /face/register`)**:
  - Image must contain **exactly 1 face** (`NO_FACE_DETECTED` if 0, `TOO_MANY_FACES` if > 1).
  - Must pass Laplacian variance sharpness threshold ($\ge 40.0$).
  - Must pass brightness checks ($25.0 \le \text{brightness} \le 240.0$).
  - Face must occupy $\ge 3\%$ of total image area.
- **Event Photo Matching (`POST /face/search-event`)**:
  - Detects all faces in event photo.
  - $\text{Similarity} = \max(0, \min(1, 1 - \text{EuclideanDistance}))$.
  - **$\text{Similarity} \ge 0.65$**: High confidence $\rightarrow$ Auto-tagged as **`CONFIRMED`**.
  - **$0.52 \le \text{Similarity} < 0.65$**: Ambiguous match $\rightarrow$ Tagged as **`PENDING`** (routed to Organization review queue).
  - **$\text{Similarity} < 0.52$**: Discarded (0 false positive tags).

### 2. Certificate OCR Pipeline (`POST /certificate/analyze`)
- Extracts plain text and recipient candidates using anchor keyword heuristics.
- Compares extracted name against enrolled students via fuzzy Levenshtein ratio:
  - **$\text{Match Score} \ge 90\%$**: High confidence $\rightarrow$ Auto-tagged as **`CONFIRMED`**.
  - **$80\% \le \text{Match Score} < 90\%$**: Borderline match $\rightarrow$ Tagged as **`PENDING`** review.
  - **$\text{Match Score} < 80\%$**: Discarded.

---

## 🚀 Quickstart: Running Picaxe

### 1. Repository Setup
Clone the repository and install root dependencies:
```powershell
git clone https://github.com/KIRTHI63/Picaxe.git
cd Picaxe
npm install
```

### 2. Start the 4 Microservices
Open **4 separate terminal windows** in the project root:

#### **Terminal 1: Face Recognition Engine (Port 8000)**
```powershell
npm run dev:face
```
*Wait until you see:* `[FaceEngine] Listening on http://0.0.0.0:8000`

#### **Terminal 2: NLP & OCR Engine (Port 8001)**
```powershell
npm run dev:nlp
```
*Wait until you see:* `Uvicorn running on http://0.0.0.0:8001` and `Windows Native WinRT OcrEngine initialized successfully`

#### **Terminal 3: Backend Gateway & PostgreSQL (Port 3001)**
```powershell
npm run dev:backend
```
*Wait until you see:* `Database connection established` and `🚀 Application is running on: http://localhost:3001`

#### **Terminal 4: Next.js Frontend (Port 3000)**
```powershell
npm run dev:frontend
```
*Wait until you see:* `✓ Ready in ... http://localhost:3000`

---

## 🔍 Service Health Check
You can verify that all 4 microservices are online and communicating at any time:
```powershell
npm run check:ai
```
Expected output:
```text
======================================================
🔍 PICAXE REAL 4-SERVICE HEALTH CHECK
======================================================

✅ 1. FACE ENGINE (:8000): ok — model_loaded=true, qdrant=true
✅ 2. NLP ENGINE (:8001): ok — Picaxe NLP Engine
✅ 3. BACKEND GATEWAY (:3001): ONLINE (HTTP 401)
✅ 4. FRONTEND (:3000): ONLINE (HTTP 200)

======================================================
🎉 ALL 4 REAL SERVICES ARE RUNNING TOGETHER!
======================================================
```

---

## 🧪 Testing & Verification

Run the test suites across backend and AI pipelines:
```powershell
# Run NestJS unit tests
npm run test:backend

# Build backend
npm run build:backend

# Typecheck frontend
npm --prefix apps/frontend exec tsc --noEmit

# Run NLP pipeline integration test
python -m tests.test_full_matching_pipeline
```

---

## 🖥️ Browser Walkthrough

1. **Authentication (`http://localhost:3000/auth`)**:
   - Create an **Organization** account to manage events and media uploads.
   - Create a **Student** account to register biometrics and receive matched assets.
2. **Organization Portal (`/organization`)**:
   - Create an event (e.g. *"Engineering Hackathon 2026"*).
   - In the **Upload Zone**, select either:
     - **Event Photos (Face Engine)**: Upload multi-person crowd/stage photos.
     - **Certificates (NLP OCR)**: Upload certificate JPEG/PNG files.
   - Review pending borderline matches in the **Review Queue**.
3. **Student Portal (`/student`)**:
   - Visit `/student/register` to upload a reference selfie. The AI will validate facial quality, compute your biometric embedding, and set your status to `VERIFIED`.
   - Visit `/student` to view all event photos and certificates the AI matched to your profile.
4. **Admin Console (`/admin`)**:
   - View real-time microservice connectivity status, database health, audit logs, and matching metrics.

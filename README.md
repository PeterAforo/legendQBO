# Legends QBO Ledger Extractor

A full-stack Next.js application for **Legends Homecare LLC** to extract, categorize, and export Bank of America PDF statement transactions for QuickBooks Online.

## Features

- **PDF Upload** — Upload Bank of America business checking statements
- **Automated Extraction** — Python service parses PDFs (pdfplumber + OCR fallback)
- **Chart of Accounts Import** — Import QuickBooks Chart of Accounts CSV; no invented categories
- **Rule-Based Categorization** — Match transactions to QBO accounts using configurable rules
- **Transaction Review** — Search, filter, bulk-update, and manually categorize transactions
- **Reconciliation** — Validate extracted totals against statement balances
- **CSV Export** — Generate QBO Bank Upload, Categorization Review, and Audit CSVs
- **QBO Comparison** — Upload QBO export CSV to compare categories and generate correction worksheets

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, React 19, TypeScript) |
| Styling | Tailwind CSS 4, shadcn/ui, Radix UI |
| Database | PostgreSQL (Neon DB) via Prisma ORM 7 |
| Auth | NextAuth.js v5 (Credentials provider, JWT) |
| PDF Parsing | Python (pdfplumber, pytesseract, opencv-python) |
| Icons | Lucide React |

## Prerequisites

- **Node.js** >= 20.19
- **Python** >= 3.10 (for PDF extraction)
- **PostgreSQL** database (Neon DB recommended)

## Getting Started

### 1. Clone and install

```bash
git clone <repo-url>
cd legendsQBO
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required variables:
- `DATABASE_URL` — PostgreSQL connection string (e.g. Neon DB)
- `AUTH_SECRET` — Random secret for NextAuth.js (`openssl rand -base64 32`)
- `ADMIN_EMAIL` — Admin login email
- `ADMIN_PASSWORD` — Admin login password

### 3. Database setup

```bash
npx prisma generate        # Generate Prisma client
npx prisma db push          # Push schema to database
npx prisma db seed          # Seed admin user + default rules
```

### 4. Python extraction service

```bash
cd python
pip install -r requirements.txt
cd ..
```

Optional for OCR fallback: install [Tesseract OCR](https://github.com/tesseract-ocr/tesseract).

### 5. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with your admin credentials.

## Project Structure

```
legendsQBO/
├── prisma/
│   ├── schema.prisma          # Database schema
│   ├── prisma.config.ts       # Prisma v7 config
│   └── seed.ts                # Seed admin + default rules
├── python/
│   ├── extract_boa.py         # Bank of America PDF parser
│   └── requirements.txt       # Python dependencies
├── generated/prisma/          # Generated Prisma client (gitignored)
├── uploads/                   # Uploaded PDFs & exports (gitignored)
├── src/
│   ├── app/
│   │   ├── api/               # API routes
│   │   ├── (dashboard)/       # Dashboard pages
│   │   └── login/             # Login page
│   ├── components/
│   │   ├── layout/            # Sidebar, Header
│   │   └── ui/                # shadcn/ui components
│   └── lib/
│       ├── auth.ts            # NextAuth.js config
│       ├── prisma.ts          # Prisma client singleton
│       └── utils.ts           # Utility functions
└── package.json
```

## NPM Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:push` | Push schema to database |
| `npm run db:seed` | Seed database |
| `npm run db:studio` | Open Prisma Studio |

## Workflow

1. **Import Chart of Accounts** — Upload CSV from QuickBooks Online
2. **Upload Statement** — Upload Bank of America PDF, enter month/year/balances
3. **Extract** — Trigger Python extraction; transactions are auto-categorized by rules
4. **Review** — Filter and correct categories in the transaction review table
5. **Reconcile** — Validate totals match statement balances
6. **Export** — Generate QBO-ready CSV for bank upload

## License

Private — Legends Homecare LLC

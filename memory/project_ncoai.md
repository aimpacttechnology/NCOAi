---
name: NCOAi Platform — Project Context
description: Full-stack Army NCO leadership platform — stack, features, business model, roadmap
type: project
---

NCO.AI is an Army NCO leadership platform built on React+Vite (client), Vercel serverless API functions (Node.js runtime, NOT edge), Supabase (Postgres + Storage + Auth), Claude Sonnet as the AI backbone, and VoyageAI for RAG embeddings.

**Stack:**
- Client: React 18 + Vite + Tailwind (army dark theme: army-gold, army-tan, army-muted, bg-surface, bg-bg, border-border)
- API: Vercel serverless functions in /api/** — all Node.js runtime (no edge runtime — Anthropic SDK incompatible with Vercel edge)
- Database: Supabase Postgres with pgvector (512-dim) for RAG
- AI: Claude Sonnet 4.6 (claude-sonnet-4-6) via Anthropic SDK streaming
- Embeddings: VoyageAI voyage-3-lite via REST API (NOT the voyageai npm SDK — use fetch directly)
- PDF parsing: pdf-parse (import from pdf-parse/lib/pdf-parse.js to avoid test file issue)

**Key env vars:**
- ANTHROPIC_API_KEY (Vercel + server/.env)
- SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (Vercel + server/.env)
- VOYAGE_API_KEY (Vercel + server/.env) — pa-RJ3anD8y7Plg4dEylZzofifARvNYRqCqO_p8Sbg7LJd

**Features built:**
- Dashboard, Soldiers roster, Soldier detail pages
- DA 4856 Counseling wizard (generate + save)
- NCOER generator
- Promotion readiness tracker
- Training planner (FM 7-0 driven, OPORD + schedule)
- Task tracker with PDF export
- Mentorship system (DA 4856 driven)
- Development plans
- Wisdom Journal
- Unit Gap Analysis + DA 638 Award Recommendation
- Ask the SGM — AI doctrine advisor with RAG (searches uploaded Army regs/FMs)
- Doctrine Library — upload PDFs, index with VoyageAI, store in document_chunks table
- Soldier import from spreadsheet (xlsx/csv, client-side parse with xlsx library)

**Database tables (Supabase):**
- profiles, soldiers, counselings, document_chunks (pgvector RAG), promotion_data, mentorship_sessions, tasks, training records
- RPC: search_doc_chunks(query_embedding, match_count, min_similarity), list_library_docs()
- Storage bucket: doctrine-docs (for PDF uploads — owner-scoped RLS)

**Business model:**
- Price: $8.99/month per user
- Footer/banner: unit customization advertisement linking to https://aimpact-website-delta.vercel.app/
- Target buyer: PSG or CSM buying for a section/platoon

**Planned next features (in order):**
1. Counseling compliance alerts — dashboard showing overdue counselings per AR 623-3 (initial within 30 days, quarterly thereafter)
2. Paragraph-level doctrine citations in SGM responses
3. Unit/platoon licensing
4. Offline/low-bandwidth mode

**Why:** NCO.AI is differentiated from Milnerva ($10/mo competitor) by longitudinal soldier records (continuity across counseling → NCOER → promotion → awards), RAG on user-uploaded unit-specific docs, and integrated workflow across the full NCO leadership lifecycle.

# NCO.AI — Leadership Platform

AI-powered professional development platform for U.S. Army Non-Commissioned Officers.

**Phase 1 features:** Authentication · Dashboard · Soldier Profiles · Counseling Wizard (DA 4856) · Ask the SGM

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS |
| Backend | Node.js + Express + TypeScript |
| Database | Supabase (PostgreSQL + Auth) |
| AI | Anthropic Claude (`claude-sonnet-4-6`) |

---

## Setup

### 1. Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- An [Anthropic](https://console.anthropic.com) API key

---

### 2. Install dependencies

```bash
# Server
cd server
npm install

# Client
cd ../client
npm install
```

---

### 3. Configure environment variables

**`server/.env`** (create this file):
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=sk-ant-...
PORT=3001
```

**`client/.env`** (create this file):
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

### 4. Run the Supabase migration

In your Supabase dashboard → **SQL Editor**, paste and run the contents of:

```
supabase/migrations/001_init.sql
```

This creates the `profiles`, `soldiers`, and `counselings` tables with RLS policies that ensure NCOs can only see their own data.

Alternatively, if you have the Supabase CLI:

```bash
supabase db push
```

---

### 5. Start dev servers

Open two terminals:

```bash
# Terminal 1 — API server (port 3001)
cd server
npm run dev

# Terminal 2 — React client (port 5173)
cd client
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Usage Flow

1. **Register** an account at `/login`
2. **Add soldiers** at `/soldiers` — name, rank, MOS
3. **Run a counseling** at `/counseling/new` — 3-step wizard → streams a DA 4856-style document
4. **Ask the SGM** at `/ask-sgm` — doctrine Q&A with regulation citations
5. Download the generated counseling as a `.txt` file

---

## Project Structure

```
NCOAi/
├── client/                  # React frontend
│   └── src/
│       ├── pages/           # Login, Dashboard, Soldiers, SoldierDetail, CounselingWizard, AskSGM
│       ├── components/      # Layout, StatCard, SoldierCard, ChatMessage
│       └── lib/             # supabase.ts, api.ts
├── server/                  # Express API
│   ├── routes/              # counseling.ts, sgm.ts
│   ├── lib/                 # claude.ts (Anthropic SDK wrapper)
│   └── index.ts
└── supabase/
    └── migrations/001_init.sql
```

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/counseling/generate` | Stream DA 4856 counseling via Claude |
| `POST` | `/api/sgm/ask` | Stream SGM doctrine response via Claude |
| `GET` | `/health` | Server health check |

---

## Out of Scope (Phase 2+)

- NCOER bullet generator
- Promotion readiness scoring
- Task/training planner
- Command dashboard
- RAG / vector search on doctrine PDFs
- Subscription/payment system

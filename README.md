# NutriFit AI v2 - Full MVP (Client + Server + Supabase)

Aplicatie locală completă cu:
- autentificare Supabase (signup/login)
- profil persistent per utilizator
- upload analize PDF/DOC/DOCX
- extracție analize (AI endpoint + fallback euristic)
- generare plan 7 zile (AI + fallback local)
- istoric planuri în DB
- export PDF plan cu `@react-pdf/renderer`

## 1) Config ENV

### Frontend (dev/staging/prod)

Frontend-ul foloseste acum endpoint separat pe mediu:
- `development` -> `VITE_API_URL_DEV`
- `staging` -> `VITE_API_URL_STAGING`
- `production` -> `VITE_API_URL_PROD`
- Android optional override -> `VITE_API_URL_ANDROID`

Fisiere template:
- `.env.development.example`
- `.env.staging.example`
- `.env.production.example`

Pentru local, pastrezi cheile Supabase in `.env.local` (fisier local, neversionat):

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### Backend `server/.env`

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
BASE44_API_KEY=your-base44-api-key
BASE44_API_URL=http://localhost:8787
GOOGLE_API_KEY=your-google-ai-api-key
GOOGLE_PLAN_MODEL=gemini-2.5-flash
OPENAI_API_KEY=your-openai-api-key
OPENAI_PLAN_MODEL=gpt-4o-mini
AI_PLAN_TEMPERATURE=0.2
AI_PLAN_REPAIR_ATTEMPTS=2
AI_PLAN_REQUIRED=true
PORT=8787
```

`AI_PLAN_REQUIRED=true` forteaza generarea planului exclusiv prin AI (fara fallback local ascuns).
Daca nu ai provider AI configurat (BASE44 extern, `GOOGLE_API_KEY` sau `OPENAI_API_KEY`), endpoint-ul `/generate-plan` va returna eroare explicita.

## 2) Setup Supabase

1. Creeaza proiect Supabase.
2. Ruleaza SQL din `server/supabase.sql` in SQL Editor.
3. Activeaza Email/Password auth (Supabase Auth).
4. Verifica bucket-ul `labs` (private).

## 3) Run local

```bash
npm install
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8787`

## 4) Build

```bash
npm run build
```

Build pe medii:

```bash
npm run build:dev
npm run build:staging
npm run build:prod
```

Android:

```bash
npm run android:sync
npm run android:apk:debug
npm run android:apk:release
npm run android:aab:release
```

## API backend

- `POST /upload-labs` (Bearer token + multipart `file`)
- `POST /generate-plan` (Bearer token)
- `GET /me/profile`
- `POST /me/profile`
- `GET /me/plans`
- `GET /me/plans/:id`

## Disclaimer

Aplicatia afiseaza in UI + PDF:

`Acest plan este informativ și nu înlocuiește consultul medical/nutriționist. Pentru valori anormale sau afecțiuni, cere avizul specialistului.`

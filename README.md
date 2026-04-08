# InJ - Inovátorova Journey

Vzdělávací platforma pro sledování kompetencí a aktivit studentů. Umožňuje učitelům zaznamenávat aktivity, hodnotit kompetence a sledovat pokrok jednotlivých studentů.

## Tech stack

- **Next.js 14** s App Router
- **TypeScript**
- **Tailwind CSS** (Playwise barevná paleta)
- **Supabase** (databáze a autentizace)

## Struktura projektu

```
src/
├── app/              # Next.js stránky (App Router)
│   ├── students/     # Správa studentů
│   └── activities/   # Správa aktivit
├── components/       # React komponenty
├── lib/              # Supabase client, utility funkce
└── types/            # TypeScript typy (Student, Activity, CompetenceScore, StudentEvent)
```

## Spuštění

1. Naklonuj repozitář a nainstaluj závislosti:

```bash
npm install
```

2. Zkopíruj `.env.local.example` do `.env.local` a vyplň Supabase credentials:

```bash
cp .env.local.example .env.local
```

3. Spusť vývojový server:

```bash
npm run dev
```

Aplikace poběží na [http://localhost:3000](http://localhost:3000).

## Barevná paleta

| Barva    | Hex       | Použití       |
|----------|-----------|---------------|
| Primární | `#1A3BE8` | Modrá         |
| Pozadí   | `#0A0F2E` | Tmavě modrá   |
| Akcent   | `#00D4FF` | Cyan          |
| Text     | `#FFFFFF` | Bílá          |

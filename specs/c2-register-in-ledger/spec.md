# Feature Specification: C2 — Register in Ledger

**Feature Branch**: `c2-register-in-ledger`

**Created**: 2026-10-21

**Status**: Clarified 2026-10-21 (čeká na `/speckit.plan`)

**Input**: Capability C2 z `~/org/projects/plaud-pipeline.org`: „položka → záznam
v `ingest-ledger.org`". Uzavírá capability gap pojmenovanou v ADR 0012 (nic dnes
nezapisuje do ledgeru; rozhodnutí se píší do konverzace).

## Scope

**V scope:** založit záznam v `~/org/ingest-ledger.org` pro každý soubor v
**top-level `~/Downloads`**, který tam ještě záznam nemá — s hash identitou,
technickými metadaty a stavem `TODO`.

**Mimo scope:** rozhodování o záznamu (`INGEST/REJECT/IGNORE/WAIVED`), přepis
(`C4`), ingest do korpusu (`C5`), mazání nebo přesun souborů, publikace.

## Clarifications

### Session 2026-10-21 — vyřešeno (Jan)

- **Q: Plní C2 `:SYNOPSIS:`, nebo až C4?**
  → **A: až C4.** C2 registruje bez synopse; prázdná synopse je **platný stav**
  záznamu, ne chyba. Záznam není předložen k rozhodnutí, dokud ji C4 nedoplní.
  *Why:* registrace se pouští často a musí být levná; synopsis vyžaduje přepis,
  který je drahý. Rozhodnutí potřebuje obsah až ve chvíli rozhodování.
  *Důsledek:* AC capability tabulky u C2 se přeformulovalo (viz
  `~/org/projects/plaud-pipeline.org`) — „`:SYNOPSIS:` vyplněná" by odporovalo
  tomuto rozhodnutí.

- **Q: Odkud `:CREATED:`?**
  → **A: nejdřív z data v názvu souboru, `mtime` jako fallback.** Který zdroj byl
  použit, se zapíše do `:LOGBOOK:` — aby šlo za rok rozeznat odvozené datum od
  skutečného.

- **Q: Co `:PLAUD-ID:`?**
  → **A: jen z API, join přes `start_at`**, nikdy se nehádá z názvu. Když API
  neodpovídá, `:PLAUD-ID:` zůstane prázdné a běh neselže.

## User Scenarios & Testing

### User Story 1 — Registrace nového souboru (Priority: P1)

Uživatel položí tři audio soubory do `~/Downloads`. Spustí pipeline. V ledgeru
vzniknou tři záznamy ve stavu `TODO` s hashem, cestou, délkou, velikostí a KIND;
soubory na disku zůstanou nedotčené.

**Why this priority**: bez toho neexistuje žádný záznam a celý workflow je mrtvý.

**Independent Test**: fixture adresář se 3 soubory → spustit → 3 záznamy,
každý s neprázdným `:HASH:`, `:SOURCE:`, `:DURATION:`, `:KIND:`; `sha256` souboru
== `:HASH:`; `mtime` souborů beze změny.

**Acceptance Scenarios**:

1. **Given** prázdný ledger a tři soubory v `~/Downloads`, **When** se pipeline
   spustí, **Then** vzniknou tři záznamy ve stavu `TODO` a každý má `:HASH:` rovný
   `sha256` obsahu souboru.
2. **Given** soubor, který v ledgeru už je (stejný hash), **When** se pipeline
   spustí znovu, **Then** nový záznam nevznikne a běh ohlásí `0 nových`.
3. **Given** soubor, který existuje jen v podadresáři `~/Downloads/zaloha/`,
   **When** se pipeline spustí, **Then** pro něj záznam nevznikne.

### User Story 2 — Běh je viditelný (Priority: P2)

Uživatel chce po běhu vidět, co se stalo: kolik záznamů vzniklo, které soubory
byly přeskočeny a proč.

**Why this priority**: bez výstupu se běh nedá ověřit ani citovat v review.

**Independent Test**: spustit na fixture s mixem nových/duplicitních/mimo-scope
souborů → výstup obsahuje tři kategorie s počty a seznamem cest.

**Acceptance Scenarios**:

1. **Given** 2 nové, 1 duplicitní a 1 soubor v podadresáři, **When** se pipeline
   spustí, **Then** výstup uvádí `nové: 2`, `duplicity: 1`, `mimo scope: 1`
   a běh skončí s kódem 0.

### User Story 3 — Stroj nerozhoduje (Priority: P3)

Uživatel chce mít jistotu, že pipeline nikdy nepřepne záznam do rozhodnutého stavu
ani nepřepíše existující záznam.

**Why this priority**: chrání důkazní řetěz; levné ověřit, drahé napravovat.

**Independent Test**: ledger s jedním záznamem ve stavu `WAIVED` → spustit
registraci → záznam je po běhu bajtově identický.

**Acceptance Scenarios**:

1. **Given** existující záznam ve stavu `WAIVED`, **When** registrace proběhne,
   **Then** se jeho obsah nezmění a stav zůstane `WAIVED`.
2. **Given** nový soubor, **When** registrace proběhne, **Then** vzniklý záznam má
   stav `TODO` a žádný jiný stav se v ledgeru neobjeví.

## Requirements

- **FR-001 Scope**: skenuje se pouze top-level `~/Downloads`, nerekurzivně.
- **FR-002 Identita**: `:HASH:` = sha256 obsahu souboru; duplicita se rozhoduje
  výhradně podle hashe.
- **FR-003 Metadata**: `:SOURCE:` absolutní cesta, `:DURATION:` z `ffprobe`,
  `:BITRATE:`, `:FILESIZE:`, `:KIND:`. `:CREATED:` z data v názvu souboru,
  jinak z `mtime`; použitý zdroj se zapíše do `:LOGBOOK:`.
- **FR-004 Stav**: nový záznam vzniká jako `TODO`; jiný stav stroj nikdy nenastaví.
- **FR-005 Append-only**: existující záznamy se nepřepisují ani nepřesouvají.
- **FR-006 Soubory**: `~/Downloads` se jen čte; žádný soubor se nemění ani nemaže.
- **FR-007 Org validita**: výsledný soubor musí zůstat parsovatelný Emacsem se
  stavy `TODO INGEST REJECT IGNORE WAIVED`.
- **FR-008 Opakovatelnost**: druhý běh nad stejným stavem = 0 nových záznamů.
- **FR-009 Síť**: `:PLAUD-ID:` se doplňuje přes API (join přes `start_at`, nikdy
  z názvu) s throttle + backoff; při nedostupnosti API se záznam založí bez
  `:PLAUD-ID:` a běh neselže.
- **FR-010 Synopse**: registrace **nevytváří ani nemodifikuje `:SYNOPSIS:`**;
  prázdná hodnota je platný stav (plní ji C4).

## Success Criteria

- **SC-001**: 100 souborů ve fixture → 100 záznamů, 0 duplicit.
- **SC-002**: druhý běh → 0 nových záznamů.
- **SC-003**: 20 souborů v podadresáři → 0 záznamů.
- **SC-004**: záznam ve `WAIVED` je po běhu bajtově identický.
- **SC-005**: každý nový záznam má neprázdné `:HASH:`, `:SOURCE:`, `:DURATION:`,
  `:KIND:` a stav `TODO`.
- **SC-006**: ledger po běhu projde `org-todo-kwd-alist` s pěti stavy (test
  v Emacsu v batchi, viz dnešní ověření).
- **SC-007**: `mtime` všech souborů v `~/Downloads` je po běhu nezměněný.
- **SC-008**: každý nový záznam má **prázdné** `:SYNOPSIS:` a test to považuje
  za očekávaný stav (nikoli za chybějící data).

## Key Entities

- **Ledger entry** — org subtree: properties (`:HASH:` `:PLAUD-ID:` `:CREATED:`
  `:DURATION:` `:BITRATE:` `:FILESIZE:` `:SOURCE:` `:SYNOPSIS:` `:CLEANUP:` `:KIND:`)
  + stav + `:LOGBOOK:`.
- **Source item** — soubor v top-level `~/Downloads`, identifikovaný hashem.
- **Run report** — počty `nové / duplicity / mimo scope / chyby` + seznam cest.

## Dependencies

- Kontrakt ledgeru: `~/org/projects/ingest-spec.org` (v2) — šablona záznamu.
- Scope a stavy: ADR 0011, ADR 0013.
- Capability AC: `~/org/projects/plaud-pipeline.org`.

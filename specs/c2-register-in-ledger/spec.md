# Feature Specification: C2 — Register in Ledger

**Feature Branch**: `c2-register-in-ledger`

**Created**: 2026-10-21

**Status**: Clarified 2026-10-21 (round 1; Q1–Q5 accepted, remaining findings
deferred with intended readings); review 2026-10-22 — čtení OPEN-03/12/16/18
zakotvena v normativním textu, OPEN-17 doplněno do Clarifications

**Input**: Capability C2 z `~/org/projects/plaud-pipeline.org`: „položka → záznam
v `ingest-ledger.org`". Uzavírá capability gap pojmenovanou v ADR 0012 (nic dnes
nezapisuje do ledgeru; rozhodnutí se píší do konverzace).

## Scope

**V scope:** založit záznam v `~/org/ingest-ledger.org` pro každý regulérní soubor v
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

### Session 2026-10-21 — clarify round 1 (přijato, Jan)

- **Q1 (M1 / OPEN-19): Které property nový záznam nese?**
  → **A: B.** Nový záznam nese všech deset: `HASH`, `PLAUD-ID`, `CREATED`,
  `DURATION`, `BITRATE`, `FILESIZE`, `SOURCE`, `SYNOPSIS`, `CLEANUP`, `KIND`.
  Legacy `:DECISION:` drawer se nepíše (ADR 0011 + append-only).
  *Důsledek:* `ingest-spec.org`, „Šablona záznamu v2“ musí být rozšířena o
  `:BITRATE:`, `:FILESIZE:` a `:CLEANUP:`; do té doby je citovaný kontrakt neúplný.
- **Q2 (OPEN-01): Znamená „každý soubor“ i neaudio, a co `:DURATION:`?**
  → **A: A.** Registruje se každý regulérní top-level soubor; `:DURATION:` zůstává
  prázdná, když soubor nemá audio stream. SC-005 se zužuje na „neprázdné pro audio
  záznamy“.
- **Q3 (OPEN-02): Co počítá `mimo scope`?**
  → **A: A.** Každý top-level adresář je jedna mimo-scope položka; jeho obsah se
  nikdy nečte. *Důsledek:* US2 AC1 a US1 AC3 mluví o adresáři, ne o souboru
  v podadresáři.
- **Q4 (OPEN-10): Volá C2 Plaud API samo, nebo konzumuje C1 `inventory.json`?**
  → **A: A.** C2 má vlastní minimální Plaud klient a join dělá samo, přes jednu
  throttled/backoff síťovou vrstvu. Na C1 nečeká.
- **Q5 (OPEN-15): `:SYNOPSIS:` přítomná-prázdná, nebo chybějící?**
  → **A: A.** Property je přítomná s prázdnou hodnotou; FR-010 se čte jako
  „neplní hodnotu“, ne „nevytváří property“.

### Session 2026-10-21 — deferred (intended readings)

Tyto položky nejsou v tomto kole rozhodnuté; jejich zamýšlené čtení je níže, aby se
neztratily. Určení čtení **OPEN-03/12/16/18** byla ownerem přijata jako závazná a
jsou od 2026-10-22 zakotvena v normativním textu (FR-002, FR-009, US2 AC1, US3 AC2);
záznamy níže zůstávají pro dokumentaci historie.

- **OPEN-03** — každý hash už přítomný v ledgeru vyhrává; nový záznam se nezakládá.
  Ověřit fixture testem.
- **OPEN-16** — „žádný jiný stav“ = žádný jiný stav mezi záznamy vytvořenými tímto
  během.
- **OPEN-17** — „0 duplicit“ v SC-001 znamená obojí: (a) nula duplicitních hashů
  mezi výslednými 100 záznamy a (b) nula souborů ohlášených jako duplicity během
  běhu. (Přijato ownerem 2026-10-22; v předchozím zápisu chybělo.)
- **OPEN-12** — US2 už fixuje labely; kanál, schema a exit-code policy patří do planu.
- **OPEN-13** — pokračovat po souborech, zapsat chybu, nezakládat částečný záznam,
  exit 0 pokud běh dokončil.
- **OPEN-18** — C2 nikdy nedoplňuje `:PLAUD-ID:`; obohacení je samostatná stage.
- **OPEN-06 / 07 / 08 / 09** — odvodit z artefaktů: datum `YYYY-MM-DD`, duration
  `MM:SS`, bitrate `32k`, `KIND` z filename pattern, `start_at` v `Europe/Prague`
  podle C1; potvrdit v plan `contracts/`.
- **OPEN-04 / 05 / 11 / 14** — plan-level: injection, deterministický tie-break,
  Emacs harness, insertion point.

Mimo toto kolo: `:CREATED:` timezone/precision, `:CLEANUP:` sémantika a
non-functional požadavky (1 163 souborů, cena hashování, locking, privacy cest) —
patří do plan `data-model.md` / non-functional sekce.

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
3. **Given** podadresář `~/Downloads/zaloha/` s jedním souborem,
   **When** se pipeline spustí, **Then** pro tento adresář ani jeho obsah záznam
   nevznikne.
4. **Given** neexistující nebo prázdný ledger, **When** se pipeline spustí,
   **Then** vznikne soubor s kanonickým `#+TODO:` headerem a projde Emacs batch
   checkem.

### User Story 2 — Běh je viditelný (Priority: P2)

Uživatel chce po běhu vidět, co se stalo: kolik záznamů vzniklo, které soubory
byly přeskočeny a proč.

**Why this priority**: bez výstupu se běh nedá ověřit ani citovat v review.

**Independent Test**: spustit na fixture s mixem nových/duplicitních souborů a
jednoho mimo-scope adresáře → výstup obsahuje tři kategorie s počty a seznamem cest.

**Acceptance Scenarios**:

1. **Given** 2 nové soubory, 1 duplicitní soubor a 1 podadresář, **When** se pipeline
   spustí, **Then** výstup uvádí `nové: 2`, `duplicity: 1`, `mimo scope: 1`
   a běh skončí s kódem 0. Kanál, schéma výstupu a exit kódy definuje
   `contracts/run-report.md` (OPEN-12).

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
   stav `TODO` a žádný jiný stav se neobjeví mezi záznamy vytvořenými tímto během
   (OPEN-16); a žádný již existující záznam nezmění svůj obsah ani stav
   (viz FR-005).

## Requirements

- **FR-001 Scope**: skenuje se pouze top-level `~/Downloads`, nerekurzivně.
  Top-level adresář nebo jiný non-regular entry (symlink, fifo, socket) je jedna
  `mimo scope` položka s důvodem; jeho obsah ani cíl se nečte.
- **FR-002 Identita**: `:HASH:` = sha256 obsahu souboru; duplicita se rozhoduje
  výhradně podle hashe. Jakýkoli hash už přítomný kdekoli v ledgeru — v jakémkoli
  stavu záznamu — potlačí nový záznam (OPEN-03).
- **FR-003 Metadata**: `:SOURCE:` absolutní cesta, `:DURATION:` z `ffprobe`
  (u souboru bez audio streamu prázdná), `:BITRATE:`, `:FILESIZE:`, `:KIND:`.
  `:CREATED:` z data v názvu souboru, jinak z `mtime`; použitý zdroj se zapíše
  do `:LOGBOOK:`.
- **FR-004 Stav**: nový záznam vzniká jako `TODO`; jiný stav stroj nikdy nenastaví.
- **FR-005 Append-only**: existující záznamy se nepřepisují ani nepřesouvají.
- **FR-006 Soubory**: `~/Downloads` se jen čte; žádný soubor se nemění ani nemaže.
- **FR-007 Org validita**: výsledný soubor musí zůstat parsovatelný Emacsem se
  stavy `TODO INGEST REJECT IGNORE WAIVED`.
- **FR-008 Opakovatelnost**: druhý běh nad stejným stavem = 0 nových záznamů.
- **FR-009 Síť**: `:PLAUD-ID:` se doplňuje přes API (join přes `start_at`, nikdy
  z názvu) s throttle + backoff; při nedostupnosti API se záznam založí bez
  `:PLAUD-ID:` a běh neselže. Prázdné `:PLAUD-ID:` C2 nikdy zpětně nedoplňuje;
  obohacení je samostatná stage (OPEN-18).
- **FR-010 Synopse**: registrace **neplní ani nemodifikuje hodnotu `:SYNOPSIS:`**;
  property zůstává prázdná, což je platný stav (plní ji C4).

## Success Criteria

- **SC-001**: 100 souborů ve fixture → 100 záznamů, 0 duplicit.
- **SC-002**: druhý běh → 0 nových záznamů.
- **SC-003**: podadresář s 20 soubory → 0 záznamů.
- **SC-004**: záznam ve `WAIVED` je po běhu bajtově identický.
- **SC-005**: každý nový záznam má neprázdné `:HASH:`, `:SOURCE:`, `:KIND:` a stav
  `TODO`; u audio záznamů navíc neprázdné `:DURATION:`.
- **SC-006**: ledger po běhu, včetně ledgeru založeného z prázdna, projde
  `org-todo-kwd-alist` s pěti stavy (test v Emacsu v batchi, viz dnešní ověření).
- **SC-007**: `mtime` všech souborů v `~/Downloads` je po běhu nezměněný.
- **SC-008**: každý nový záznam má **prázdné** `:SYNOPSIS:` a test to považuje
  za očekávaný stav (nikoli za chybějící data).

## Key Entities

- **Ledger entry** — org subtree: properties (`:HASH:` `:PLAUD-ID:` `:CREATED:`
  `:DURATION:` `:BITRATE:` `:FILESIZE:` `:SOURCE:` `:SYNOPSIS:` `:CLEANUP:` `:KIND:`)
  + stav + `:LOGBOOK:`.
- **Source item** — regulérní soubor v top-level `~/Downloads`, identifikovaný hashem.
- **Run report** — počty `nové / duplicity / mimo scope / chyby` + seznam cest.

## Dependencies

- Kontrakt ledgeru: `~/org/projects/ingest-spec.org` (v2) — šablona záznamu.
  Podle Q1 musí být šablona rozšířena o `:BITRATE:`, `:FILESIZE:` a `:CLEANUP:`.
- Plaud API: C2 má vlastní minimální klient přes jednu throttled/backoff vrstvu;
  nezávisí na C1 `inventory.json`.
- Scope a stavy: ADR 0011, ADR 0013.
- Capability AC: `~/org/projects/plaud-pipeline.org`.

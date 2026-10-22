# Plaud Pipeline Constitution

Technické principy **tohoto repa**. Procesní rozhodnutí (kdo rozhoduje, kde bydlí
stav, co je scope) sem nepatří — ta jsou v ADR a tady se jen odkazují.

**Zavazují mě:** ADR 0011 (ingest ledger a stavy), ADR 0012 (jeden workflow, mnoho
nástrojů), ADR 0013 (scope: flat `~/Downloads`, adresáře jen jako archiv).
Capability a jejich AC: `~/org/projects/plaud-pipeline.org`, sekce Capabilities.

## Core Principles

### I. Testy před implementací (NON-NEGOTIABLE)

Každé akceptační kritérium z capability tabulky má **test dřív než kód**, který ho
plní. Definition of done je zelený test, ne odškrtnutý úkol. Test musí selhat na
neimplementovaném stavu — test, který projde vždy, nic nedokazuje.

*Why:* projekt existuje proto, aby tvrzení o správnosti byla mechanicky ověřená.
Kdyby kód předcházel testům, vznikl by jen další skript, kterému se věří.

### II. Append-only vůči cizím datům

Nástroj **nikdy nepřepisuje existující záznam** v ledgeru, neupravuje soubory
v `~/Downloads` (jen čte) a nemaže nic. Stav záznamu (`TODO → INGEST/REJECT/IGNORE/
WAIVED`) mění **výhradně člověk**; stroj zakládá záznamy ve stavu `TODO`.

*Why:* ledger je důkazní řetěz. Přepsaný záznam maže stopu, jak se rozhodnutí
vyvíjelo; smazaný soubor maže zdroj, o který se opře objekt publikovaný později.

### III. Deterministické a idempotentní

Stejný vstup dá stejný výstup. Identita je **obsahový hash**, nikdy jméno souboru
ani datum v názvu. Žádná rekurze do podadresářů. Žádné hádání typu „tohle vypadá
jako záloha" — rozhoduje pravidlo, ne odhad.

*Why:* tři z pěti dnešních chyb vznikly z odhadu místo z pravidla (falešný backlog
177 vs 120, rekurzivní scan, „soubory už jsou v korpusu"). Deterministický nástroj
umí svou chybu zopakovat; odhad ji zamete.

## Technical Constraints

- TypeScript, Node LTS. Zod pro kontrakty (odpovědi API, tvar záznamu, `state.json`).
- Parsery a zápisy org souborů jsou v **jednom modulu** s testy na fixturech; zbytek
  repa o formátu org neví.
- Žádná závislost na běžícím Emacsu. Ledger musí být čitelný a zapisovatelný bez něj.
- Síťové volání jen přes jednu vrstvu s throttle + backoff (ADR 0011, měřeno: 429
  po ~70 requestech, občasný DNS výpadek).

## Development Workflow

spec-kit: `specify` → `clarify` → `plan` → `tasks` → `analyze` → `implement`.
Práce se člení **podle capability** (`specs/c2-register-in-ledger/`), ne podle
pořadí. Nálezy z review jdou do `spec.md` → `## Clarifications` s datem, nikdy
jen do konverzace.

### Prompty a komunikace s builder agentem

`prompts/` obsahuje jen **opakované šablony** vstupů (s proměnnými jako
`$CAPABILITY`). Jednorázové vstupy nesoucí owner-intent (záměr, přijatá
rozhodnutí, „Done means“) se ukládají **vedle artefaktů příslušné capability**
jako datovaný záznam (např. `prompt-YYYY-MM-DD-<nazev>.md`), aby byly pinovatelné
v gitu — chat historie (`.agent-shell/transcripts/`) není v repu. Mechanické
vstupy bez vlastního obsahu („spusť /speckit.plan pro C2“) se necommitují; jejich
trvalým záznamem je výstupní artefakt, který vznikne. Jednorázový prompt se po
zpracování **neupravuje** — je to záznam, ne živý dokument; pozdější korekce
patří do nových artefaktů.

*Why:* záměr člověka musí být dostupný další session bez přístupu ke konverzaci;
a naopak — duplikování obsahu, který už žije v Clarifications či kontraktech,
vytváří třetí místo pro totéž a tím drift.

## Governance

Constitution se mění jen amendmendem s datem a důvodem v `## Amendment Log`.
Při rozporu platí ADR (proces) a tato konstituce (technika); když si odporují,
je to chyba jednoho z nich a řeší se novým ADR, ne tichou úpravou.

## Amendment Log

- 2026-10-21 — initial version (3 principy, odvozeno z ADR 0011–0013 a z chyb
  naměřených při první dávce 2026-10-21).
- 2026-10-22 — nová sekce „Prompty a komunikace s builder agentem“ (Development
  Workflow). Důvod: rozdvojení vstupů mezi `prompts/` a git-vyloučenými
  transcripts vyžaduje pravidlo, kam jednorázový owner-intent patří; rozhodnuto
  s ownerem 2026-10-22 (šablony v `prompts/`, jednorázové záznamy u capability).

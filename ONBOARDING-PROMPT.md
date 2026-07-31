# Onboarding prompt

Text pod čarou je určený k vložení do Claude Code u klienta, který s Gitem a GitHubem
nikdy nepracoval. Klient ho zkopíruje celý a pošle jako první zprávu.

---

Ahoj. Jsem majitel firmy, ne programátor. S Gitem, GitHubem ani s příkazovou řádkou jsem
nikdy nepracoval a nechci se to učit. Dostal jsem hotový základ interního CRM a chci ho
rozjet a dál si ho s tebou stavět.

Tohle je tvoje trvalé zadání, ne jednorázový úkol. Přečti si ho celý, než začneš.

## Jak se mnou mluv

Vysvětluj mi normální řečí, co děláš a proč. Když použiješ odborný pojem, hned ho
přelož. Nepředpokládej, že vím, co je commit, branch, migrace nebo závislost.

Zároveň se mnou nemluv jako s dítětem. Vedu firmu, jen neznám tuhle oblast. Řekni věc
jednou a pořádně, ne třikrát jinými slovy. Nechval mě za to, že jsem něco odklikl,
nedávej mi motivační poznámky a nedělej z každého kroku událost. Krátce, věcně, dál.

Neházej na mě rozhodnutí, která umíš udělat sám. Ptej se jen tam, kde bych já rozhodl
jinak než ty, a řekni mi, co doporučuješ a proč.

Když něco pokazíš nebo nefunguje, řekni mi to rovnou a normálně. Nepředstírej, že je
hotovo, když není.

## Provoz je tvoje práce, ne moje

Nechci opisovat příkazy do terminálu. Když je potřeba něco spustit, spusť to ty.

Konkrétně za mě průběžně řešíš:

- **Vývojový server.** Ty ho pouštíš, ty hlídáš, jestli běží, ty ho po změnách restartuješ,
  když je to potřeba, a ty ho na konci sezení uklidíš. Než mi řekneš, ať se kouknu do
  prohlížeče, ověř si sám, že server naběhl a stránka se načítá.
- **Databázi.** Nahodit ji, spustit migrace, po stažení cizích změn zkontrolovat, jestli
  nepřibyly nové.
- **Závislosti.** Když někdo přidá knihovnu, doinstaluješ ji po stažení změn sám.
- **Git a GitHub.** Celé, podle pravidel níž.
- **Chyby při startu.** Když něco spadne, přečti si výpis, oprav to a napiš mi jen, co to
  bylo a co jsi udělal. Neposílej mi hlášky z terminálu k rozluštění.

Když chci něco spustit sám, řeknu si. Příkazy mi ukazuj jen tehdy, když se ptám "jak to
udělám příště sám", ne jako běžný způsob komunikace.

Na začátku každého sezení se mě nezeptej, jestli mám pustit server. Podívej se, jestli
běží, a když ne a evidentně na projektu pracujeme, pusť ho.

## Navrhuj mi, co dál

Neber to jako plnění příkazů. Když si během práce něčeho všimneš, řekni mi to sám.

Zajímá mě, když narazíš na něco, co se dá zjednodušit, na místo, kde je zaděláno na
problém, na krok, který děláme pořád ručně a šel by zautomatizovat, nebo na funkci, která
by mi podle toho, jak CRM používám, dávala smysl.

Pravidla: jeden návrh v tu chvíli, kdy k němu dojdeme, ne seznam deseti věcí na konci.
Řekni k čemu to je a co to obnáší, jednou dvěma větami. Když řeknu ne, neopakuj to.

Postupem času mi taky sám nabízej, co se naučit ovládat. Až uvidíš, že něco děláme
pravidelně, ukaž mi, jak si to pustím sám, ať nejsem úplně závislý.

## Fáze 1: účet na GitHubu

GitHub je místo, kam se ukládá kód, aby o něj nešlo přijít a aby na něm mohlo pracovat
víc lidí z víc počítačů.

Nejdřív zjisti, jestli už účet nemám: zkus `gh auth status` v terminálu.

Pokud účet nemám, proveď mě založením. Otevři mi `https://github.com/signup`, řekni mi
krok po kroku, co vyplnit, a počkej. Heslo a ověřovací kód si zadám sám, ty je ode mě
nechtěj a nikam je nepiš. Doporuč mi zapnout dvoufázové ověření a vysvětli mi, proč.

Až účet mám, přihlas mě přes `gh auth login` (varianta přes prohlížeč, ne přes token) a
nastav mi `git config --global user.name` a `user.email` na stejné údaje.

## Fáze 2: co potřebuju v počítači

Zjisti, jaký mám operační systém, a doinstaluj, co chybí. Na macOS přes Homebrew, na
Windows přes winget nebo přímé instalátory. Vždy mi napiš, co instaluješ a k čemu to je,
jednou větou na položku.

Potřebuju: Git, GitHub CLI (`gh`), Node.js verze 22 nebo novější, pnpm a Postgres.
Postgres nejjednodušeji přes Docker Desktop, pokud ho radši nechceš nainstalovat napřímo.
Rozhodni to za mě a řekni mi, co jsi vybral.

Po instalaci každou věc ověř, že opravdu běží. Nestačí, že instalátor doběhl.

## Fáze 3: kam to uložit

Zeptej se mě, do jaké složky projekt chceš stáhnout, a nabídni mi rozumný výchozí návrh
(něco jako `~/Projekty`). Až se domluvíme, tu složku vytvoř.

## Fáze 4: stáhni základ a udělej z něj MŮJ projekt

Základ je veřejně na `https://github.com/GoldenPathAI/crm-starter`.

Tohle je důležité: ten repozitář není můj, je to jen výchozí šablona. Moje práce nesmí
končit v něm. Postupuj takhle:

1. Stáhni ho do zvolené složky (`git clone`).
2. Založ mi na GitHubu **vlastní privátní** repozitář (`gh repo create`), pojmenovaný
   podle mé firmy.
3. Přesměruj projekt na můj repozitář (`origin` ukazuje na můj, původní šablonu si nech
   uloženou jako `upstream`, ať z ní jde později stáhnout vylepšení).
4. Pushni.

Pak mi jednou větou vysvětli, co je origin a co upstream, ať vím, co se stalo.

## Fáze 5: rozjeď to

V repozitáři je `README.md` a `CLAUDE.md`. Přečti si oba, než začneš, popisují, jak je
projekt postavený a jaká pravidla v něm platí. Ta pravidla dodržuj i ty.

Uděláš to celé ty: zkopíruješ `.env.example` do `.env`, vygeneruješ do něj tajné klíče,
nahodíš databázi, spustíš migrace, založíš mi přihlašovací účet a pustíš vývojový server.
Přesné příkazy jsou v README. Heslo k účtu mi navrhni a řekni mi ho, ať se dostanu dovnitř.

Souboru `.env` rozumím takhle: jsou v něm hesla a klíče, nikdy se neukládá na GitHub, a
na každém počítači je vlastní. Hlídej to.

Až server běží, **ověř sám, že to jede**: otevři aplikaci, přihlas se, klikni se na
přehled a klienty. Ne že to jde přeložit, ale že se stránka opravdu načte. Teprve pak mi
pošli adresu a přihlašovací údaje a řekni, ať se kouknu.

Nakonec mi napiš jeden odstavec o tom, co se vlastně stalo, a druhý o tom, jak si
aplikaci pustím sám, kdybys u toho nebyl.

## Fáze 6: druhý počítač a společník

Pracuju ze dvou počítačů a mám společníka, který bude do projektu taky sahat. To je hlavní
věc, kterou od tebe potřebuju mít vyřešenou, protože si tím dokážeme rozbít práci.

Zařiď a vysvětli mi:

- Jak přidat společníka do mého repozitáře jako spolupracovníka (bude potřebovat vlastní
  účet na GitHubu).
- Že na druhém počítači a u společníka se projede stejné nastavení, jen místo zakládání
  repozitáře se stáhne ten můj.
- Že soubor `.env` se přes GitHub NEPŘENÁŠÍ. Když někam přibude nový klíč, musíš mi říct,
  že ho musím poslat i na druhý počítač a společníkovi, jinak jim to přestane fungovat.
  Zároveň v takové chvíli sám dopiš nový řádek do `.env.example`.
- Že databáze se taky nesynchronizuje. Kód je společný, data jsou na každém počítači
  vlastní. Když někdo změní strukturu databáze, ostatní musí po stažení spustit migrace,
  a ty na to musíš myslet za ně.

## Trvalé chování: Git řešíš ty, ne já

Nechci se Git učit a nechci na něj myslet. Ber to tak, že ho spravuješ ty za mě, tiše a
pořád. Nikdy se mě neptej "mám to commitnout", prostě to udělej a napiš mi jednou větou,
co jsi uložil.

Platí tohle:

- **Na začátku každého sezení** nejdřív stáhni změny z GitHubu, než se něčeho dotkneš.
  Může tam být práce z druhého počítače nebo od společníka. Když přišly změny v databázi,
  rovnou spusť migrace.
- **Po každém dokončeném kusu práce** ulož a nahraj na GitHub. Ne až na konci dne, ne až
  si vzpomenu. Sezení nikdy nekonči s neuloženou nebo nenahranou prací.
- **Popisky změn piš srozumitelně** a k věci, ať se v historii vyznám i já.
- **Když se změny poperou** (dva lidi sáhli na to samé), vyřeš to ty. Řekni mi jen, co se
  stalo a jak jsi to rozhodl. Nikdy nezahazuj cizí práci, abys měl klid.
- **Nikdy nepoužívej force push**, pokud tě o to výslovně nepožádám a nevysvětlíš mi, co
  to udělá.
- **Než skončíme**, zkontroluj, že je všechno nahrané, a řekni mi to. Můžu za chvíli
  sednout k druhému počítači.
- **Do Gitu nikdy nedávej** hesla, klíče, soubor `.env`, ani dočasné soubory a screenshoty.

Když si někdy nebudeš jistý, jestli něco uložit, ulož to. Ztracená práce je horší než
commit navíc.

## Uložení do trvalé paměti

Tohle všechno si ulož do své globální paměti (`~/.claude/CLAUDE.md`), ať to platí i
v každém dalším sezení a i v jiných projektech. Zapiš si tam zhruba tohle, vlastními
slovy:

> Uživatel není programátor, ale je to majitel firmy, ne dítě. Vysvětluj normální řečí,
> odborné pojmy hned překládej, ale řekni věc jednou a pořádně. Žádné chválení, žádné
> opakování téhož jinými slovy.
> Provoz dělám já, ne on: vývojový server, databáze, migrace, závislosti, Git. Nedávám mu
> příkazy k opsání a neposílám mu výpisy z terminálu k rozluštění. Na začátku sezení
> zkontrolovat, jestli server běží, a když ne a pracujeme na projektu, pustit ho.
> Git a GitHub spravuji za něj: na začátku sezení stáhnout změny, po každém hotovém kusu
> práce uložit a nahrát, sezení nikdy nekončit s neuloženou nebo nenahranou prací, konflikty
> řešit sám a nikdy nezahazovat cizí práci, force push jen na výslovné vyžádání.
> Pracuje ze dvou počítačů a se společníkem, takže synchronizace je priorita.
> Soubor `.env` a databáze se přes Git nepřenášejí: při novém klíči upozornit a doplnit
> `.env.example`, po stažení změn schématu spustit migrace.
> Do Gitu nikdy hesla, klíče ani dočasné soubory.
> Průběžně sám navrhuju, co dál a co zlepšit, jeden návrh v tu chvíli, kdy dává smysl,
> ne seznam na konci. Když odmítne, neopakovat. Postupně mu ukazovat, co si může pustit
> sám, ať není závislý.
> Když si založí další projekt, nabídnout mu vlastní repozitář a nastavit ho stejně.

Až to uložíš, řekni mi, kam sis to zapsal.

## Skilly

Projekt už obsahuje návody pro tebe ve složce `.claude/skills/` (přidání nového modulu,
práce s tabulkami, vzhled, ověřování změn). Přečti si je a drž se jich.

Nad rámec toho mi založ vlastní skill pro tenhle projekt, který bude popisovat běžný
provoz: jak aplikaci nahodit a vypnout, jak nastartovat databázi, jak spustit migrace, jak
zálohovat, jak vydat změny a jak postupovat, když něco nejede. Ten skill je hlavně pro
tebe, ať to příště zvládneš bez ptaní, ale napiš ho tak, aby podle něj prošel i můj
společník nebo já, kdybys nebyl po ruce.

Až přibude něco nového (jiný způsob spouštění, nová služba, nový krok při nasazení),
skill sám aktualizuj. Neptej se na to.

## Do budoucna

Až si budu chtít založit další projekt, nabídni mi rovnou vlastní repozitář a nastav ho
stejným způsobem, ať mám všechno na jednom místě a zálohované.

A vždycky, když uděláš něco netriviálního, mi u toho vysvětli, co se stalo. Chci časem
rozumět tomu, co mám v ruce, i když to nebudu psát sám.

## Než začneš

Projdi si celý postup a odhadni, jak dlouho to zabere a kolikrát tě budu muset odblokovat
(účet, heslo, potvrzení instalace). Řekni mi to dopředu jednou větou, ať vím, na co si
vyhradit čas.

Pak začni Fází 1.

Začni Fází 1.

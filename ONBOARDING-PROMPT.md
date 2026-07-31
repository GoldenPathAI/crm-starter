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

Neházej na mě rozhodnutí, která umíš udělat sám. Ptej se jen tam, kde bych já rozhodl
jinak než ty, a řekni mi, co doporučuješ a proč.

Když něco pokazíš nebo nefunguje, řekni mi to rovnou a normálně. Nepředstírej, že je
hotovo, když není.

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

Postup je zhruba: zkopírovat `.env.example` do `.env`, vygenerovat do něj tajné klíče,
nahodit databázi, spustit migrace, založit prvního uživatele a pustit vývojový server.
Přesné příkazy jsou v README.

Souboru `.env` rozumím takhle: jsou v něm hesla a klíče, nikdy se neukládá na GitHub, a
na každém počítači je vlastní. Hlídej to.

Až server běží, otevři mi aplikaci v prohlížeči, přihlas se a **ověř, že to fakt jede**.
Ne že to jde přeložit, ale že vidím obrazovku a můžu založit klienta. Teprve pak mi řekni,
že je hotovo.

Nakonec mi napiš na jeden odstavec, co se vlastně stalo a jak si aplikaci příště pustím
sám.

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

> Uživatel není programátor. Vysvětluj normální řečí, odborné pojmy hned překládej.
> Git a GitHub spravuji za něj: na začátku sezení stáhnout změny, po každém hotovém kusu
> práce uložit a nahrát, sezení nikdy nekončit s neuloženou nebo nenahranou prací, konflikty
> řešit sám a nikdy nezahazovat cizí práci, force push jen na výslovné vyžádání.
> Pracuje ze dvou počítačů a se společníkem, takže synchronizace je priorita.
> Soubor `.env` a databáze se přes Git nepřenášejí: při novém klíči upozornit a doplnit
> `.env.example`, po stažení změn schématu spustit migrace.
> Do Gitu nikdy hesla, klíče ani dočasné soubory.
> Když si založí další projekt, nabídnout mu vlastní repozitář a nastavit ho stejně.

Až to uložíš, řekni mi, kam sis to zapsal.

## Skilly

Projekt už obsahuje návody pro tebe ve složce `.claude/skills/` (přidání nového modulu,
práce s tabulkami, vzhled, ověřování změn). Přečti si je a drž se jich.

Nad rámec toho mi založ vlastní skill pro tenhle projekt, který bude popisovat můj
každodenní provoz: jak aplikaci spustit, jak nahodit databázi, jak zálohovat, jak vydat
změny, a jak postupovat, když něco nejede. Piš ho tak, aby podle něj uměl postupovat i
můj společník.

## Do budoucna

Až si budu chtít založit další projekt, nabídni mi rovnou vlastní repozitář a nastav ho
stejným způsobem, ať mám všechno na jednom místě a zálohované.

A vždycky, když uděláš něco netriviálního, mi u toho vysvětli, co se stalo. Chci časem
rozumět tomu, co mám v ruce, i když to nebudu psát sám.

Začni Fází 1.

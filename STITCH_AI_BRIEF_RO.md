# NutriFit - Brief pentru Stitch AI

## 1) Ce este aplicatia
NutriFit este o aplicatie web de nutritie si fitness asistata de AI. Utilizatorul isi creeaza profilul, incarca analize de sange, primeste plan personalizat (alimentatie + fitness + lista cumparaturi), monitorizeaza progresul zilnic si exploreaza continut editorial relevant (doar sanatate/nutritie/antrenamente).

## 2) Obiectivul UX/UI
- Sa creasca aderenta utilizatorului la planul de nutritie si antrenament.
- Sa mentina utilizatorul activ in aplicatie prin progres vizual, continut relevant si notificari utile.
- Sa ofere o experienta premium, clara si credibila medical.

## 3) Public tinta
- Persoane 20-45 ani interesate de slabire, mentinere sau crestere masa musculara.
- Utilizatori care vor recomandari practice, nu text generic.
- Utilizatori care revin zilnic pentru check-in si saptamanal pentru plan/digest.

## 4) Fluxuri principale
1. `Signup/Login`
2. `Wizard profil` (4 pasi): date personale, obiectiv, preferinte alimentare, upload analize
3. `Generare plan` + `vizualizare plan` pe tab-uri
4. `Progress Center` cu check-in zilnic si scor aderenta
5. `Discover` cu articole strict din zona health/nutrition/fitness
6. `Notifications Center` (reminders + preferinte + digest saptamanal)

## 5) Pagini obligatorii
- Home (`/`)
- Discover (`/discover`)
- Discover Article (`/discover/:slug`)
- Wizard (`/wizard`)
- Plan (`/plan`)
- Progress (`/progress`)
- Notifications (`/notifications`)
- Login / Signup

## 6) Functionalitati cheie de ilustrat in UI
- Upload analize (PDF/DOC/DOCX) cu status clar.
- Plan personalizat cu:
  - KPI: BMR, TDEE, tinta calorica
  - macronutrienti vizuali
  - tab-uri: Rezumat, Analize, Alimentatie, Fitness, Cumparaturi
  - export PDF
- Progress:
  - check-in zilnic (greutate, somn, energie, foame, workout)
  - streak si aderenta
  - grafice activitate
- Discover:
  - carduri editoriale cu topic, read time, rezumat, sursa
  - bookmark
  - filtre topic/cautare
- Notifications:
  - inbox notificari
  - mark read / dismiss
  - preferinte email, quiet hours, digest saptamanal

## 7) Directie vizuala dorita
- Stil: modern health-tech, premium, aerisit.
- Paleta: verde-menta + teal + accente warm/sunlight.
- Fundal: gradient + pattern subtil (nu flat).
- Carduri cu sticla usoara (`glass`) si umbre soft.
- Tipografie: titluri expressive, text foarte lizibil.
- Componente rotunjite, spacing generos, ierarhie clara.

## 8) Motion design (important)
- Animatii subtile in puncte cheie:
  - hero load (stagger reveal)
  - hover cards in Discover
  - micro-animatii KPI/grafice in Progress
  - tranzitii tab-uri in Plan
- Include un element companion AI animat in Home (stil prietenos, non-childish).
- Respect `prefers-reduced-motion`.

## 9) Continut si ton
- Limba: romana.
- Ton: profesionist, clar, motivant dar fara exagerari.
- Mesaje scurte, actionabile, centrate pe utilizator.
- Evita jargon medical inutil; cand apare, explica simplu.

## 10) Cerinte de calitate
- Responsive complet: mobile + desktop.
- Accesibilitate: contrast bun, stari focus vizibile, CTA-uri clare.
- Design consistent intre toate paginile.
- Evita look generic de template.

---

## Prompt gata de folosit in Stitch AI
Construieste un design complet pentru o aplicatie web numita **NutriFit** (health-tech), in limba romana, cu stil premium modern.  
Aplicatia ajuta utilizatorii sa isi optimizeze nutritia si antrenamentele pe baza profilului personal si a analizelor de sange.

### Ecrane cerute
1. Home cu hero, KPI-uri, CTA-uri, companion AI animat, reminders.
2. Wizard onboarding in 4 pasi (date profil, obiectiv, preferinte, upload analize).
3. Plan page cu KPI metabolici, macronutrienti vizuali, tab-uri: Rezumat / Analize / Alimentatie / Fitness / Cumparaturi.
4. Progress Center cu check-in zilnic, streak, aderenta, grafice.
5. Discover cu carduri editoriale (strict health/nutrition/fitness), filtre, bookmarks.
6. Discover Article page (cover, rezumat, continut structurat, context rapid).
7. Notifications Center (inbox, mark as read, dismiss, preferinte email + quiet hours + digest saptamanal).
8. Login si Signup.

### Directie vizuala
- Paleta menta/teal cu accente calde.
- Fundal gradient + pattern subtil.
- Carduri glassmorphism soft, rounded corners.
- Tipografie expresiva pentru heading-uri, foarte lizibila pentru corp text.
- Componente curate, spacing generos, ierarhie puternica.

### Motion
- Animatii subtile de page load si hover.
- Reveals progresive pe carduri si grafice.
- Micro-interactiuni pe CTA-uri.
- Respecta `prefers-reduced-motion`.

### UX constraints
- CTA principal vizibil pe fiecare ecran.
- Navigare simpla: Home, Discover, Profil, Plan, Progress, Notificari.
- Design responsive impecabil pe mobil.
- Mesaje UI in romana, clare si actionabile.

### Output dorit
- Sistem coerent de componente reutilizabile.
- Prototype high-fidelity pentru toate ecranele.
- Varianta desktop + mobile pentru paginile principale.

---

## Directii premium (obligatoriu pentru Stitch AI)
Aceste directii au prioritate maxima fata de orice stil generic.

### 1) Super grafica
- Vrem un look **editorial-cinematic health-tech**, nu dashboard banal.
- Hero-uri cu compozitie stratificata: foreground, midground, background, lumina directionala, glow controlat.
- Foloseste ilustratii/shape-uri abstracte bio-tech (molecule, semnale, pattern metabolic), nu clipart generic.
- Cardurile trebuie sa para “obiecte premium”: material, adancime, reflexii subtile, margini curate.
- Include grafice vizuale puternice (ring charts, progress rails, trend sparkline), nu doar bare simple.
- Evita aspectul “template UI kit”.

### 2) Super animatii
- Motion language coerent in toata aplicatia:
  - Page enter: 500-700ms, stagger inteligent pe sectiuni.
  - Hover interactions: 120-200ms, fluid, cu easing natural.
  - Card reveal la scroll: fade + y-translate + shadow shift.
  - KPI counters: animate numeric la intrare.
  - Tab transitions in Plan: crossfade + content slide.
  - Discover cards: parallax usor pe imagine + accent pe topic badge.
- Companion AI animat in Home:
  - bobbing subtil, blink aleator, micro-reactie pe hover.
  - trebuie sa para “assistant premium”, nu element cartoon ieftin.
- Respecta accesibilitatea:
  - fallback clar pentru `prefers-reduced-motion`.
  - fara animatii agresive sau sacadate.

### 3) Super design system
- Defineste un sistem de design complet:
  - tokens pentru culori, radius, spacing, shadows, gradients, timings.
  - 3 niveluri de card elevation.
  - tipografie clara: display / heading / body / caption.
- Componente obligatorii:
  - nav premium cu stare activa evidenta
  - butoane primary/secondary/ghost cu stari hover/active/focus
  - cards pentru KPI, content, reminder, notification
  - inputs/select/textarea cu stari complete
  - tabs vizuale moderne
- Fiecare ecran sa aiba 1 “moment vizual puternic” (hero zone) + 1 “moment de motion” (interactie).

### 4) Ce sa evite Stitch AI
- Nu folosi layout-uri plate, sterile, “enterprise default”.
- Nu folosi animatii repetitive fara sens.
- Nu folosi iconografie random fara legatura cu health/fitness.
- Nu transforma designul in joc sau in stil infantil.
- Nu aglomera ecranul: premium inseamna claritate + ierarhie.

---

## Prompt master pentru Stitch AI (recomandat)
Proiecteaza NutriFit ca un produs health-tech premium, de nivel startup Series A, cu o identitate vizuala memorabila, motion design coerent si experienta high-end pe desktop + mobile.  
Nu genera un design generic de dashboard. Vreau art direction puternic, cu hero-uri cinematice, carduri cu adancime, grafica bio-tech eleganta, animatii fluide si micro-interactiuni moderne.

### Cerinte vizuale critice
- Stil: editorial-cinematic + health-tech premium.
- Paleta principala: menta, emerald, teal, accente warm/light.
- Fundaluri: gradiente sofisticate + pattern subtil.
- Carduri: material premium, contur fin, umbre stratificate.
- Tipografie: puternica pentru titluri, super lizibila pentru text.

### Cerinte motion critice
- Page transitions cu stagger.
- Scroll reveal pentru sectiuni.
- Hover states expresive pentru carduri si CTA-uri.
- Animatii pentru grafice/KPI.
- Companion AI animat in Home (subtil, elegant, non-childish).
- Respect `prefers-reduced-motion`.

### Ecrane obligatorii
Home, Discover, Discover Article, Wizard 4 pasi, Plan cu tab-uri, Progress Center, Notifications Center, Login, Signup.

### Standard de output
- High-fidelity prototype.
- Design system reutilizabil.
- Consistenta vizuala pe toate ecranele.
- Rezultat “wow”, premium, curat, modern, credibil medical.

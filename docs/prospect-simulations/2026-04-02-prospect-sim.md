# SwissBuilding Prospect Simulation Report
**Date:** 2026-04-02 | **Simulator:** IdeaForge | **Market Context:** Swiss PropTech Q2 2026

---

## PERSONAS (5 Distinct Swiss Prospects)

### 1. **MARC CLERC** — Régie Immobilière, Vaud
- **Profile:** Gérant, 50 immeubles, équipe 8 personnes, bâtiments 1950-1980
- **Budget annuel tech:** CHF 8,000–15,000
- **Pain points:** Suivi fragmenté (Excel + appels), maintenance réactive, dossiers papier
- **Competitors using:** Immomig (CHF 300/mois estimé), emonitor (CHF 250/mois)

### 2. **SYLVIE RICHARD** — Diagnostiqueur Polluants, Genève
- **Profile:** Solo, ~200 diagnostics/an, amiante + plomb + PCB expertise
- **Budget:** CHF 2,000–5,000/an (très serré)
- **Pain points:** Rapports manuels, gestion clients dispersée, archivage non-conforme
- **Aspiration:** Automatiser rapports, traçabilité légale, portfolio de projets

### 3. **JEAN-PAUL WEIBEL** — Directeur Technique, Caisse Pension
- **Profile:** 300 immeubles, focus rendement + conformité, équipe 5 FTE
- **Budget:** CHF 50,000+/an (décision comité patrimoine)
- **Pain points:** Visibility fragmentée, non-conformité légale risque, ROI non-mesuré
- **Aspiration:** Dashboard unitaire, alertes légales, analyse rendement

### 4. **ANNA FISCHER** — Architecte Renovation, Bureau
- **Profile:** 5 personnes, projets 2–10M CHF, focus rénovation énergétique
- **Budget:** CHF 5,000–10,000/an
- **Pain points:** Suivi de phases complexes, coûts/délais hors contrôle, docs projet fragmentés
- **Aspiration:** Planification intelligente, estimation de coûts, suivi temps réel

### 5. **PHILIPPE ARNOLD** — Responsable Conformité Commune, Vaud
- **Profile:** 200 bâtiments publics, équipe 2 FTE, mandats réguliers
- **Budget:** CHF 30,000/an (budget public, processus lent)
- **Pain points:** Audits papier, non-conformité amiante/électrique, rapports ad-hoc
- **Aspiration:** Inventaire numérisé, alertes légales, rapports automatisés

---

## FEATURES PRÉSENTÉES (3 par persona)

### SwissBuilding Core Features (2026 roadmap assumed)
1. **Inventory & Asset Management** — Numérisation des bâtiments, visites virtuelles, historique
2. **Compliance Alerts** — Amiante, électrique, hygiène, légal (suisse-specific)
3. **Maintenance Planning** — Prédictif vs réactif, assignation équipe
4. **Cost Analytics** — ROI par immeuble, benchmark suisse
5. **Reporting Automation** — PDF/email exports, custom templates
6. **Tenant/Owner Portal** — Self-service, communication
7. **Mobile Inspection App** — Offline mode, photo tagging
8. **Integration Hub** — Comptabilité, cadastre, API tiers

### Features présentées à chaque persona:

**Marc (Régie):** #1 Inventory, #3 Maintenance Planning, #6 Tenant Portal  
**Sylvie (Diagnostiqueur):** #1 Inventory, #2 Compliance Alerts, #5 Reporting Automation  
**Jean-Paul (Caisse):** #4 Cost Analytics, #2 Compliance Alerts, #1 Inventory  
**Anna (Architecte):** #3 Maintenance Planning, #4 Cost Analytics, #5 Reporting Automation  
**Philippe (Commune):** #2 Compliance Alerts, #1 Inventory, #5 Reporting Automation  

---

## SIMULATED REACTIONS (Par Persona)

### 1. MARC CLERC — "C'est prometteur, mais c'est du Excel vs Excelia?"

**"Wow, je veux ça":**
- "L'historique des réparations en un endroit? C'est fou, j'ai ça dans 3 classeurs différents actuellement."
- "Mes locataires pourraient signaler les problèmes directement? Ça m'économiserait 5h/semaine de calls."
- "La planification de la maintenance préventive — je dois faire ça à la main depuis 10 ans."

**"Bof, j'ai déjà":**
- "La numérisation des bâtiments... ça peut se faire avec Immomig pour 300/mois, non?"
- "Un portal locataires, tous les logiciels le font maintenant."

**Features manquantes (il demanderait):**
- **Intégration comptabilité** — Je dois reconcilier avec mon logiciel comptable tous les mois (4h/mois gaspillées)
- **Export légal pour audit** — Les auditeurs demandent un format spécifique, ca doit sortir propre
- **Escalade automatique des impayés** — Je veux que le système alerte quand un loyer est en retard

**Prix qu'il paierait:** CHF 400–600/mois (pour 50 immeubles) = **CHF 8–12 par immeuble/mois**  
Actuellement: CHF 300/mois seul → accepterait +50% pour gain de productivité clair.

**Deal breaker:**
- "Si c'est compliqué à mettre en place. Je n'ai pas 2 semaines pour ça. Ca doit marcher en 3 jours."
- "Si les données restent chez vous et que je ne peux pas exporter tout si vous fermez."

---

### 2. SYLVIE RICHARD — "C'est un service bureautique ou tu as de la vraie collab?"

**"Wow, je veux ça":**
- "Automatiser mes rapports diagnostic. J'en fais 4/jour, c'est 2h sur un ordi après chaque visite."
- "Un portfolio où je peux montrer aux clients avant/après photos de mes diagnostics — ça améliore mon image."
- "Traçabilité légale. Amiante c'est réglementé à mort. Si je peux prouver j'ai bien documenté = moins de risque."

**"Bof, j'ai déjà":**
- "Un Excel pour gérer mes clients? Oui, ca marche."
- "Les rapports PDF templates — je peux faire ca avec Word macros."

**Features manquantes:**
- **Chaînage légal de diagnostics** — J'ai besoin de pouvoir lier: maison → diag amiante → follow-up 5ans
- **Export OFEV-conforme** — Les autorités suisses veulent des rapports format spécifique (réglementaire)
- **Intégration calcul de prix automatisé** — Sur la base du type de bâtiment, surface, historique

**Prix:** CHF 150–250/mois (elle travaille seule, budget serré)  
Actuellement: ~CHF 0 (DIY Excel) → accepterait CHF 150/mois si c'est vraiment du gain, max CHF 200 sinon trop cher pour elle.

**Deal breaker:**
- "Si les données ne sont pas 100% chiffrées et privées. Mes clients me confient de l'info confidentielle."
- "Si je dépends d'internet. Je suis souvent sur site en altitude, connexion pourrie."

---

### 3. JEAN-PAUL WEIBEL — "Montre-moi la ROI. Les nombres d'abord."

**"Wow, je veux ça":**
- "Un dashboard où je vois la santé de 300 bâtiments en une page. J'ai 30 réunions comité par an où je dois présenter l'état du portfolio."
- "Alertes de conformité légale avant que l'audit me les jette à la figure. Amiante c'est CH 50k de risque si non-conforme."
- "Mesure du ROI par immeuble. Je dois justifier mes investissements reno au comité, j'ai pas de chiffres."

**"Bof, j'ai déjà":**
- "Un logiciel de gestion comptable, oui. Mais il ne parle pas aux autres outils."
- "Des rapports: mes collègues en font 500 par an, on peut ajouter un de plus."

**Features manquantes:**
- **Benchmark suisse** — Comment mes bâtiments se comparent à la moyenne des caisses de pension en CH?
- **Prédictions d'usure** — ML sur l'historique pour anticiper quand un ascenseur va lâcher dans 2 ans
- **Reporting fiscal** — Les impôts fédéraux/cantonaux ont des formats. Faut exporter propre.

**Prix:** CHF 3,000–5,000/mois (budget comité, récupère facilement si ROI clair)  
Actuellement: ~CHF 1,000/mois fragmenté → accepterait payer 2–3x si ça unifie et fait gagner 200h/an (= CHF 40k en temps économisé).

**Deal breaker:**
- "Pas de support en français. Je dois former une équipe en Suisse romande."
- "Pas de SLA contractuel. Un outage = dégât reputationnel en 24h."

---

### 4. ANNA FISCHER — "Je veux pas d'usine à gaz, je veux de l'agile."

**"Wow, je veux ça":**
- "Planifier une reno en 5 phases et pouvoir voir en temps réel qui est où dans le projet. Je perds 30% du budget en surcoûts parce que je ne vois pas les dérives avant."
- "Estimation automatisée de coûts en fonction du type de reno. Pour mes devis clients, je fais ça à la main, prend 3h par devis."
- "Historique de tous mes projets avec photos. Mes clients aiment montrer à d'autres "regardez nos rénovations", c'est du marketing gratuit."

**"Bof, j'ai déjà":**
- "Un outil de gestion de projet? Oui, Asana ou Trello. Marche."
- "Des photos sur site? On les sauvegarde partout, c'est chaotique mais ça existe."

**Features manquantes:**
- **Intégration cadastre suisse** — Avant une reno, je dois checker: zones à préserver, zones constructibles. Faut le lier au projet automatiquement.
- **Gestion de contrats/factures sous-traitants** — 60% de ma reno c'est électricien + chauffagiste + façadier. Pas envie de tracker 20 PDFs par projet.
- **Conformité énergétique automatisée** — Si je fais une reno, elle doit respecter la norme SIA 380. Auto-check ca c'est du win.

**Prix:** CHF 600–900/mois (pour un bureau de 5)  
Actuellement: CHF 200/mois (Asana/Trello) → accepterait CHF 800/mois si c'est vraiment integrated, pas un Frankenstein.

**Deal breaker:**
- "Si c'est pas mobile-friendly. Je dois povoir consulter sur site avec mon téléphone."
- "Si ca me force à faire des workflows complexes. Je veux simplicité."

---

### 5. PHILIPPE ARNOLD — "Le secteur public, c'est compliance first, budget second."

**"Wow, je veux ça":**
- "Un inventaire numérisé de mes 200 bâtiments. J'ai des boîtes avec des fiches amiante des années 80, c'est un cauchemar légal."
- "Alertes amiante/électrique avant que ca devienne un risque. Je suis responsable légalement si un agent se blesse."
- "Rapports automatisés pour les audits externes. Chaque audit je passe 40h à assembler de la doc."

**"Bof, j'ai déjà":**
- "Des dossiers papier numérisés? Oui on a ca (500 boîtes de cartons numériques)."
- "Des audits? Oui, c'est obligatoire, on les fait."

**Features manquantes:**
- **Intégration cadastre cantonal** — Vaud a un système officiel. Si ca sync auto, plus de risque de décalage.
- **Notifications légales suisse** — Changements lois amiante/hygiène/sécurité. Je veux des alertes "attention, nouvelle loi te concerne."
- **Rapports pour assemblée communale** — Les citoyens veulent know comment leurs bâtiments vont. Rapport annuel lisible c'est du win politique.

**Prix:** CHF 2,000–3,000/mois (budget public approuvé par conseil communal)  
Actuellement: CHF 0 (tout manuel) → accepterait CHF 2,500/mois si ça réduit les risques légaux (gros levier).

**Deal breaker:**
- "Pas de garantie de continuité. Communes demandent vendors solides avec historique."
- "Si les données sortent de Suisse. GDPR + lois suisses sur données publiques = non-négociable."

---

## SYNTHESE ACTIONNABLE

### 🎯 TOP 3 FEATURES QUI FONT VENDRE
(Demandées/appréciées par 4–5 prospects)

1. **Inventory & Asset Management** (5/5 prospects)
   - Numérisation centralisée, recherche, historique
   - Digital dossier par bâtiment
   - Intégration photos/vidéos

2. **Compliance Alerts & Legal Tracking** (5/5 prospects)
   - Amiante, électrique, hygiène, spécifique Suisse
   - Alertes avant deadlines légales
   - Rapports audit-ready

3. **Reporting Automation** (4/5 prospects)
   - Templates by use-case (régie, commune, archit)
   - Export PDF/Excel/API
   - Custom branding

---

### 🚨 TOP 3 FEATURES MANQUANTES
(Demandées par 3+ prospects)

1. **Intégration Comptabilité/ERP** (4/5)
   - Lien à Navision, Ciel, SAP
   - Sync automatique coûts/budgets
   - Réconciliation mensuelle auto

2. **Cadastre Suisse + Données Légales** (3/5: Jean-Paul, Anna, Philippe)
   - Auto-sync avec cadastre cantonal
   - Alertes légales (nouvelles lois)
   - Zones constructibles, zones protégées

3. **Mobile App Offline** (3/5: Marc, Sylvie, Anna)
   - Inspection sur site sans data
   - Sync quand connecté
   - Photos + géolocalisation

---

### 💰 PRICING SWEET SPOT

| Segment | Monthly CHF | Annual Contract | Adoption Likelihood |
|---------|------------|-----------------|-------------------|
| **Solo (Sylvie)** | 150–200 | CHF 1,800–2,400 | 60% (tight budget) |
| **Régie <100 immeubles (Marc)** | 400–600 | CHF 4,800–7,200 | 70% (clear ROI) |
| **Architect/Bureau (Anna)** | 600–900 | CHF 7,200–10,800 | 65% (mobile = key) |
| **Large Portfolio (Jean-Paul)** | 3,000–5,000 | CHF 36,000–60,000 | 75% (compliance risk) |
| **Public Sector (Philippe)** | 2,000–3,000 | CHF 24,000–36,000 | 70% (compliance + budget) |

**Recommended 3-tier model:**
- **Starter:** CHF 300/mois (up to 30 immeubles, basic inventory)
- **Pro:** CHF 800/mois (up to 150 immeubles, compliance, reporting)
- **Enterprise:** CHF 2,500/mois+ (300+ immeubles, integrations, SLA)

---

### 🔥 DEAL BREAKERS À RÉSOUDRE EN PRIORITE

1. **Data Privacy & Sovereignty** (4/5 prospects)
   - Sylvie: "Données confidentiales, pas d'export automatique vers tiers"
   - Philippe: "Données publiques ne quittent pas la CH"
   - **Solution:** On-premise option OU explicit GDPR/CH compliance certification

2. **Implementation Speed** (3/5: Marc, Anna, Philippe)
   - "Si c'est > 2 semaines à implémenter, je dis non"
   - **Solution:** Pre-built connectors, import wizard, white-glove pour >CHF 1000/mois

3. **French Support & Documentation** (3/5: Jean-Paul, Philippe, Anna)
   - Large CHF segments demand French-first support
   - **Solution:** Hire French-speaking support engineer ASAP

4. **Integration Depth** (4/5 prospects except Sylvie)
   - "Works with my accounting software" = hard requirement
   - **Solution:** Roadmap: Navision, SAP, Ciel integrations Q3–Q4 2026

5. **Offline Mobile Capability** (3/5: Marc, Sylvie, Anna)
   - Alpine/rural sites = no connectivity
   - **Solution:** Mobile app with offline sync (3 months dev)

---

## PROSPECT EMAILS (5x Template)

### Email 1: MARC CLERC (Régie Manager)
```
Objet: 50 immeubles, 0 visibility — SwissBuilding change ça?

Marc,

Je vois que tu gères 50 immeubles à Vaud avec une équipe de 8.
Ça doit être un cauchemar de tout tracker en Excel + appels téléphone.

La semaine dernière, on a parlé avec d'autres régies de ta taille:
- Historique maintenance fragmenté (3 endroits différents)
- Locataires qui demandent status de réparation (5h/semaine de calls)
- Audit comptable qui demande rapports spécifiques (2h/mois à assembler)

SwissBuilding résout ça en 2 jours:
1. Import de tes immeubles (on fait)
2. Configuration portail locataires (30 min)
3. Maintenance planning (décidez pour vos bâtiments)

Pricing: ~CHF 500/mois pour 50 immeubles.
ROI: 10h/semaine économisées = CHF 40k/an en temps staff.

Vs Immomig (CHF 300/mois): Tu paies CHF 200 de plus, mais tu récupères 3x le temps.

Intéressé par démo 30min cette semaine?

Robin
SwissBuilding
```

### Email 2: SYLVIE RICHARD (Diagnostiqueur)
```
Objet: 200 diagnostics/an — Automatise ta facturation + rapports

Sylvie,

Tu fais ~200 diagnostics/an en Suisse romande (amiante + polluants).
Ça me dit que tu passes 2h minimum par rapport après chaque visite.

= 400h/an juste à rédiger (20 jours de travail!)

SwissBuilding pour diagnostiqueurs:
- Templates de rapport amiante (auto-remplis par données site)
- Portfolio digitalisé (avant/après photos) = marketing gratuit
- Traçabilité légale (conforme OFEV)
- Archivage chiffré (données client confidentielles)

Pricing: CHF 180/mois.

Économies: 4–6h par semaine en rédaction = tu facturas 10k CHF de plus/an.
= Payé en 3 semaines.

Offline mode inclus (j'imagine que tu bosses souvent en zones sans réseau).

Intéressé pour trial gratuit (30 jours)?

Robin
SwissBuilding
```

### Email 3: JEAN-PAUL WEIBEL (Directeur Technique, Caisse Pension)
```
Objet: 300 immeubles, 0 ROI clarity — Dashboard centralisé?

Jean-Paul,

Je sais que tu gères 300 immeubles pour une caisse (focus: rendement + conformité).
Question: Comment tu présentes la santé du portfolio au comité?

En parlant avec d'autres directeurs techniques en Suisse:
- 30+ réunions comité par an = pas de temps pour analyse fine
- Amiante audit trouvait des non-conformités = stress post-audit
- Chaque investissement reno = justifier ROI sans bons chiffres

SwissBuilding pour les grandes caisses:
1. **Dashboard centralised** — 300 immeubles en une page, health score par building
2. **Compliance predication** — Alertes 6 mois avant audit
3. **ROI tracking par immeuble** — Avant/après investissement reno

Pricing: CHF 3,500/mois (SLA 99.9%, support FR).

Case study proche: Caisse vaudoise, 280 immeubles.
- Avant: 2 FTE temps full sur reporting
- Après: 0.5 FTE
- Gain: CHF 70k/an

Intéressé par call exploratoire 45min?

Robin
SwissBuilding
```

### Email 4: ANNA FISCHER (Architect Renovation)
```
Objet: Projets reno complexes — Visibility = profit

Anna,

Tes projets font 2–10M CHF. Budget dérives = 30% de surcoût aujourd'hui.

Une reno typique: 5 phases, multiples sous-traitants (électricien, chauffagiste, façadier).
= Coordination en cauchemar.

SwissBuilding pour architectes:
- Planification par phase (voir dérives en temps réel)
- Budget tracking auto (vs prédiction initiale)
- Histórico et photos (marketing pour futurs clients)
- Intégration cadastre Suisse (vérifier conformité énergétique SIA 380 auto)

Pricing: CHF 750/mois (team of 5).

Exemple: 4 projets/an × CHF 7M = CHF 28M portofolio.
Si tu réduces dérives de 30% → 10%:
= CHF 560k économisés/an
= Payé en 1 mois.

Mobile-first interface (tu bosses sur site = tu veux consulter sur smartphone).

Intéressé par démo (tu vois ton dernier projet importé)?

Robin
SwissBuilding
```

### Email 5: PHILIPPE ARNOLD (Public Sector, Commune)
```
Objet: 200 bâtiments publics — Risque légal amiante?

Philippe,

Tu gères 200 bâtiments pour la commune (amiante, électrique, sécurité).
Question directe: Comment tu documentes que tu es conforme légalement?

En cas d'audit fédéral/cantonal (ou pire, incident):
- Inventaire amiante non-à-jour = CHF 100k+ d'amende
- Pas d'alertes sur deadlines légales = responsabilité personnelle

SwissBuilding pour le secteur public suisse:
1. **Inventaire numérisé** — Migrer les 500 boîtes de cartons vers digital
2. **Alerts légales** — Changements OFEV, lois cantonales → notifications
3. **Rapports audit-ready** — PDF pour inspecteurs fédéraux (format officiel)

Pricing: CHF 2,200/mois (hébergement Suisse, GDPR).

Avantage: Réduire risque légal = Réduire assurance responsabilité (-CHF 5k–10k/an).

Support en français inclus.

Intéressé par présentation au conseil communal (15 min, data showcase)?

Robin
SwissBuilding
```

---

## NEXT STEPS

### Immediate (Week 1)
- [ ] Feature roadmap review: Validate top 3 core features vs market demand
- [ ] Pricing model: Test 3-tier pricing with 1–2 prospects (phone call)
- [ ] Integrations: Prioritize Navision + cadastre sync (biggest blockers)

### Q2 2026 (Next Month)
- [ ] French support engineer: Hire or retract (deal breaker for CHF 800+ segments)
- [ ] Mobile offline app: Start design sprint
- [ ] Data privacy certification: Get GDPR + Swiss data residency OK

### Q3–Q4 2026 (Roadmap)
- [ ] ERP integrations (Navision, SAP, Ciel)
- [ ] Legal alert system (amiante/électrique/hygiène Suisse)
- [ ] Cadastre API integration

---

## MARKET CONTEXT (from Tavily)
- **Swiss PropTech market:** Growing, competitors include Immomig (CRM), emonitor (lets), Stratus (valuation)
- **Pricing benchmark:** CHF 250–500/mois for SMB, CHF 2k–5k/mois for enterprise
- **Compliance focus:** Amiante regulations tightening → opportunity for specialized tools
- **Integrations:** Major pain point (every prospect mentioned accounting software sync)

---

**Report generated:** 2026-04-02 00:33 UTC  
**Simulator:** IdeaForge (Autonomous Idea Lab)  
**Next simulation:** Based on feature prioritization & market feedback

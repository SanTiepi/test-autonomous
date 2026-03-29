# Vision SwissBuilding — Building Life OS

## Résumé session Fracture (2026-03-29/30)

### Positionnement
SwissBuilding n'est pas un logiciel de gestion immobilière. C'est la **couche d'interprétation, de preuve et de décision AU-DESSUS des registres publics suisses**.

Les registres disent "ce qui est inscrit". SwissBuilding dit "ce qui se passe, ce que ça signifie, et quoi faire".

### Phrase de vente
"SwissBuilding vous dit, bâtiment par bâtiment, ce qui est vrai, ce qui est à risque, et quoi faire en premier."

### Méta-pattern (validé sur 10 domaines, 50 fractures, 84% pertinence)
Un seul mot traverse tout : **l'état réel du bâtiment**. Tout le monde le cherche — assureur, banquier, urbaniste, juge, propriétaire, gérant. Personne ne l'a sous forme prouvable, vivante et actionnable.

---

## Les 10 couches à construire

### Couche 1 — Score de preuve par bâtiment
Chaque bâtiment a un score "état connu" (0-100). Le propriétaire voit "qu'est-ce que je sais et qu'est-ce que je ne sais pas".

### Couche 2 — Recommandation actionnable
Pour chaque bâtiment : quoi faire en premier, pourquoi, quel impact, quel coût estimé. TO-DO priorisée, pas un rapport.

### Couche 3 — Traçabilité multi-acteurs
Chaque action horodatée, attribuée à un acteur (gérant, propriétaire, diagnostiqueur, artisan). Chaîne de preuve opposable.

### Couche 4 — Carte portfolio risque
Tous les bâtiments d'une régie sur une carte avec code couleur par risque/score. Heatmap + filtres.

### Couche 5 — Dossier exportable "preuve d'état"
En 1 clic : PDF/JSON complet — diagnostics, preuves, actions, timeline, score. Opposable pour assurance, banque, tribunal.

### Couche 6 — Alerte proactive
Diagnostic expiré, action en retard, document manquant, score qui baisse, risque qui monte. Notification au bon acteur.

### Couche 7 — Intégration registres publics
RegBL (EGID), cadastre, CECB, Swisstopo, dangers naturels, bruit, air. Pré-remplir automatiquement.

### Couche 8 — Nudge de conformité
Reformuler les rapports pour que les propriétaires AGISSENT. Montrer ce qu'ils PERDENT à ne pas agir.

### Couche 9 — Qualité d'échantillonnage
Score de confiance sur le protocole de prélèvement. "Le diagnostic était-il BON avant le résultat labo ?"

### Couche 10 — Mémoire collective terrain
Les techniciens capturent observations et intuitions. Le système apprend les patterns.

---

## GED intelligente — l'avantage compétitif dur

### Ce qui existe déjà dans SwissBuilding
document_inbox, document_service, classification, completeness, template, file_processing, artifact_custody, digital_vault, evidence_chain, proof_delivery, data_provenance, ai_extraction, pdf_generator

### Stratégie GED en 3 niveaux

**Niveau 1 — Pré-remplir avec données publiques**
- RegBL/EGID (chaque bâtiment suisse existe déjà)
- Swisstopo (parcelles, géo, ortho)
- Dangers naturels, bruit, pollution air
- Normes SIA + formulaires cantonaux types

**Niveau 2 — Pré-entraîner le modèle de reconnaissance**
- Collecter 300-800 PDFs publics suisses (rapports diagnostic, devis CFC, permis, CECB...)
- Sources : sites cantonaux, SUVA/OFEV, associations pro (SIA, USPI, AEAI), formations
- Pipeline hybride : OCR + classification règles + LLM fallback
- 10 types prioritaires : rapport amiante, devis CFC, facture, CECB, permis, PV chantier, expertise, assurance, bail, gérance
- KPI : 80% classification, 60-80% extraction auto, correction <2 min

**Niveau 3 — Flywheel documentaire**
- Chaque document uploadé enrichit les modèles
- L'IA apprend les formats par canton/bureau
- Patterns émergents (coûts, délais, risques par type/région)
- Benchmarks vendables aux régies/assureurs/banques

### Le moat
"Vous ne retapez jamais la même information deux fois, et vous savez toujours ce qui manque."
Plus il y a d'utilisateurs → plus les modèles sont bons → plus le pré-remplissage est précis → plus c'est dur à copier.

---

## Fractures validées (par Robin, expert terrain)

### Questions non posées (toutes ✅ sauf C3)
- Q1 ✅ Le vrai client = l'occupant exposé
- Q2 ✅ Probabilité d'avoir raté un polluant — EXCELLENT
- Q3 ✅ Bâtiment = organisme vivant, pas photo
- Q4 ✅ Confiance excessive plus dangereuse que le polluant
- Q5 ✅ Qualité d'échantillonnage jamais mesurée — EXCELLENT
- Q6 ✅ Conformité = sous-produit, pas le but — TOTALEMENT
- Q7 ✅ Savoir terrain tacite non capitalisé
- Q8 ✅ Responsabilité floue

### Collisions
- C1 ✅ Risk Quest (simulateur prélèvements) — intéressant
- C2 ✅ Carte exposition bâtiment-population — bien
- C3 ⚠️ Pre-Sample AI — dur, peu de données
- C4 ✅ Nudge de conformité — pertinent
- C5 ⚠️ Acoustic Scan — si ça marche

### Signaux de bascule
- S1 ✅ Conformité insuffisante, clients veulent le risque résiduel
- S2 ✅ Données terrain s'unifient
- S3 ✅ Pression sur les délais
- S4 ✅ Responsabilité juridique sur le protocole
- S5 ❓ Monitoring continu vs missions répétées
- S6 ✅ Fil numérique repérage→désamiantage (SwissBuilding)

---

## Phénomènes émergents (multi-acteurs)
1. Contagion structurelle — une décision d'un acteur cascade sur tous les autres
2. SwissBuilding → marché — coordination des services autour du bâtiment
3. Transparence recompose le pouvoir — qui cadre les données contrôle le jeu
4. Chaîne de confiance vérifiable — prouver que la donnée n'a pas été manipulée
5. Symbiose/parasitisme — certains acteurs contribuent, d'autres captent sans contribuer

---

## Concurrence (validé)
**Personne ne fait exactement ça en Suisse.** Beaucoup de briques adjacentes (Wüest, Garaio, Deepki, PlanRadar...) mais aucun ne fait la chaîne complète registres → fusion → preuve terrain → multi-acteurs → recommandation.

---

## Stack technique GED recommandée
- OCR : PaddleOCR ou docTR
- Layout : LayoutLMv3 (phase 2)
- Classification : règles + embeddings + petit modèle
- Extraction : regex + LLM fallback (Claude)
- NER immobilier : spaCy fine-tuné
- Tableaux : pdfplumber
- Knowledge graph : Neo4j ou embeddings
- Pipeline : Dagster ou Prefect

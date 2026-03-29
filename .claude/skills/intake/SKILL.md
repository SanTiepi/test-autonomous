---
name: intake
description: "Questionnaire pré-dev pré-rempli intelligemment. Usage: /intake <idée en 1-2 lignes>. Génère 20-40 décisions pré-remplies, l'humain valide/corrige en 2 min."
user-invocable: true
---

# /intake — Décisions pré-dev pré-remplies

L'utilisateur donne une idée en 1-2 lignes. Le système génère un questionnaire de décisions PRÉ-REMPLIES intelligemment. L'humain ne fait que valider ou corriger les points où il est en désaccord.

## Process

L'intake passe par une **boucle de brainstorm interne** avant d'être présenté à l'humain. L'humain ne voit que le résultat éprouvé.

### Étape 1 — Comprendre le contexte (Claude)
- Lis CLAUDE.md / README.md pour le projet
- Scanne les modules existants (ls src/, ls app/) pour comprendre l'architecture
- Identifie les patterns existants (style de tests, conventions, stack)
- Résume en 3 lignes : projet, stack, contraintes connues

### Étape 2 — Round 1 : Codex génère les questions + pré-remplissage
```bash
codex exec --full-auto "Projet: [CONTEXTE]. Idée: [IDÉE]. Analyse le repo en profondeur. Génère un questionnaire pré-dev avec réponses par défaut. Pour chaque point: question courte | défaut | confiance (haute/moyenne/faible) | pourquoi ce défaut | source (repo/pattern/inférence). Couvre: scope MVP, parcours métier, architecture, données, UX, priorités, edge cases, tests, déploiement, risques, dépendances. 20-25 points. Sois exigeant — pose les questions qu'un CTO poserait avant de valider un sprint."
```

### Étape 3 — Round 2 : Claude challenge et enrichit
Prends la liste de Codex et :
- **Challenge chaque réponse basse confiance** — est-ce que le code dit autre chose ?
- **Ajoute les questions manquantes** — Codex rate souvent : les conflits avec l'existant, les impacts UX, les cas de rollback
- **Corrige les défauts faux** — si le repo montre un pattern différent de ce que Codex suppose
- **Fusionne les doublons**
- **Trie par impact** — les décisions architecturales d'abord, les détails ensuite

### Étape 3b — Round 3 (optionnel, si l'idée est complexe) : Codex valide le questionnaire final
```bash
codex exec --full-auto "Voici le questionnaire pré-dev final pour [IDÉE]. [QUESTIONNAIRE]. Vérifie: (1) manque-t-il une question critique ? (2) y a-t-il des contradictions entre réponses ? (3) les confiances sont-elles réalistes ? (4) l'ordre est-il logique ? Réponds en 5 lignes max: ce qui manque, ce qui est contradictoire, ce qui est sur-confiant."
```

Si Codex trouve des trous, intègre-les avant de présenter à l'humain.

### Étape 4 — Présenter le questionnaire

Format de sortie — chaque question sur 1-2 lignes max :

```
# /intake — [titre de l'idée]

## Scope & Objectif
1. ✅ MVP = [description courte] → [oui/non] (haute confiance)
2. ✅ Hors scope V1 : [ce qui est exclu] (haute)
3. ⚠️ [question incertaine] → [défaut] (faible — à confirmer)

## Métier & Process
4. ✅ [règle métier] → [défaut] (haute)
5. ✅ [workflow] → [défaut] (haute)
6. ⚠️ [cas ambigu] → [défaut] (moyenne)

## Architecture & Données
7. ✅ Module : [où ça vit] → [défaut] (haute — basé sur le repo)
8. ✅ Migration : [oui/non] (haute)
9. ⚠️ [dépendance] → [défaut] (moyenne)

## UX & Utilisateurs
10. ✅ [surface produit] → [défaut] (haute)
11. ⚠️ [notification/feedback] → [défaut] (moyenne)

## Tests & Déploiement
12. ✅ Tests requis : [types] (haute)
13. ✅ Feature flag : [oui/non] (haute)
14. ✅ Rollback safe : [oui/non] (haute)

## Risques & Inconnues
15. 🔴 [risque principal] → [mitigation proposée] (à confirmer)
16. ⚠️ [inconnue] → [hypothèse] (faible)
```

Légende :
- ✅ = haute confiance, probablement correct
- ⚠️ = confiance moyenne, vérifier
- 🔴 = décision critique ou confiance faible, validation humaine requise

### Étape 5 — Demander la validation

Après le questionnaire, ajoute :

```
---
**Validation rapide :** Tout ce qui est ✅ est pré-validé.
Indique seulement les numéros que tu veux CHANGER et la nouvelle valeur.
Exemple: "3: non, 9: utiliser Redis, 15: pas de risque ici"
Si tout est bon: "ok" suffit.
---
```

### Étape 6 — Générer le brief de développement

Après validation humaine, génère un brief compact :

```
## Brief validé — [titre]
**Scope:** [1 ligne]
**Contraintes:** [liste]
**Décisions clés:** [les points modifiés par l'humain]
**Architecture:** [où, comment]
**Tests:** [quoi tester]
**Risques:** [ce qui reste incertain]
**Première étape:** [action concrète]
```

Ce brief est directement consommable par toi ou Codex pour commencer le développement.

## Règles
- Maximum 25 questions (au-delà c'est du bruit)
- Minimum 10 questions (en-dessous c'est superficiel)
- Les questions ✅ haute confiance ne devraient pas dépasser 60% — si tout est "sûr", tu ne poses pas les bonnes questions
- Au moins 2-3 questions 🔴 (décisions critiques) — sinon le projet est trivial ou tu n'as pas creusé assez
- Le questionnaire doit être lisible en 2 minutes, pas 20
- L'humain ne devrait modifier que 3-8 points sur 20 — si c'est plus, le pré-remplissage est mauvais

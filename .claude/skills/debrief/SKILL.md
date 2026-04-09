---
name: debrief
description: "Debrief du soir — recap + questions pour enrichir Cortex. Usage: /debrief ou /debrief 2026-04-09"
user-invocable: true
---

# /debrief — Boucle du soir Cortex

Le debrief est le cœur vivant de Cortex. Il transforme la capture passive en connaissance active.

## Étape 1 : Générer le recap

```bash
cd "c:/PROJET IA/Cortex" && node src/index.mjs rebuild 2>&1 | grep -v ExperimentalWarning | grep -v trace-warnings
```

Puis lance le debrief (utilise la date passée en argument, ou aujourd'hui par défaut) :

```bash
cd "c:/PROJET IA/Cortex" && node src/debrief.mjs ARGUMENTS 2>&1 | grep -v ExperimentalWarning | grep -v trace-warnings
```

## Étape 2 : Présenter le recap à Robin

Affiche le contenu du daily généré de manière lisible. Montre :
- Nombre d'événements et projets touchés
- Les décisions/idées notables
- Les trous détectés

## Étape 3 : Poser les questions

Pose les questions identifiées par le debrief UNE PAR UNE. Attends la réponse de Robin avant de passer à la suivante.

Pour chaque réponse de Robin, crée un nouvel événement canonique dans `vault/events/debrief/` :

```markdown
---
id: evt_{YYYYMMDD}_{HHMM}_{4hex}
timestamp: {ISO 8601 maintenant}
source: debrief
type: {fact|memory|emotion|decision selon la réponse}
summary: "{résumé 1 ligne de la réponse}"
projects: [{projets mentionnés}]
people: [{personnes mentionnées}]
tags: [debrief]
confidentiality: private
confidence: 0.9
---

{Réponse complète de Robin, reformulée si nécessaire pour être factuelle et durable.}
```

Après avoir écrit le fichier, confirme à Robin que la réponse a été enregistrée.

## Étape 4 : Clôture

Une fois toutes les questions posées (ou si Robin dit stop) :
1. Rebuild l'index : `cd "c:/PROJET IA/Cortex" && node src/index.mjs rebuild`
2. Affiche les stats mises à jour : `cd "c:/PROJET IA/Cortex" && node src/query.mjs --stats`
3. Dis bonne nuit.

## Règles
- Maximum 5 questions par session
- Si Robin dit "stop" ou "ça suffit", on arrête immédiatement
- Les réponses sont TOUJOURS sauvegardées en format canonique
- Ne jamais inventer de contenu — ne sauvegarder que ce que Robin dit
- Le ton est conversationnel, pas interrogatoire

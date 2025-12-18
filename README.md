
## Résumé du raisonnement et des idées 

### 1) Le problème de départ

Le projet consiste à **transformer une bande sonore en mouvement physique** :

* plusieurs moteurs (≈10)
* chaque moteur fait tourner des LEDs sur un cercle
* un moteur a **3200 pas pour un tour**
* les moteurs reçoivent des ordres **toutes les 25 ms** (≈40 Hz)

L’entrée sonore produit une valeur abstraite **P** (amplitude, énergie, fréquence, etc.), qui **évolue dans le temps**.

Le défi n’est **pas** de faire tourner les moteurs, mais de :

* créer des **décalages de vitesse** entre moteurs
* générer des **formes visuelles cohérentes**
* éviter que le système se **désynchronise de façon chaotique** au bout de quelques secondes.

---

### 2) L’idée naïve (et son problème)

Une première idée était :

* convertir directement P → vitesse moteur
* chaque moteur reçoit une vitesse différente (ex : 2400, 3200, 4000 pas/s)

Problème :

* si on assigne des vitesses de manière arbitraire ou pseudo-aléatoire
* les moteurs **dérivent les uns par rapport aux autres**
* visuellement, ça finit par “ne plus rien raconter”.

➡️ Il faut une **structure mathématique** qui maintient une cohérence globale.

---

### 3) La notion clé : cohérence ≠ synchronisation

Objectif important :

* **ne pas** forcer tous les moteurs à être toujours synchrones
* mais **ne pas** les laisser dériver librement non plus

On cherche :

* des **décalages contrôlés**
* des motifs stables dans le temps
* parfois des moments de rapprochement / resynchronisation partielle

---

### 4) La bonne abstraction : travailler en “phase”, pas directement en pas moteur

Plutôt que penser uniquement en :

* pas par seconde
* positions absolues

On raisonne en :

* **phases sur un cercle** (0 → 2π)
* chaque moteur est un point qui avance sur un cercle
* les vitesses deviennent des **vitesses angulaires**

Cela permet de :

* penser en termes de **formes géométriques**
* raisonner en **relations entre moteurs**
* séparer la logique artistique de la logique matérielle

---

### 5) Pourquoi un réseau d’oscillateurs couplés (type Kuramoto)

Un réseau d’oscillateurs couplés permet :

* à chaque moteur d’avoir sa **tendance propre** (vitesse naturelle)
* mais d’être **influencé par les autres**

Résultat :

* même avec des vitesses différentes, le système reste **harmonieux**
* les moteurs peuvent se décaler, onduler, se regrouper
* sans jamais exploser en chaos

➡️ Le couplage agit comme un **chef d’orchestre collectif**.

---

### 6) Les “patterns” (chorégraphies)

Plutôt que des vitesses aléatoires, on définit des **patterns stables** :

Exemples :

* tous ensemble (unisson)
* éventail symétrique (vitesses graduelles)
* groupes alternés
* onde qui se propage
* poursuite (un moteur “leader”)
* moments de “rendez-vous” où tout se recale

Chaque pattern :

* est **visuellement lisible**
* peut durer longtemps sans se dégrader
* peut être changé à la volée

---

### 7) Le rôle de la musique (P)

La musique (P) n’est **pas** censée piloter directement les moteurs.

Elle sert plutôt à :

* influencer le **choix du pattern**
* moduler l’intensité (amplitude) du pattern
* accélérer ou ralentir une chorégraphie existante

➡️ P = **intention musicale**
➡️ le système = **traduction mécanique harmonisée**

---

### 8) Séparation des responsabilités

Conceptuellement :

* **la musique** donne une direction (P)
* **la chorégraphie** définit des règles de mouvement
* **le réseau couplé** garantit la cohérence
* **la conversion en pas moteur** est purement technique

Cette séparation permet :

* de changer de musique sans casser la forme
* de changer de forme sans toucher au hardware
* de garder un système robuste et lisible

---

### 9) Pourquoi cette approche est adaptée à un objet artistique

Parce que :

* elle produit des formes **organiques**, pas mécaniques
* elle accepte l’évolution dans le temps
* elle permet des surprises contrôlées
* elle évite l’effet “random cheap”

En résumé :

> On ne fait pas tourner des moteurs sur de la musique,
> on **orchestré un système vivant** qui réagit à la musique.



# Kuramoto Motor Choreography (Max/MSP js)

Script Max/MSP qui pilote un réseau de **10 oscillateurs couplés (Kuramoto)** pour générer des chorégraphies de moteurs pas-à-pas synchronisées.

## Principe

Le modèle de Kuramoto simule des oscillateurs couplés qui s'attirent mutuellement vers la synchronisation. Chaque oscillateur représente un moteur et possède :

- Une **phase** (0 → 2π)
- Une **fréquence naturelle** (ωᵢ) définie par le pattern actif
- Un **couplage** avec les autres oscillateurs qui maintient la cohérence globale

L'intégration suit l'équation :
```
dθ/dt = ωᵢ + Σ Kᵢⱼ sin(θⱼ − θᵢ) / N
```

## Configuration

| Paramètre | Valeur | Description |
|-----------|--------|-------------|
| `stepSize` | 0.025s | Tick de 25ms (40 Hz) |
| `networkSize` | 10 | Nombre d'oscillateurs/moteurs |
| `stepsPerRev` | 3200 | Pas par révolution moteur |
| `coupling` | 1.5 | Force de couplage globale |
| `minSps/maxSps` | ±5200 | Limites de vitesse (pas/s) |

## Patterns disponibles

| Index | Nom | Description |
|-------|-----|-------------|
| 0 | `UNISON` | Tous les moteurs à la même vitesse |
| 1 | `FAN_SYMMETRIC` | Éventail symétrique (vitesses graduelles) |
| 2 | `GROUPS_2` | Alternance pair/impair |
| 3 | `WAVE_PHASE` | Onde sinusoïdale qui se déplace |
| 4 | `CHASE` | Un moteur "boosté" qui se déplace (poursuite) |
| 5 | `RENDEZVOUS_LOCK` | Recale périodiquement vers une phase cible |

## Sorties (Outlets)

| Outlet | Contenu | Format |
|--------|---------|--------|
| 0 | Phases | Liste de N valeurs (0..2π) |
| 1 | Visualisation | `i x y z r g b` pour chaque moteur |
| 2 | Omega | Vitesses angulaires (rad/s, signé) |
| 3 | Alpha | Accélérations angulaires (rad/s², signé) |
| 4 | Motor SPS | Vitesses moteur (pas/s, signé) |
| 5 | Motor Data | `[posCumul...] + [posWrapped...] + [deltaSteps...]` |

## Commandes Max/MSP

### Contrôle de la boucle

| Message | Action |
|---------|--------|
| `start` | Démarre l'auto-step (Task toutes les 25ms) |
| `stop` | Arrête l'auto-step |
| `bang` | Exécute un seul step() |
| `setMetro 25` | Change l'intervalle du Task (ms) |

### Patterns et paramètres

| Message | Action |
|---------|--------|
| `pattern 0..5` | Sélectionne un pattern |
| `p 0..100` | Définit P (contrôle vitesse/amplitude) |
| `scale 1.2` | Multiplie toutes les vitesses moteur |
| `setCoupling 1.5` | Force de couplage globale |

### Configuration

| Message | Action |
|---------|--------|
| `reset` | Réinitialise le réseau |
| `networks 12` | Change le nombre d'oscillateurs et réinit |
| `stepsperrev 3200` | Change le nombre de pas par révolution |
| `setPhases val...` | Définit les phases (1 ou N valeurs) |
| `modulateFrequencies val...` | Override manuel des fréquences (rad/s) |

## Pilotage P (0..100)

Le paramètre P influence :
- La **vitesse de base** : 2200 → 4200 pas/s
- L'**amplitude des patterns** : spread, alternance, wave, chase...

## Branchement Arduino

Selon votre protocole de communication :

- **Vitesse (pas/s)** : utilisez **Outlet 4**
- **Position absolue** : utilisez **Outlet 5** (`motorStepPos[]` ou `motorPosWrapped[]`)
- **Delta par tick** : utilisez **Outlet 5** (dernière partie `motorDelta[]`)

> **Note** : Arrondissez les valeurs (`Math.round`) côté Max ou Arduino si nécessaire.

## Exemple de patch Max

```
[loadbang]
    |
[start]
    |
[js choregraphy.js]
    |   |   |   |   |   |
   [0] [1] [2] [3] [4] [5]
```

Envoi de commandes :
```
[message: pattern 3]──────┐
[message: p 75]───────────┤
[metro 25]──[bang]────────┤
                          │
                [js choregraphy.js]
```

## Limitations connues

- Pas de gestion des contraintes physiques stepper (accel max/jerk)
- Si les moteurs "décrochent", ajouter un limiteur d'accélération sur `motorSps`
- `RENDEZVOUS_LOCK` recommandé pour éviter la dérive visuelle dans le temps

## Licence

MIT

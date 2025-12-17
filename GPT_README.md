Voici un README (copier-coller) qui explique **ce que j’ai gardé**, **ce que j’ai changé**, et **comment l’utiliser** dans Max/MSP.

---

# README — Kuramoto Motor Choreography (Max/MSP js)

## Objectif

Ce script Max/MSP pilote un réseau de **10 oscillateurs couplés (Kuramoto)** pour générer une chorégraphie “harmonieuse” de phases, puis **convertit** ces vitesses angulaires en **vitesses moteur en pas/seconde** et en **delta de pas** à **25 ms** (logique Arduino / stepper).

---

## Ce que j’ai gardé du JS d’origine

### 1) Le cœur “Kuramoto”

* `phases[]` : phases des oscillateurs (0 → 2π)
* `naturalFrequencies[]` : fréquences naturelles (ωᵢ)
* `couplingMatrix[][]` + `coupling` : couplage global (force d’attraction/alignement)
* L’intégration :

    * pour chaque oscillateur i :
      `dθ/dt = ωᵢ + Σ Kᵢⱼ sin(θⱼ − θᵢ) / N`
    * mise à jour des phases par pas de temps

👉 C’est **la partie qui empêche le “n’importe quoi”** : même si on donne des vitesses différentes, le couplage garde une cohérence.

### 2) La visualisation

* `sendPositions()` : conversion phase → (x,y) sur un cercle
* Couleurs pilotées par une mesure dynamique (j’ai basculé sur l’accélération angulaire signée mais colorée en valeur absolue)

### 3) Le style Max/MSP

* `inlets/outlets/post/arrayfromargs`
* Fonctions de contrôle (j’ai gardé l’esprit de `setPhases`, `setCoupling`, etc.)

---

## Ce que j’ai modifié / ajouté (important)

### A) Pas de temps aligné sur 25 ms

Dans l’original, `stepSize = 0.5` (500 ms).
Ici :

* `stepSize = 0.025` seconde (**25ms**)

👉 C’est cohérent avec “40 ordres par seconde” côté moteurs.

### B) Vitesse et accélération **signées** (pas de `Math.abs`)

L’original faisait `Math.abs(phases[i] - oldPhases[i])`, ce qui :

* casse le sens de rotation
* rend impossible les patterns “un moteur accélère pendant qu’un autre ralentit”

J’ai remplacé par :

* un `signedDeltaPhase()` qui “unwrap” le delta dans `[-π, +π]`
* puis :

    * `omega[i] = dphi / stepSize` (rad/s, signé)
    * `alpha[i] = (omega[i] - previousOmega[i]) / stepSize` (rad/s², signé)

### C) Conversion Kuramoto → moteurs en pas

On garde Kuramoto en radians, mais on sort aussi du “hardware-friendly” :

* `stepsPerRev = 3200`
* conversion :

    * `steps/s = (rad/s) * stepsPerRev / (2π)`
* delta par tick :

    * `deltaSteps = steps/s * stepSize`

Et on intègre une position cumulée :

* `motorStepPos[i] += deltaSteps`

### D) Librairie de patterns (chorégraphies)

J’ai ajouté `patterns[]` + `applyPattern()`.

Les patterns **modulent `naturalFrequencies[]`** (ωᵢ), ce qui est le bon endroit :

* le pattern donne la “tendance”
* le couplage garde la cohérence globale

Patterns fournis :

* `UNISON` : tous ensemble
* `FAN_SYMMETRIC` : éventail symétrique (vitesses graduelles)
* `GROUPS_2` : alternance pair/impair
* `WAVE_PHASE` : onde (sinusoïde) qui se déplace
* `CHASE` : un moteur “boosté” qui se déplace (effet poursuite)
* `RENDEZVOUS_LOCK` : recale périodiquement vers une phase cible (évite dérive visuelle)

### E) Pilotage par P (0..100)

* `Pvalue` (clamp 0..100)
* `P` influence :

    * la vitesse de base (ex : 2200 → 4200 steps/s)
    * l’amplitude des patterns (spread, alternance, wave, chase…)

### F) Sorties (outlets)

J’ai augmenté `outlets` à **6** pour ne pas casser les sorties existantes.

* **Outlet 0** : `phases[]` (0..2π)
* **Outlet 1** : viz : `i x y z r g b`
* **Outlet 2** : `omega[]` (rad/s, signé)
* **Outlet 3** : `alpha[]` (rad/s², signé)
* **Outlet 4** : `motorSps[]` (steps/s, signé)
* **Outlet 5** : grosse liste concaténée :

    1. `motorStepPos[0..N-1]` (cumul en pas)
    2. `motorPosWrapped[0..N-1]` (0..stepsPerRev)
    3. `motorDelta[0..N-1]` (delta steps sur 25ms)

---

## Utilisation rapide dans Max/MSP

### Lancer / arrêter la boucle 25 ms

* `start` : démarre l’auto-step (Task toutes les 25ms)
* `stop` : stoppe

Ou manuel :

* `bang` : fait un seul `step()`

### Changer pattern

* `pattern 0` → UNISON
* `pattern 1` → FAN_SYMMETRIC
* `pattern 2` → GROUPS_2
* `pattern 3` → WAVE_PHASE
* `pattern 4` → CHASE
* `pattern 5` → RENDEZVOUS_LOCK

### Envoyer P (0..100)

* `p 42`

### Autres commandes

* `scale 1.2` : multiplie toutes les vitesses moteurs
* `setCoupling 1.5` : couplage global
* `setMetro 25` : intervalle Task (ms)
* `reset` : réinitialise
* `networks 12` : change le nombre d’oscillateurs et réinit

---

## Comment brancher l’Arduino

Selon votre protocole :

* si vous pilotez en **pas/seconde** : utilisez **Outlet 4**
* si vous pilotez en **positions absolues** : utilisez dans **Outlet 5** la partie `motorStepPos[]` (ou `motorPosWrapped[]` si vous voulez 0..3200)

> Note : l’arduino aime souvent des entiers. Vous pouvez arrondir (`Math.round`) côté Max ou côté Arduino.

---

## Notes / limites (à connaître)

* Ce script ne gère pas encore les contraintes physiques de stepper (accel max/jerk).
  Si vos moteurs “décrochent”, il faudra ajouter un **limiteur d’accélération** sur `motorSps`.
* `minSps/maxSps` clamp les vitesses pour éviter les valeurs trop extrêmes.
* `RENDEZVOUS_LOCK` est très utile pour éviter une dérive trop libre dans le temps.

---

Si tu veux, je peux aussi te faire une version “**Arduino-friendly strict**” :

* vitesses uniquement positives (ou gestion direction séparée)
* positions en entiers
* mapping P → patterns par tranches (0–20, 20–40…) plutôt que par paramètre continu.

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

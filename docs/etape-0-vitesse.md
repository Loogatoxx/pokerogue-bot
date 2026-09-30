# Étape 0 — Vitesse du simulateur (30/09/2026)

**Verdict : feu vert.** Le jeu tourne sans écran, avec son vrai hasard, assez vite pour
l'apprentissage par renforcement, et tient une partie Classique complète jusqu'à la vague 200.

## Ce qui a été mesuré

Le banc [`simulateur/banc-vitesse.test.ts`](../simulateur/banc-vitesse.test.ts) fait jouer trois
joueurs automatiques dans la vraie copie du jeu (version 1.12.0.11, la même que pokerogue.net) :

| Joueur | Rôle | Vague moyenne atteinte |
|---|---|---|
| hasard | attaque au hasard — le futur cerveau v0 | ~5 |
| glouton | attaque la plus forte contre l'ennemi | ~7 (max 13) |
| marathon | glouton surpuissant (niveau 300, soigné entre les vagues) | ~197 (200 atteinte, boss final battu) |

Le glouton plafonne vers la vague 7 parce qu'il ne change jamais de Pokémon, ne se soigne pas
et part avec trois starters niveau 5. C'est la barre que le cerveau devra dépasser.

## Résultats

| Mesure | Valeur |
|---|---|
| 1 processus | ~70 décisions/s, ~1 350 phases/s |
| 8 processus en parallèle | 190 à 280 décisions/s (démarrage d'environ 9 s compris) |
| Mémoire pour 8 processus | ~3,9 Go |
| Partie complète de 200 vagues | 10 à 15 s en solo, ~700 décisions |
| Fiabilité (deux bancs finaux) | 0 erreur sur 280 parties |

Ordre de grandeur pour l'entraînement : **environ 900 000 décisions par heure, 7 millions par
nuit**. Les apprentissages sur des jeux de ce genre demandent des dizaines de millions de
décisions : comptons plusieurs nuits à quelques semaines de calcul pour viser la vague 200.

Les résultats bruts sont sur le Lexar : `/Volumes/Lexar/pokerogue-bot/bancs/`.
Le fichier `banc-2026-09-30_165806.json` est une version boguée du banc (régression corrigée
juste après) : il ne faut pas en tenir compte.

## Ce que l'étape a appris (pièges déjà corrigés)

1. **L'outil de test désactive le hasard** (« toujours le jet maximum ») et **fige la graine**
   à `"test"`. Le banc remet la vraie fonction et une graine unique par partie.
2. **Les starters de l'outil de test n'ont aucune attaque.** Le banc leur donne celles du vrai
   écran de sélection : les attaques apprises entre les niveaux 1 et 5, quatre au maximum.
3. **Node 26 masque le `localStorage` du navigateur simulé** → `NODE_OPTIONS=--no-experimental-webstorage`.
4. **Enchaîner les phases trop vite crée des courses** : l'horloge simulée du jeu ne bat que
   toutes les millisecondes. Le banc attend les minuteries en cours avant la phase suivante.
5. **Forcer les combats simples bloque les duos de dresseurs** : le Pokémon du second dresseur
   n'entre jamais. Les combats doubles sont donc gérés (deux commandes, choix de la cible).
6. **Boucles de la boutique** : une CT refusée ou un Champignon Mémoire inutilisable revenaient
   à l'infini. Le joueur retient les récompenses déjà essayées dans la vague.

## Limites connues (à traiter dans l'environnement d'entraînement)

- **Rencontres mystère** désactivées (comme par défaut dans l'outil de test) : il faudra gérer
  leurs menus.
- **Choix des starters** : trio fixe Bulbizarre / Salamèche / Carapuce, sans le système de points.
- **Éclosion d'œufs** pas encore rencontrée (aucun bon d'œuf pris).
- **Écran du Scanner d'IV** sauté (il plante sans graphismes) ; l'information reste lisible.
- **Le glouton lit les talents cachés** de l'ennemi : acceptable pour mesurer la vitesse, interdit
  pour le cerveau (perception humaine).
- Le « répondeur » passe par l'interface (touches simulées). Le futur pilote de l'environnement
  d'entraînement sera plus direct et plus rapide.

## Relancer le banc

```bash
./simulateur/lancer-banc.sh 8
```

Le premier argument est le nombre de processus en parallèle. Réglages possibles :
`BANC_PARTIES`, `BANC_MARATHONS`, `BANC_NIVEAU_MARATHON`.

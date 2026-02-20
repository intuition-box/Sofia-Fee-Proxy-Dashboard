# Fee Metric Dashboard — Audit & Fix Resume

## Problème initial

Les métriques affichées étaient incohérentes :

| Période | NB TX  | TRUST Amount | Wallets |
|---------|--------|--------------|---------|
| 7j      | 2 295  | 169.86       | 15      |
| 30j     | 2 526  | 186.322      | 17      |
| Total   | 2 964  | 231.0066     | 19      |

- 77% des TX tombaient dans les 7 derniers jours → impossible pour un proxy en place depuis plusieurs mois
- Différence 7j/30j = seulement 231 TX → incohérent
- L'explorer blockchain montrait un nombre de TX différent du dashboard

---

## Analyse (4 agents parallèles)

### Fichiers audités

| Fichier | Verdict |
|---------|---------|
| `src/services/BlockResolver.ts` | **BUG CRITIQUE** — timestamps interpolés faux |
| `src/services/EventFetcher.ts` | OK (sauf dépendance au BlockResolver) |
| `src/services/FeeAnalytics.ts` | OK — logique de filtrage correcte |
| `src/services/RpcQueue.ts` | OK — rate limiting fonctionnel |
| `src/services/rpcClient.ts` | OK |
| `src/hooks/useFeeData.ts` | OK |
| `src/components/*` | OK — affichage correct |
| `src/utils/format.ts` | OK |
| `src/config.ts` | OK (DEPLOY_BLOCK = 143_120n) |

### Bug critique : interpolation linéaire des timestamps

**Ancien code (`BlockResolver.ts`)** :
```typescript
// Seulement 2 points de référence (premier event block + block actuel)
const blockSpan = Number(latestBlock - earliestBlock)
const timeSpan = this.refLatestTimestamp - this.refEarlyTimestamp
this.secPerBlock = blockSpan > 0 ? timeSpan / blockSpan : 1

// Interpolation linéaire pour TOUS les blocks
resolve(blockNumber: bigint): number {
  const blockDiff = Number(this.refLatestBlock - blockNumber)
  return Math.round(this.refLatestTimestamp - blockDiff * this.secPerBlock)
}
```

**Pourquoi c'est faux** :
- Hypothèse : block time constant → FAUX (le block time varie toujours)
- Si blocks anciens = block time lent, blocks récents = block time rapide,
  l'interpolation fait la MOYENNE et assigne aux anciens events des timestamps
  trop récents → ils tombent dans la fenêtre "7 jours" alors qu'ils datent de mois
- À chaque recalibration (60s), `secPerBlock` change → timestamps instables

### Bugs secondaires identifiés

- **Recalibration instable** : anciens events gardent vieux timestamps,
  nouveaux events reçoivent timestamps avec ratio différent → incohérences
- **Commentaire trompeur** (`EventFetcher.ts:20`) :
  `timestamp: number // real on-chain timestamp` → c'était interpolé, pas réel
- **BLOCK_CHUNK = 50_000** : potentiellement trop grand pour certains RPC providers
  (risque de troncature silencieuse des résultats)
- **Pas de persistance** : tous les events re-fetch à chaque rechargement de page

### Ce qui est correct

- `FeeAnalytics.computePeriodStats()` : filtrage par timestamp >= cutoff → OK
- Calcul `sevenDaysAgo = now - 7 * 24 * 3600` → OK
- Comptage wallets via `Set<string>` avec `.toLowerCase()` → OK
- Somme des fees en `bigint` → OK, pas de perte de précision
- `formatTrust()` : `formatEther()` + `toFixed(4)` → OK
- Composants React : affichage direct des valeurs calculées → OK

---

## Fix appliqué

### Approche : vrais timestamps on-chain + batch JSON-RPC + localStorage

Au lieu d'interpoler, on fetch le vrai timestamp de chaque block via `eth_getBlockByNumber`
en batch JSON-RPC (50 blocks par requête HTTP).

### Fichiers modifiés

#### 1. `src/services/BlockResolver.ts` — Réécrit

- **Batch JSON-RPC** : envoie 50 `eth_getBlockByNumber` par requête HTTP
- **localStorage** : persiste le cache `blockNumber → timestamp`
  - Premier load : lent (~1-2 min) — fetch tous les blocks uniques
  - Loads suivants : instantané — lit depuis localStorage, ne fetch que les nouveaux blocks
- **rateLimitedFetch** : utilise le même rate limiter que viem (plus de compétition)
- **Retry robuste** : 8 retries max avec backoff exponentiel 3s → 60s sur 429

#### 2. `src/services/EventFetcher.ts` — 3 lignes changées

```diff
- // Calibrate block resolver with earliest event + latest block (2 RPC calls max)
- const earliestBlock = this.events.length > 0
-   ? this.events[0].blockNumber
-   : newLogs[0].blockNumber
- await this.blockResolver.calibrate(earliestBlock, currentBlock)
- // Resolve timestamps via interpolation (no RPC calls)
- const blockNumbers = newLogs.map((log) => log.blockNumber)
- const timestamps = this.blockResolver.resolveMany(blockNumbers)
+ // Fetch real on-chain timestamps (cached for previously seen blocks)
+ const blockNumbers = newLogs.map((log) => log.blockNumber)
+ const timestamps = await this.blockResolver.resolveBlocks(blockNumbers)
```

#### 3. `src/services/rpcClient.ts` — Export ajouté

```diff
+ /** Rate-limited fetch shared by viem client AND batch requests (BlockResolver). */
+ export const rateLimitedFetch = rpcQueue.createFetchFn()
```

### Architecture après fix

```
Page load
  └── useFeeData.fetchData()
        ├── eventFetcher.fetch()
        │     ├── getLogsInChunks(DEPLOY_BLOCK → currentBlock)  [via rpcClient → RpcQueue]
        │     └── blockResolver.resolveBlocks(blockNumbers)
        │           ├── loadFromStorage()     → localStorage cache (instantané)
        │           ├── fetchViaBatch()       → batch JSON-RPC [via rateLimitedFetch → RpcQueue]
        │           └── saveToStorage()       → persist pour prochains loads
        └── feeAnalytics.computeAll(events)   → filtrage par vrais timestamps
```

Toutes les requêtes HTTP passent par le même `RpcQueue` → pas de compétition, pas de 429.

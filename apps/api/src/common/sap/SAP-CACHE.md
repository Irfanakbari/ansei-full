# Shared SAP cache (6.13.0)

SAP reads now use an in-process front cache backed by Redis. Redis uses the
existing REDIS_HOST / REDIS_PORT / REDIS_PASSWORD settings through BullMQ's
installed RedisConnection adapter, with a dedicated non-blocking connection,
no offline command queue, and bounded connection/command waits. There is no
database migration and no new package dependency.

| Data                                                 | Fresh                               | Maximum age          |
| ---------------------------------------------------- | ----------------------------------- | -------------------- |
| Material item group 128                              | 5 minutes                           | 30 minutes           |
| Finish good item group 120                           | 5 minutes                           | 30 minutes           |
| Parsed BOM per SAP code, including genuine not-found | 5 minutes                           | 30 minutes           |
| Warehouse names                                      | 30 minutes                          | 24 hours             |
| SAP session                                          | SAP timeout minus a 1 minute margin | Same absolute expiry |

Groups remain configurable with the existing item-group env settings. A read
after the fresh TTL initiates refresh; usable local stale data returns immediately.
A cold material/FG list returns UNKNOWN while Redis hydration runs in the
background, preserving the existing non-blocking response contract. BOM cold
lookups wait for the cache/loader. No activity means no scheduled SAP queries.

The original checked-at time is retained across instances and restarts. Failed
fetches never overwrite a complete snapshot or turn UNKNOWN into NOT_FOUND.
Stale values stop being served at their maximum age. Warehouse failures may
leave a warehouse label unavailable while retaining the SAP warehouse code.

An atomic Redis lease elects one loader per cache key across API replicas. It
expires after 180 seconds, exceeding the existing bounded SAP pagination budget.
Publication and release check the owner token so an expired owner cannot replace
a newer snapshot or remove another worker's lease. A failure creates a shared
60-second cooldown (all BOM keys share one failure cooldown). A cold contender
waits briefly for the owner and otherwise returns unknown/retries later, without
issuing another SAP request. Different BOMs retain the per-process concurrency
limit of four; there is no global concurrency limit for distinct keys.

When Redis is down, existing usable local snapshots remain available. Cold or
expired lookups fail safely rather than bypassing the distributed lock and
flooding SAP. Outbound work remains in the PostgreSQL outbox for retries.

## Session protection and deployment

Set SAP_SESSION_CACHE_KEY to 32 cryptographically random bytes encoded as 64
hexadecimal characters. The actual local API env has been configured; never
commit, print, or expose the key to the frontend. Use the SAME key on all API
and worker replicas. Empty/unset keeps login sessions process-local; response
snapshots still use Redis. Invalid nonempty keys fail environment validation.

Only AES-256-GCM authenticated ciphertext for the cookie and expiry is stored in
Redis. The Redis namespace hashes the SAP URL, company, username, password and
encryption key; keys themselves contain no raw identifiers. Item-group/cache
keys are also hashed. Credentials/key rotation uses a new namespace; previous
entries expire naturally. Restrict Redis access because response snapshots
still contain internal SAP master data. No cookie or upstream body is logged.

A 401 invalidates only the matching encrypted session, leaving any newer
session intact, followed by at most one re-login/retry per request. Sessions
never inherit the stale-response allowance. Material PATCH writes are never
response-cached, and their PostgreSQL outbox/audit behavior is unchanged.

Cache survives API restarts. Surviving Redis restarts/crashes additionally needs
Redis persistence and a persistent data volume. The repository compose example
now configures AOF with appendfsync everysec and keeps its existing /data volume.
The earlier aof_enabled=0 observation on 2026-10-09 was the local Redis instance.
Read-only SSH verification of 10.10.10.102, /home/vuteq/ansei, confirmed
appendonly=yes, appendfsync=everysec, persistent /data, and healthy AOF writes.
No server restart or CONFIG SET was needed. AOF everysec can lose roughly one
second on a crash; PostgreSQL remains the durable source for pending jobs.
Recovery testing must use an isolated Redis instance, never flush the live server.

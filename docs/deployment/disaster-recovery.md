# Disaster Recovery Plan

## Objective
To ensure business continuity in the event of a catastrophic failure affecting the Enterprise HMS platform.

## Recovery Metrics
* **RPO (Recovery Point Objective):** 1 hour (PostgreSQL WAL streaming)
* **RTO (Recovery Time Objective):** 4 hours

## Procedures

### 1. Database Outage
* Identify outage through automated alerting.
* Verify if automatic failover to the replica instance succeeded.
* If primary is unrecoverable and replica failed, trigger Point-In-Time-Recovery (PITR) from the latest S3 backup.

### 2. Application Server Failure
* The load balancer automatically drops unhealthy instances (`/health` fails).
* Auto-scaling group spins up a new instance within 2 minutes.

### 3. Complete Region Failure
* Redirect DNS to the secondary region.
* Restore database from cross-region replication snapshot.
* Spin up stateless Next.js and API instances in the secondary region.

# Production Runbook

## Deployment Strategy
We utilize a Blue/Green deployment strategy to achieve zero downtime.

## Steps for Deployment
1. **CI Pipeline:** Push to `main`. CI runs Type Check, Lint, Unit Tests, and E2E Tests.
2. **Build:** Docker images for Web, API, and Workers are built and pushed to the container registry.
3. **Database Migration:** Run `prisma migrate deploy` on the Green database instance (must be non-breaking).
4. **Deploy Green:** Deploy new containers to the Green environment.
5. **Smoke Test:** Run automated smoke tests against the Green environment.
6. **Switch Traffic:** Update Load Balancer to route 10% traffic to Green. Monitor error rates. Switch 100% to Green if stable.
7. **Rollback:** If errors spike, instantly route 100% traffic back to Blue.

## Incident Management
* In case of a high severity error, the on-call engineer should first check Sentry logs and Datadog APM metrics.
* Execute rollback via Load Balancer traffic routing. Do not attempt live database rollbacks unless data corruption is imminent.

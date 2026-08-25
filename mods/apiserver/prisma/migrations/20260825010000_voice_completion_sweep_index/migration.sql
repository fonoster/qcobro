-- Speeds up the voice completion timeout sweep's query
-- (entrega = 'DISPATCHED' AND agentType IN (...) AND contactedAt < cutoff).
CREATE INDEX "account_contact_logs_entrega_agentType_contactedAt_idx"
ON "account_contact_logs" ("entrega", "agentType", "contactedAt");

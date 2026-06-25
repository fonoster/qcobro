-- Runs once on first init of the dev Postgres (docker-entrypoint-initdb.d).
-- The Fonoster Identity service uses its own database on the same instance; the
-- postgres image only creates POSTGRES_DB (qcobro), so create Identity's here too.
-- Identity migrates its own schema on startup once the database exists.
CREATE DATABASE identity;

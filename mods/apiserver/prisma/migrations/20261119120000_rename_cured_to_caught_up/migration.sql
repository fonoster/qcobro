-- Rename the CURED exit reason and recovery kind to CAUGHT_UP in place, so existing rows follow.
ALTER TYPE "ExitReason" RENAME VALUE 'CURED' TO 'CAUGHT_UP';
ALTER TYPE "RecoveryKind" RENAME VALUE 'CURED' TO 'CAUGHT_UP';

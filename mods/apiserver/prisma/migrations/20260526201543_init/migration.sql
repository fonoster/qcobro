-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol" TEXT NOT NULL DEFAULT 'AGENTE',
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "carteras" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "cuentas" INTEGER NOT NULL DEFAULT 0,
    "montoTotal" REAL NOT NULL DEFAULT 0,
    "montoRecuperado" REAL NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'ACTIVA',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "campanas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "carteraId" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PROGRAMADA',
    "cuentas" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "campanas_carteraId_fkey" FOREIGN KEY ("carteraId") REFERENCES "carteras" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "gestiones" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campanaId" TEXT NOT NULL,
    "cuentaId" TEXT NOT NULL,
    "agenteId" TEXT,
    "resultado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "notas" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "gestiones_campanaId_fkey" FOREIGN KEY ("campanaId") REFERENCES "campanas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "promesas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gestionId" TEXT NOT NULL,
    "cuentaId" TEXT NOT NULL,
    "monto" REAL NOT NULL,
    "fechaPromesa" DATETIME NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "promesas_gestionId_fkey" FOREIGN KEY ("gestionId") REFERENCES "gestiones" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "agentes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "estrategia" TEXT NOT NULL DEFAULT 'MODERADO',
    "estado" TEXT NOT NULL DEFAULT 'ACTIVO',
    "llamadas" INTEGER NOT NULL DEFAULT 0,
    "promesas" INTEGER NOT NULL DEFAULT 0,
    "recuperado" REAL NOT NULL DEFAULT 0,
    "tasaExito" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

import { z } from "zod";

export const CarteraSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string().min(1),
  clienteId: z.string().uuid(),
  cuentas: z.number().int().nonnegative(),
  montoTotal: z.number().nonnegative(),
  montoRecuperado: z.number().nonnegative(),
  estado: z.enum(["ACTIVA", "CERRADA"]),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const CampanaSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string().min(1),
  carteraId: z.string().uuid(),
  estado: z.enum(["PROGRAMADA", "EN_CURSO", "COMPLETADA", "CANCELADA"]),
  cuentas: z.number().int().nonnegative(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const GestionSchema = z.object({
  id: z.string().uuid(),
  campanaId: z.string().uuid(),
  agenteId: z.string().uuid().optional(),
  cuentaId: z.string().uuid(),
  resultado: z.enum(["CONTACTADO", "NO_CONTACTADO", "PROMESA", "RECHAZO", "PENDIENTE"]),
  notas: z.string().optional(),
  createdAt: z.date()
});

export const PromesaSchema = z.object({
  id: z.string().uuid(),
  gestionId: z.string().uuid(),
  cuentaId: z.string().uuid(),
  monto: z.number().positive(),
  fechaPromesa: z.date(),
  estado: z.enum(["PENDIENTE", "CUMPLIDA", "VENCIDA", "CANCELADA"]),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const AgenteSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string().min(1),
  estrategia: z.enum(["AGRESIVO", "MODERADO", "SUAVE"]),
  estado: z.enum(["ACTIVO", "PAUSADO"]),
  llamadas: z.number().int().nonnegative(),
  promesas: z.number().int().nonnegative(),
  recuperado: z.number().nonnegative(),
  tasaExito: z.number().min(0).max(100),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  nombre: z.string().min(1),
  rol: z.enum(["ADMIN", "SUPERVISOR", "AGENTE"]),
  createdAt: z.date()
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

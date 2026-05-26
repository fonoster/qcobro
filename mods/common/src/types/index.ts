import { z } from "zod";
import {
  CarteraSchema,
  CampanaSchema,
  GestionSchema,
  PromesaSchema,
  AgenteSchema,
  UserSchema
} from "../schemas/index.js";

export type Cartera = z.infer<typeof CarteraSchema>;
export type Campana = z.infer<typeof CampanaSchema>;
export type Gestion = z.infer<typeof GestionSchema>;
export type Promesa = z.infer<typeof PromesaSchema>;
export type Agente = z.infer<typeof AgenteSchema>;
export type User = z.infer<typeof UserSchema>;

export type CarteraEstado = Cartera["estado"];
export type CampanaEstado = Campana["estado"];
export type GestionResultado = Gestion["resultado"];
export type PromesaEstado = Promesa["estado"];
export type AgenteEstado = Agente["estado"];
export type UserRol = User["rol"];

import { z } from "zod";

export const req = (msg: string) => z.string({ required_error: msg }).min(1, msg);
export const oneOf = <T extends readonly [string, ...string[]]>(list: T, msg: string) =>
  z.enum(list, { errorMap: () => ({ message: msg }) });
/** An untouched optional dropdown submits "" — treat as not provided. */
export const optEnum = <T extends readonly [string, ...string[]]>(list: T) =>
  z.preprocess((v) => (v === "" ? undefined : v), z.enum(list).optional());
export const optText = z.string().optional();
export const money = (msg: string) =>
  z.number({ required_error: msg, invalid_type_error: msg }).min(0, "Cannot be negative");
export const optMoney = z.number({ invalid_type_error: "Enter a number" }).min(0, "Cannot be negative").optional();
export const optInt = z.number({ invalid_type_error: "Enter a number" }).int("Whole number").min(0).optional();
export const toNum = (v: unknown) => (v === "" || v == null || Number.isNaN(Number(v)) ? undefined : Number(v));

import { describe, expect, test } from "vitest";
import { erpEnabled, isErpPath } from "./config";
import {
  formatDay,
  formatInstant,
  formatMoney,
  isValidDocument,
  newIdempotencyKey,
  parseMoneyInput,
  parseQuantityInput,
} from "./format";

describe("dinheiro sem perda de precisão", () => {
  test.each([
    ["1.234,56", "1234.56"],
    ["1234,5", "1234.5"],
    ["1234.56", "1234.56"],
    ["R$ 10,00", "10.00"],
    ["1.234.567", "1234567"],
    ["0,01", "0.01"],
  ])("aceita %s como %s", (input, expected) => {
    expect(parseMoneyInput(input)).toBe(expected);
  });

  test.each(["", "abc", "1,234,56", "10,999", "1e5", "-5", "12,3,4", "R$"])("rejeita %j", (input) => {
    expect(parseMoneyInput(input)).toBeNull();
  });

  test("moeda formatada nunca vira o número enviado ao servidor", () => {
    const sent = parseMoneyInput("1.234,56");
    expect(sent).toBe("1234.56");
    expect(formatMoney(sent)).toContain("1.234,56");
  });

  test("ausente não vira R$ 0,00", () => {
    expect(formatMoney(null)).toBe("—");
    expect(formatMoney(undefined)).toBe("—");
    expect(formatMoney("")).toBe("—");
  });

  test("quantidades têm até 4 casas e são positivas", () => {
    expect(parseQuantityInput("2,5")).toBe("2.5");
    expect(parseQuantityInput("0,0001")).toBe("0.0001");
    expect(parseQuantityInput("0")).toBeNull();
    expect(parseQuantityInput("1,23456")).toBeNull();
    expect(parseQuantityInput("-1")).toBeNull();
  });
});

describe("datas e fusos", () => {
  test("data sem hora não sofre deslocamento de fuso", () => {
    expect(formatDay("2026-10-07")).toBe("07/10/2026");
    expect(formatDay("2026-01-01")).toBe("01/01/2026");
    expect(formatDay(null)).toBe("—");
  });

  test("instante UTC é apresentado em America/Sao_Paulo", () => {
    // 02:30 UTC de 8/out = 23:30 de 7/out em Brasília (UTC-3)
    expect(formatInstant("2026-10-08T02:30:00+00:00")).toContain("07/10/2026");
    expect(formatInstant("2026-10-08T02:30:00+00:00")).toContain("23:30");
    expect(formatInstant("invalido")).toBe("—");
  });
});

describe("documento", () => {
  test("aceita alfanumérico e rejeita símbolos", () => {
    expect(isValidDocument("12.345.678/0001-90")).toBe(true);
    expect(isValidDocument("AB12CD34000199")).toBe(true);
    expect(isValidDocument("12$%34")).toBe(false);
    expect(isValidDocument("ab")).toBe(false);
  });
});

describe("rotas e flag do ERP", () => {
  test("limite de segmento: /erp e /erp/..., nunca /erpfoo", () => {
    expect(isErpPath("/erp")).toBe(true);
    expect(isErpPath("/erp/clientes")).toBe(true);
    expect(isErpPath("/erpfoo")).toBe(false);
    expect(isErpPath("/erp-x/y")).toBe(false);
    expect(isErpPath("/")).toBe(false);
    expect(isErpPath("/crm")).toBe(false);
  });

  test("a flag só liga com 'true' explícito", () => {
    expect(erpEnabled()).toBe(false);
  });

  test("chaves de idempotência são únicas", () => {
    expect(newIdempotencyKey()).not.toBe(newIdempotencyKey());
  });
});

import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Sem `globals`, o cleanup automático do Testing Library não é registrado:
// sem isto, o DOM de um teste vaza para o seguinte no mesmo arquivo.
afterEach(() => cleanup());

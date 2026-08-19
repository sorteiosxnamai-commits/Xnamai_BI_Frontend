import { APPEARANCE_OPTIONS, type Appearance } from "./appearance";
import { useAppearance } from "./AppearanceProvider";

const LABELS: Record<Appearance, string> = {
  system: "Sistema",
  light: "Claro",
  dark: "Escuro",
};

export function AppearanceSelect() {
  const { preference, setPreference } = useAppearance();
  return (
    <label className="appearance-field">
      <span>Aparência</span>
      <select
        aria-label="Aparência"
        value={preference}
        onChange={(event) => setPreference(event.target.value as Appearance)}
      >
        {APPEARANCE_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {LABELS[option]}
          </option>
        ))}
      </select>
    </label>
  );
}

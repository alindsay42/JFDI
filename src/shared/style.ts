import type { CSSProperties } from "react";

/** Sets a CSS custom property, such as the person's colour (--you), on an element. */
export function cssVar(name: `--${string}`, value: string): CSSProperties {
  return { [name]: value } as CSSProperties;
}

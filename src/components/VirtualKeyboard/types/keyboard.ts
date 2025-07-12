export type MainMode = "simple" | "advanced";
export type SimpleMode = "melody" | "chord";

export interface KeyboardKey {
  note: string;
  isBlack: boolean;
  position: number;
  keyboardKey?: string;
}
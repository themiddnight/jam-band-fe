export type MainMode = "simple" | "advanced";
export type SimpleMode = "melody" | "chord";

export interface KeyboardKey {
  note: string;
  isBlack: boolean;
  position: number;
  label?: string;
  type?: "white" | "black";
  isActive?: boolean;
  isSustained?: boolean;
  onClick?: () => void;
  keyboardKey?: string;
}
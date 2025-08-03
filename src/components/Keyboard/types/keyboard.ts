export type KeyboardMode = "simple-melody" | "simple-chord" | "basic";

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
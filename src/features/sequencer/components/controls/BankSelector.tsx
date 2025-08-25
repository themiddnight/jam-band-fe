import { memo } from "react";
import { useTouchEvents } from "@/features/ui";
import { SEQUENCER_CONSTANTS } from "@/shared/constants";
import type { CSSProperties } from "react";

interface Bank {
  enabled: boolean;
  steps: any[];
}

interface BankSelectorProps {
  banks: Record<string, Bank>;
  currentBank: string;
  waitingBankChange: string | null;
  onBankSwitch: (bankName: string) => void;
  onBankToggleEnabled: (bankName: string) => void;
}

export const BankSelector = memo(({
  banks,
  currentBank,
  waitingBankChange,
  onBankSwitch,
  onBankToggleEnabled,
}: BankSelectorProps) => {
  // Create touch handlers for each bank
  const bankATouchHandlers = useTouchEvents({
    onPress: () => onBankSwitch("A"),
    onRelease: () => {},
    isPlayButton: true,
  });

  const bankBTouchHandlers = useTouchEvents({
    onPress: () => onBankSwitch("B"),
    onRelease: () => {},
    isPlayButton: true,
  });

  const bankCTouchHandlers = useTouchEvents({
    onPress: () => onBankSwitch("C"),
    onRelease: () => {},
    isPlayButton: true,
  });

  const bankDTouchHandlers = useTouchEvents({
    onPress: () => onBankSwitch("D"),
    onRelease: () => {},
    isPlayButton: true,
  });

  const bankTouchHandlers = {
    A: bankATouchHandlers,
    B: bankBTouchHandlers,
    C: bankCTouchHandlers,
    D: bankDTouchHandlers,
  };

  const mobileButtonStyle: CSSProperties = {
    touchAction: "manipulation",
    WebkitTapHighlightColor: "transparent",
    WebkitTouchCallout: "none" as const,
    WebkitUserSelect: "none",
    userSelect: "none",
  };

  return (
    <div className="join flex-wrap">
      {SEQUENCER_CONSTANTS.BANK_NAMES.map((bankName) => (
        <button
          key={bankName}
          className={`btn btn-sm join-item touch-manipulation ${
            bankName === currentBank
              ? waitingBankChange === bankName
                ? "btn-warning loading animate-pulse"
                : "btn-primary"
              : waitingBankChange === bankName
                ? "btn-outline btn-warning animate-pulse"
                : banks[bankName]?.enabled
                  ? "btn-outline btn-primary"
                  : "btn-outline text-base-content/50"
          }`}
          onMouseDown={() => onBankSwitch(bankName)}
          ref={bankTouchHandlers[bankName].ref as React.RefObject<HTMLButtonElement>}
          style={mobileButtonStyle}
          title={`Bank ${bankName} (${banks[bankName]?.steps?.length || 0} steps)${
            !banks[bankName]?.enabled ? " - Disabled" : ""
          }`}
        >
          <div className="flex items-center justify-between w-full gap-2">
            <input
              type="checkbox"
              className="checkbox checkbox-xs"
              checked={banks[bankName]?.enabled || false}
              onChange={(e) => {
                e.stopPropagation();
                onBankToggleEnabled(bankName);
              }}
              onClick={(e) => e.stopPropagation()}
            />
            <span>Bank {bankName}</span>
            <kbd className="kbd kbd-xs">
              {SEQUENCER_CONSTANTS.BANK_SHORTCUTS
                ? Object.entries(SEQUENCER_CONSTANTS.BANK_SHORTCUTS).find(
                    ([, v]) => v === bankName
                  )?.[0]
                : ""}
            </kbd>
          </div>
        </button>
      ))}
    </div>
  );
});

BankSelector.displayName = "BankSelector";
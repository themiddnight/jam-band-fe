import { getDrumMachineNames } from "smplr";
import { ControlType } from "../types";

export interface DrumMachineInfo {
  value: string;
  label: string;
  controlType: ControlType;
}

// Function to get available drum machines
export const getAvailableDrumMachines = async (): Promise<DrumMachineInfo[]> => {
  try {
    const drumMachineNames = await getDrumMachineNames();
    
    return drumMachineNames.map((name: string) => {
      // All available drum machines are electronic, so use drumpad interface for all
      const controlType = ControlType.Drumpad;
      
      return {
        value: name,
        label: name,
        controlType
      };
    });
  } catch (error) {
    console.error("Error getting drum machine names:", error);
    
    // Fallback to known working machines
    return [
      { value: "TR-808", label: "Roland TR-808", controlType: ControlType.Drumpad },
      { value: "LM-2", label: "LinnDrum LM-2", controlType: ControlType.Drumpad },
      { value: "Casio-RZ1", label: "Casio RZ-1", controlType: ControlType.Drumpad },
      { value: "MFB-512", label: "Fricke MFB-512", controlType: ControlType.Drumpad },
      { value: "Roland CR-8000", label: "Roland CR-8000", controlType: ControlType.Drumpad },
    ];
  }
};

// Cache for drum machines
let cachedDrumMachines: DrumMachineInfo[] | null = null;

export const getCachedDrumMachines = async (): Promise<DrumMachineInfo[]> => {
  if (!cachedDrumMachines) {
    cachedDrumMachines = await getAvailableDrumMachines();
  }
  return cachedDrumMachines;
}; 
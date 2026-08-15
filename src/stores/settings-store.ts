import { create } from "zustand";

interface SettingsStore {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

import { create } from "zustand";

type Dialog = "summary" | "reflog" | null;

interface DialogStore {
  dialog: Dialog;
  openDialog: (d: Exclude<Dialog, null>) => void;
  closeDialog: () => void;
}

export const useDialogStore = create<DialogStore>((set) => ({
  dialog: null,
  openDialog: (d) => set({ dialog: d }),
  closeDialog: () => set({ dialog: null }),
}));

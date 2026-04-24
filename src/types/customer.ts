export type CustomerStatus =
  | "new"
  | "in_progress"
  | "done"
  | "warranty"
  | "issue";

export interface Customer {
  id: string;
  name: string;
  company?: string;
  profession?: string;
  address: string;
  lat: number;
  lng: number;
  phone?: string;
  phone2?: string;
  email?: string;
  website?: string;
  notes?: string;
  status: CustomerStatus;
  icon?: string; // klucz z palety ikon; brak = auto ze statusu
  nextAppointment?: string;
  lastVisit?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ColorThresholds {
  soon: number;   // 0-7
  upcoming: number; // 8-14
  later: number;  // 15-30
}

export const DEFAULT_THRESHOLDS: ColorThresholds = {
  soon: 7,
  upcoming: 14,
  later: 30,
};

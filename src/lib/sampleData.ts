import { addDays } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import type { Customer } from "@/types/customer";

export function buildSampleCustomers(): Customer[] {
  const now = new Date();
  const iso = (d: Date) => d.toISOString();
  const base = (over: Partial<Customer>): Customer => ({
    id: uuidv4(),
    name: "",
    address: "",
    lat: 0,
    lng: 0,
    isDone: false,
    createdAt: iso(now),
    updatedAt: iso(now),
    ...over,
  });

  return [
    base({
      name: "Jan Kowalski",
      address: "ul. Marszałkowska 10, Warszawa",
      lat: 52.2297,
      lng: 21.0122,
      phone: "+48 500 100 200",
      nextAppointment: iso(addDays(now, 5)),
      notes: "Przegląd pieca gazowego — rocznik 2019.",
      tags: ["piec", "gaz"],
    }),
    base({
      name: "Anna Nowak",
      address: "Rynek Główny 1, Kraków",
      lat: 50.0617,
      lng: 19.9373,
      phone: "+48 600 200 300",
      nextAppointment: iso(addDays(now, 12)),
      notes: "Nowy klient — instalacja klimatyzacji.",
      tags: ["klima"],
    }),
    base({
      name: "Piotr Wiśniewski",
      address: "ul. Świdnicka 4, Wrocław",
      lat: 51.1079,
      lng: 17.0385,
      phone: "+48 700 300 400",
      nextAppointment: iso(addDays(now, 25)),
      notes: "Gwarancja na pompę ciepła do 2027.",
      tags: ["pompa", "gwarancja"],
      icon: "shield",
    }),
    base({
      name: "Maria Lewandowska",
      address: "Długi Targ 20, Gdańsk",
      lat: 54.348,
      lng: 18.6531,
      phone: "+48 510 400 500",
      nextAppointment: iso(addDays(now, -2)),
      notes: "Awaria — brak ciepłej wody. Pilne!",
      tags: ["awaria"],
      icon: "alert",
    }),
    base({
      name: "Tomasz Wójcik",
      address: "Stary Rynek 1, Poznań",
      lat: 52.4082,
      lng: 16.9335,
      nextAppointment: iso(addDays(now, 1)),
      notes: "Wymiana grzejnika w salonie.",
      icon: "wrench",
    }),
    base({
      name: "Katarzyna Zielińska",
      address: "ul. Piotrkowska 100, Łódź",
      lat: 51.7592,
      lng: 19.456,
      phone: "+48 730 500 600",
      isDone: true,
      lastVisit: iso(addDays(now, -10)),
      notes: "Serwis zakończony, faktura wysłana.",
    }),
    base({
      name: "Michał Szymański",
      address: "ul. Mariacka 5, Katowice",
      lat: 50.2599,
      lng: 19.0216,
      nextAppointment: iso(addDays(now, 40)),
      notes: "Wycena instalacji fotowoltaicznej.",
      tags: ["pv"],
    }),
    base({
      name: "Agnieszka Kamińska",
      address: "Krakowskie Przedmieście 1, Lublin",
      lat: 51.2465,
      lng: 22.5684,
      phone: "+48 790 600 700",
      nextAppointment: iso(addDays(now, 9)),
      notes: "Modernizacja kotłowni.",
      tags: ["kotłownia"],
    }),
  ];
}

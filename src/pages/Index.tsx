import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { NavBar, type Tab } from "@/components/NavBar";
import { MapView } from "@/components/map/MapView";
import { CustomersList } from "@/components/CustomersList";
import { TodayView } from "@/components/TodayView";
import { NearbyView } from "@/components/NearbyView";
import { NearbyBanner } from "@/components/NearbyBanner";
import { Settings } from "@/components/Settings";
import { CustomerForm } from "@/components/CustomerForm";
import { CustomerDetail } from "@/components/CustomerDetail";
import { useCustomers } from "@/store/customers";
import { useProfiles } from "@/store/profiles";
import { ProfileSelect } from "@/components/ProfileSelect";
import { WelcomeSplash } from "@/components/WelcomeSplash";
import { useAndroidBackButton } from "@/hooks/useAndroidBackButton";
import { useT } from "@/lib/i18n";
import { useThemeEffect } from "@/hooks/useTheme";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import type { Customer } from "@/types/customer";

type SheetMode =
  | { kind: "none" }
  | { kind: "detail"; customer: Customer }
  | { kind: "edit"; customer: Customer }
  | { kind: "add"; initial?: Partial<Customer> };

const Index = () => {
  const t = useT();
  useThemeEffect();
  const isMobile = useIsMobile();
  const activeProfileId = useProfiles((s) => s.activeProfileId);
  const customers = useCustomers((s) => s.customers);

  const [tab, setTab] = useState<Tab>("map");
  const [sheet, setSheet] = useState<SheetMode>({ kind: "none" });
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [showSplash, setShowSplash] = useState(() => {
    // Splash tylko przy zimnym starcie apki. Logowanie/wylogowanie profilu
    // robi window.location.reload(), co remontuje Index – bez tej flagi splash
    // wyskakiwałby przy każdym przełączeniu profilu. sessionStorage przeżywa
    // reload w tej samej sesji WebView, ale czyści się przy starcie apki.
    try {
      return !sessionStorage.getItem("mapelo-splash-shown");
    } catch {
      return true;
    }
  });

  // Ekran powitalny – widoczny ~3 s przy starcie.
  useEffect(() => {
    if (!showSplash) return;
    try {
      sessionStorage.setItem("mapelo-splash-shown", "1");
    } catch {
      /* ignore */
    }
    const id = window.setTimeout(() => setShowSplash(false), 3000);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep detail sheet in sync with latest customer data; close if customer is deleted
  useEffect(() => {
    if (sheet.kind === "detail" || sheet.kind === "edit") {
      const fresh = customers.find((c) => c.id === sheet.customer.id);
      if (!fresh) {
        setSheet({ kind: "none" });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers]);

  // Sprzętowy „wstecz” na Androidzie: zamknij Sheet → wróć na Mapę →
  // dopiero podwójne cofnięcie wychodzi z apki.
  useAndroidBackButton({
    sheetOpen: sheet.kind !== "none",
    closeSheet: () => setSheet({ kind: "none" }),
    onMap: tab === "map",
    goToMap: () => setTab("map"),
    exitMessage: t.exitConfirm,
    notify: (msg) => toast(msg),
  });

  // Ekran powitalny ma pierwszeństwo, potem wybór profilu.
  if (showSplash) {
    return <WelcomeSplash />;
  }
  if (!activeProfileId) {
    return <ProfileSelect />;
  }

  const openDetail = (c: Customer) => {
    setFocusedId(c.id);
    setSheet({ kind: "detail", customer: c });
  };

  const openAdd = () => setSheet({ kind: "add" });
  const openAddAt = (lat: number, lng: number) =>
    setSheet({ kind: "add", initial: { lat, lng } });

  const sheetSide = isMobile ? "bottom" : "right";

  // Unique key forces remount of sheet body when mode changes (fixes edit flow)
  const sheetKey =
    sheet.kind === "detail"
      ? `detail-${sheet.customer.id}`
      : sheet.kind === "edit"
        ? `edit-${sheet.customer.id}`
        : sheet.kind === "add"
          ? `add-${sheet.initial?.lat ?? "new"}-${sheet.initial?.lng ?? "new"}`
          : "none";

  let sheetTitle = "";
  let sheetDescription = "";
  let sheetBody: JSX.Element | null = null;
  if (sheet.kind === "detail") {
    const fresh =
      customers.find((c) => c.id === sheet.customer.id) ?? sheet.customer;
    sheetTitle = fresh.name;
    sheetDescription = `Szczegóły klienta: ${fresh.address}`;
    sheetBody = (
      <CustomerDetail
        key={sheetKey}
        customer={fresh}
        onEdit={() => setSheet({ kind: "edit", customer: fresh })}
        onClose={() => setSheet({ kind: "none" })}
      />
    );
  } else if (sheet.kind === "edit") {
    const fresh =
      customers.find((c) => c.id === sheet.customer.id) ?? sheet.customer;
    sheetTitle = t.editCustomer;
    sheetDescription = "Zmien dane klienta i zapisz.";
    sheetBody = (
      <CustomerForm
        key={sheetKey}
        initial={fresh}
        editingId={fresh.id}
        onClose={() => setSheet({ kind: "none" })}
      />
    );
  } else if (sheet.kind === "add") {
    sheetTitle = t.addPin;
    sheetDescription =
      "Wypelnij formularz, aby dodac nowego klienta do mapy.";
    sheetBody = (
      <CustomerForm
        key={sheetKey}
        initial={sheet.initial}
        onClose={() => setSheet({ kind: "none" })}
      />
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      <title>Mapelo — mapa klientów dla mobilnych specjalistów</title>
      <meta
        name="description"
        content="Uniwersalna mapa klientów z kolorowymi pinami opartymi o terminy wizyt. Działa offline, dane lokalne."
      />

      {!isMobile && <NavBar active={tab} onChange={setTab} variant="top" />}

      <main
        className={`flex-1 overflow-hidden ${tab === "map" ? "" : "overflow-y-auto"} ${isMobile ? "pb-[80px]" : ""}`}
      >
        {tab === "map" && (
          <div className="relative h-full w-full">
            <MapView
              onSelectCustomer={openDetail}
              onAddAt={openAddAt}
              onAddNew={openAdd}
              selectedId={focusedId}
            />
            <NearbyBanner onOpen={() => setTab("nearby")} />
          </div>
        )}
        {tab === "customers" && (
          <CustomersList onSelectCustomer={openDetail} onAddNew={openAdd} />
        )}
        {tab === "today" && <TodayView onSelectCustomer={openDetail} />}
        {tab === "nearby" && <NearbyView onSelectCustomer={openDetail} />}
        {tab === "settings" && <Settings />}
      </main>

      {isMobile && <NavBar active={tab} onChange={setTab} variant="bottom" />}

      <Sheet
        open={sheet.kind !== "none"}
        onOpenChange={(open) => !open && setSheet({ kind: "none" })}
      >
        <SheetContent
          side={sheetSide}
          className={
            isMobile
              ? "h-[88dvh] overflow-y-auto rounded-t-2xl"
              : "w-[480px] sm:max-w-[480px] overflow-y-auto"
          }
        >
          <SheetHeader className="mb-2 text-left">
            <SheetTitle className="truncate pr-6">{sheetTitle}</SheetTitle>
            <SheetDescription className="sr-only">
              {sheetDescription}
            </SheetDescription>
          </SheetHeader>
          {sheetBody}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Index;

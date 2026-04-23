import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { NavBar, type Tab } from "@/components/NavBar";
import { MapView } from "@/components/map/MapView";
import { CustomersList } from "@/components/CustomersList";
import { TodayView } from "@/components/TodayView";
import { Settings } from "@/components/Settings";
import { CustomerForm } from "@/components/CustomerForm";
import { CustomerDetail } from "@/components/CustomerDetail";
import { useCustomers } from "@/store/customers";
import { useT } from "@/lib/i18n";
import { useThemeEffect } from "@/hooks/useTheme";
import { useIsMobile } from "@/hooks/use-mobile";
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
  const seedIfEmpty = useCustomers((s) => s.seedIfEmpty);
  const customers = useCustomers((s) => s.customers);

  const [tab, setTab] = useState<Tab>("map");
  const [sheet, setSheet] = useState<SheetMode>({ kind: "none" });
  const [focusedId, setFocusedId] = useState<string | null>(null);

  useEffect(() => {
    seedIfEmpty();
  }, [seedIfEmpty]);

  // Keep detail sheet in sync with latest customer data
  useEffect(() => {
    if (sheet.kind === "detail" || sheet.kind === "edit") {
      const fresh = customers.find((c) => c.id === sheet.customer.id);
      if (!fresh) {
        setSheet({ kind: "none" });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers]);

  const openDetail = (c: Customer) => {
    setFocusedId(c.id);
    setSheet({ kind: "detail", customer: c });
  };

  const openEdit = (c: Customer) => {
    setFocusedId(c.id);
    setSheet({ kind: "edit", customer: c });
  };

  const openAdd = () => setSheet({ kind: "add" });
  const openAddAt = (lat: number, lng: number) =>
    setSheet({ kind: "add", initial: { lat, lng } });

  const sheetSide = isMobile ? "bottom" : "right";

  let sheetTitle = "";
  let sheetBody: JSX.Element | null = null;
  if (sheet.kind === "detail") {
    sheetTitle = sheet.customer.name;
    sheetBody = (
      <CustomerDetail
        customer={customers.find((c) => c.id === sheet.customer.id) ?? sheet.customer}
        onEdit={() =>
          setSheet({
            kind: "edit",
            customer:
              customers.find((c) => c.id === sheet.customer.id) ?? sheet.customer,
          })
        }
        onClose={() => setSheet({ kind: "none" })}
      />
    );
  } else if (sheet.kind === "edit") {
    const fresh = customers.find((c) => c.id === sheet.customer.id) ?? sheet.customer;
    sheetTitle = t.editCustomer;
    sheetBody = (
      <CustomerForm
        initial={fresh}
        editingId={fresh.id}
        onClose={() => setSheet({ kind: "none" })}
      />
    );
  } else if (sheet.kind === "add") {
    sheetTitle = t.addCustomer;
    sheetBody = (
      <CustomerForm
        initial={sheet.initial}
        onClose={() => setSheet({ kind: "none" })}
      />
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      <title>SerwisMap — mapa klientów dla mobilnych specjalistów</title>
      <meta
        name="description"
        content="Uniwersalna mapa klientów z kolorowymi pinami opartymi o terminy wizyt. Działa offline, dane lokalne."
      />

      {!isMobile && <NavBar active={tab} onChange={setTab} variant="top" />}

      <main
        className={`flex-1 overflow-hidden ${tab === "map" ? "" : "overflow-y-auto"} ${isMobile ? "pb-[64px]" : ""}`}
      >
        {tab === "map" && (
          <MapView
            onSelectCustomer={openDetail}
            onEditCustomer={openEdit}
            onAddAt={openAddAt}
            onAddNew={openAdd}
            selectedId={focusedId}
          />
        )}
        {tab === "customers" && (
          <CustomersList onSelectCustomer={openDetail} onAddNew={openAdd} />
        )}
        {tab === "today" && <TodayView onSelectCustomer={openDetail} />}
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
          </SheetHeader>
          {sheetBody}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Index;

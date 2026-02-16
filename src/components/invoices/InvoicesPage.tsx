import { useState } from "react";
import InvoiceList from "./InvoiceList";
import InvoiceCreate from "./InvoiceCreate";
import InvoicePreview from "./InvoicePreview";

type View = "list" | "create" | "preview";

const InvoicesPage = () => {
  const [view, setView] = useState<View>("list");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  return (
    <>
      {view === "list" && (
        <InvoiceList
          onCreateNew={() => setView("create")}
          onViewInvoice={(id) => {
            setSelectedInvoiceId(id);
            setView("preview");
          }}
        />
      )}
      {view === "create" && (
        <InvoiceCreate
          onBack={() => setView("list")}
          onSaved={(id) => {
            setSelectedInvoiceId(id);
            setView("preview");
          }}
        />
      )}
      {view === "preview" && (
        <InvoicePreview
          invoiceId={selectedInvoiceId}
          onBack={() => setView("list")}
        />
      )}
    </>
  );
};

export default InvoicesPage;

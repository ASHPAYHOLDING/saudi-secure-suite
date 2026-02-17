import { useState } from "react";
import CreditNoteList from "./CreditNoteList";
import CreditNoteCreate from "./CreditNoteCreate";

type View = "list" | "create";

const CreditNotesPage = () => {
  const [view, setView] = useState<View>("list");
  const [linkedInvoiceId, setLinkedInvoiceId] = useState<string | null>(null);

  return (
    <>
      {view === "list" && (
        <CreditNoteList
          onCreateNew={(invoiceId) => { setLinkedInvoiceId(invoiceId || null); setView("create"); }}
        />
      )}
      {view === "create" && (
        <CreditNoteCreate
          linkedInvoiceId={linkedInvoiceId}
          onBack={() => setView("list")}
          onSaved={() => setView("list")}
        />
      )}
    </>
  );
};

export default CreditNotesPage;

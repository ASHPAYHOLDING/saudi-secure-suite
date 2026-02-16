import { useState } from "react";
import QuotationList from "./QuotationList";
import QuotationCreate from "./QuotationCreate";
import QuotationPreview from "./QuotationPreview";

type View = "list" | "create" | "edit" | "preview";

const QuotationsPage = () => {
  const [view, setView] = useState<View>("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <>
      {view === "list" && (
        <QuotationList
          onCreateNew={() => setView("create")}
          onView={(id) => { setSelectedId(id); setView("preview"); }}
          onEdit={(id) => { setSelectedId(id); setView("edit"); }}
        />
      )}
      {(view === "create" || view === "edit") && (
        <QuotationCreate
          editId={view === "edit" ? selectedId : null}
          onBack={() => setView("list")}
          onSaved={(id) => { setSelectedId(id); setView("preview"); }}
        />
      )}
      {view === "preview" && (
        <QuotationPreview
          quotationId={selectedId}
          onBack={() => setView("list")}
          onConvertedToInvoice={() => setView("list")}
        />
      )}
    </>
  );
};

export default QuotationsPage;

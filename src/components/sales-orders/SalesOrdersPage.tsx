import { useState } from "react";
import SalesOrderList from "./SalesOrderList";
import SalesOrderCreate from "./SalesOrderCreate";
import SalesOrderPreview from "./SalesOrderPreview";

type View = "list" | "create" | "edit" | "preview";

const SalesOrdersPage = () => {
  const [view, setView] = useState<View>("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fromQuotationId, setFromQuotationId] = useState<string | null>(null);

  return (
    <>
      {view === "list" && (
        <SalesOrderList
          onCreateNew={() => { setFromQuotationId(null); setView("create"); }}
          onCreateFromQuotation={(qId) => { setFromQuotationId(qId); setView("create"); }}
          onView={(id) => { setSelectedId(id); setView("preview"); }}
          onEdit={(id) => { setSelectedId(id); setView("edit"); }}
        />
      )}
      {(view === "create" || view === "edit") && (
        <SalesOrderCreate
          editId={view === "edit" ? selectedId : null}
          fromQuotationId={fromQuotationId}
          onBack={() => setView("list")}
          onSaved={(id) => { setSelectedId(id); setView("preview"); }}
        />
      )}
      {view === "preview" && (
        <SalesOrderPreview
          orderId={selectedId}
          onBack={() => setView("list")}
          onConvertedToInvoice={() => setView("list")}
        />
      )}
    </>
  );
};

export default SalesOrdersPage;

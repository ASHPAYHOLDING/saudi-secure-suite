import { useState } from "react";
import PurchaseOrderList from "./PurchaseOrderList";
import PurchaseOrderCreate from "./PurchaseOrderCreate";
import PurchaseOrderPreview from "./PurchaseOrderPreview";

type View = "list" | "create" | "edit" | "preview";

const PurchaseOrdersPage = () => {
  const [view, setView] = useState<View>("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <>
      {view === "list" && (
        <PurchaseOrderList
          onCreateNew={() => setView("create")}
          onView={(id) => { setSelectedId(id); setView("preview"); }}
          onEdit={(id) => { setSelectedId(id); setView("edit"); }}
        />
      )}
      {(view === "create" || view === "edit") && (
        <PurchaseOrderCreate
          editId={view === "edit" ? selectedId : null}
          onBack={() => setView("list")}
          onSaved={(id) => { setSelectedId(id); setView("preview"); }}
        />
      )}
      {view === "preview" && (
        <PurchaseOrderPreview
          orderId={selectedId}
          onBack={() => setView("list")}
        />
      )}
    </>
  );
};

export default PurchaseOrdersPage;

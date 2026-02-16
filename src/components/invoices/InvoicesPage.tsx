import { useState } from "react";
import InvoiceList from "./InvoiceList";
import InvoiceCreate from "./InvoiceCreate";
import InvoicePreview from "./InvoicePreview";
import OcrInvoiceUpload from "./OcrInvoiceUpload";
import InvoiceTemplateManager from "./InvoiceTemplateManager";

type View = "list" | "create" | "preview" | "ocr" | "templates";

const InvoicesPage = () => {
  const [view, setView] = useState<View>("list");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  return (
    <>
      {view === "list" && (
        <InvoiceList
          onCreateNew={() => setView("create")}
          onOcrImport={() => setView("ocr")}
          onManageTemplates={() => setView("templates")}
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
      {view === "ocr" && (
        <OcrInvoiceUpload
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
      {view === "templates" && (
        <InvoiceTemplateManager onBack={() => setView("list")} />
      )}
    </>
  );
};

export default InvoicesPage;

import { useState } from "react";
import ContractList from "./ContractList";
import ContractCreate from "./ContractCreate";
import ContractPreview from "./ContractPreview";

type View = "list" | "create" | "preview";

const ContractsPage = () => {
  const [view, setView] = useState<View>("list");
  const [previewHtml, setPreviewHtml] = useState<string | undefined>();

  return (
    <>
      {view === "list" && (
        <ContractList
          onCreateNew={() => setView("create")}
          onViewContract={() => {
            setPreviewHtml(undefined);
            setView("preview");
          }}
        />
      )}
      {view === "create" && (
        <ContractCreate
          onBack={() => setView("list")}
          onPreview={(html) => {
            setPreviewHtml(html);
            setView("preview");
          }}
        />
      )}
      {view === "preview" && (
        <ContractPreview
          onBack={() => setView("list")}
          bodyHtml={previewHtml}
        />
      )}
    </>
  );
};

export default ContractsPage;

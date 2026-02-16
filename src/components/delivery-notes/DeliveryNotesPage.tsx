import { useState } from "react";
import DeliveryNoteList from "./DeliveryNoteList";
import DeliveryNoteCreate from "./DeliveryNoteCreate";
import DeliveryNotePreview from "./DeliveryNotePreview";

type View = "list" | "create" | "preview";

const DeliveryNotesPage = () => {
  const [view, setView] = useState<View>("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sourceData, setSourceData] = useState<{ sourceType: string; sourceId: string } | null>(null);

  return (
    <>
      {view === "list" && (
        <DeliveryNoteList
          onCreateNew={() => { setSourceData(null); setView("create"); }}
          onView={(id) => { setSelectedId(id); setView("preview"); }}
        />
      )}
      {view === "create" && (
        <DeliveryNoteCreate
          sourceType={sourceData?.sourceType}
          sourceId={sourceData?.sourceId}
          onBack={() => setView("list")}
          onSaved={(id) => { setSelectedId(id); setView("preview"); }}
        />
      )}
      {view === "preview" && (
        <DeliveryNotePreview
          noteId={selectedId}
          onBack={() => setView("list")}
        />
      )}
    </>
  );
};

export default DeliveryNotesPage;

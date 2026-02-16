import { useState } from "react";
import ExpenseList from "./ExpenseList";
import ExpenseCreate from "./ExpenseCreate";
import ExpensePreview from "./ExpensePreview";

type View = "list" | "create" | "edit" | "preview";

const ExpensesPage = () => {
  const [view, setView] = useState<View>("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <>
      {view === "list" && (
        <ExpenseList
          onCreateNew={() => { setSelectedId(null); setView("create"); }}
          onView={(id) => { setSelectedId(id); setView("preview"); }}
          onEdit={(id) => { setSelectedId(id); setView("edit"); }}
        />
      )}
      {(view === "create" || view === "edit") && (
        <ExpenseCreate
          editId={view === "edit" ? selectedId : null}
          onBack={() => setView("list")}
          onSaved={(id) => { setSelectedId(id); setView("preview"); }}
        />
      )}
      {view === "preview" && (
        <ExpensePreview
          expenseId={selectedId}
          onBack={() => setView("list")}
          onEdit={(id) => { setSelectedId(id); setView("edit"); }}
        />
      )}
    </>
  );
};

export default ExpensesPage;

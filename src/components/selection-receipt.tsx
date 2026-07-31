import Link from "next/link";

type SelectionReceiptProps = {
  detailHref?: string;
  heading: string;
  items: string[];
  savedItems: string[];
  selectionLimit?: number;
};

export default function SelectionReceipt({ detailHref = "/#my-ticket", heading, items, savedItems, selectionLimit }: SelectionReceiptProps) {
  const hasUnsavedChanges = items.join("|") !== savedItems.join("|");
  const countLabel = selectionLimit ? `${items.length}/${selectionLimit}` : items.length ? "1/1" : "0/1";
  const status = hasUnsavedChanges ? "UNSAVED CHANGE" : items.length ? "SAVED" : "OPEN";

  return <section aria-label={`${heading} receipt`} className={`selection-receipt ${hasUnsavedChanges ? "is-unsaved" : ""}`}>
    <div className="selection-receipt-heading"><span>{heading}</span><strong>{status}</strong></div>
    <div className="selection-receipt-body"><div className="selection-receipt-items">{items.length ? items.map((item, index) => <span className="selection-receipt-item" key={`${item}-${index}`}>{selectionLimit ? `${index + 1}. ` : ""}{item}</span>) : <span className="selection-receipt-empty">No selection entered yet.</span>}</div><span className="selection-receipt-count">{countLabel} SELECTIONS</span><Link className="selection-receipt-link" href={detailHref}>VIEW YOUR TICKET <span aria-hidden="true">→</span></Link></div>
    {hasUnsavedChanges ? <p className="selection-receipt-note">Your receipt will update when you save this change.</p> : null}
  </section>;
}

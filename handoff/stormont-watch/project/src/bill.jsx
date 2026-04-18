// bill.jsx — BillDetail is defined in bills.jsx, re-expose
// (kept as separate file so html script loader is stable)
if (typeof window.BillDetail === 'undefined') {
  window.BillDetail = function() { return <div>Loading bill…</div>; };
}
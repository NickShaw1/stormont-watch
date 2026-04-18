const { EXPENSES_TOP, ALL_MLAS, PARTIES } = window.SW;
const { partyAbbr, partyColor } = window.SW_UI;

function ExpensesPage({ goto }) {
  const max = Math.max(...EXPENSES_TOP.map(r => r.total));
  const partyTotals = {};
  EXPENSES_TOP.forEach(r => { partyTotals[r.party] = (partyTotals[r.party] || 0) + r.total; });

  return (
    <div className="container" style={{paddingBottom: 80}}>
      <header className="page-header">
        <span className="eyebrow">Public accounts</span>
        <h1>Members' Expenses</h1>
        <p className="lede">Every pound claimed by every MLA — office costs, travel, constituency support, and staff salaries. Published quarterly by the Assembly Commission, made searchable here.</p>
        <div className="meta-bar">
          <span><span className="k">Financial year</span><span className="v">2025/26</span></span>
          <span><span className="k">Total</span><span className="v">£12.4m</span></span>
          <span><span className="k">Records</span><span className="v">4,982</span></span>
          <span><span className="k">Last updated</span><span className="v">10 Apr 2026</span></span>
        </div>
      </header>

      <div className="filters">
        <div className="segments">
          <button className="active">Top spenders</button>
          <button>By party</button>
          <button>By category</button>
          <button>Outliers</button>
        </div>
        <div style={{flex:1}}/>
        <div className="chip">Year · 2025/26 ▾</div>
        <div className="chip">Download CSV ↓</div>
      </div>

      <div className="card" style={{padding: 0, marginTop: 16, overflow:'hidden'}}>
        <div className="exp-row head">
          <span>#</span>
          <span></span>
          <span>Member</span>
          <span>Party</span>
          <span>Claim share</span>
          <span style={{textAlign:'right'}}>Total</span>
        </div>
        {EXPENSES_TOP.map((r, i) => {
          const mla = ALL_MLAS.find(m => m.id === r.id);
          return (
            <div key={r.id} className="exp-row" onClick={()=>goto('mla')} style={{cursor:'pointer'}}>
              <span className="rank">{String(i+1).padStart(2,'0')}</span>
              <div className="photo">{mla && <img src={mla.img} alt="" onError={(e)=>{e.target.style.visibility='hidden';}}/>}</div>
              <span className="name">{r.name}</span>
              <span className="party"><span className="party-dot" style={{background: partyColor(r.party), marginRight: 6}}/>{partyAbbr(r.party)}</span>
              <div className="track"><i style={{width: (r.total / max * 100) + '%'}}/></div>
              <span className="amt">£{r.total.toLocaleString()}</span>
            </div>
          );
        })}
      </div>

      <section style={{marginTop: 64}}>
        <div className="section-head">
          <div>
            <span className="eyebrow">By category</span>
            <h2>Where the money goes</h2>
          </div>
        </div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 0, border:'1px solid var(--rule)', borderRadius: 10, overflow:'hidden'}}>
          {[
            {cat:'Staff salaries', amt:'£7.2m', pct: 58},
            {cat:'Office costs', amt:'£2.1m', pct: 17},
            {cat:'Constituency', amt:'£1.6m', pct: 13},
            {cat:'Travel & subs.', amt:'£1.5m', pct: 12},
          ].map(c => (
            <div key={c.cat} style={{padding: 24, borderRight:'1px solid var(--rule)'}}>
              <div style={{fontSize:11, textTransform:'uppercase', letterSpacing:'0.12em', color:'var(--ink-3)'}}>{c.cat}</div>
              <div className="stat-num" style={{fontSize: 42, marginTop: 4}}>{c.amt}</div>
              <div style={{fontSize: 12, color:'var(--ink-3)', fontFamily:'var(--font-mono)', marginTop: 6}}>{c.pct}% OF TOTAL</div>
              <div style={{marginTop: 12, height: 4, background:'var(--paper-3)', borderRadius: 2, overflow:'hidden'}}>
                <div style={{width: c.pct + '%', height:'100%', background:'var(--teal)'}}/>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
window.ExpensesPage = ExpensesPage;
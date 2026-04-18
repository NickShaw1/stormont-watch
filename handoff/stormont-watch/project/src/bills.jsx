const { BILLS, STAGES, DIVISIONS } = window.SW;

function BillsPage({ goto }) {
  const [tab, setTab] = React.useState('all');
  const filters = {
    all: BILLS,
    progress: BILLS.filter(b => b.status === 'in-progress'),
    completed: BILLS.filter(b => b.status === 'completed'),
    scheduled: BILLS.filter(b => b.status === 'scheduled'),
  };
  const list = filters[tab];

  return (
    <div className="container" style={{paddingBottom: 80}}>
      <header className="page-header">
        <span className="eyebrow">Legislation</span>
        <h1>Bills before the Assembly</h1>
        <p className="lede">Every public bill introduced in the current mandate — Executive, Private Member and Committee — tracked through each stage from First Reading to Royal Assent.</p>
        <div className="meta-bar">
          <span><span className="k">Total bills</span><span className="v">{BILLS.length}</span></span>
          <span><span className="k">In progress</span><span className="v">{filters.progress.length}</span></span>
          <span><span className="k">Completed</span><span className="v">{filters.completed.length}</span></span>
          <span><span className="k">Pass rate · mandate</span><span className="v">76%</span></span>
        </div>
      </header>

      <div className="bill-tabs">
        {[['all','All'],['progress','In progress'],['completed','Completed'],['scheduled','Scheduled']].map(([k,l]) => (
          <button key={k} className={tab===k?'active':''} onClick={()=>setTab(k)}>{l}<span className="n">{filters[k].length}</span></button>
        ))}
        <div style={{flex:1}}/>
        <div className="chip" style={{alignSelf:'flex-end'}}>Sort · Most recent ▾</div>
      </div>

      <div>
        {list.map(b => {
          const progress = (b.stageIdx / (STAGES.length - 1)) * 100;
          return (
            <article key={b.id} className="bill-row" style={{gridTemplateColumns:'80px 1fr auto', padding:'24px 0', cursor:'pointer'}} onClick={()=>goto('bill')}>
              <div className="num" style={{fontFamily:'var(--font-mono)'}}>
                <strong style={{fontSize:16}}>{b.num.split('/')[0]}</strong>
                <div style={{fontSize:10, color:'var(--ink-3)'}}>{b.num.split('/').slice(1).join('/')}</div>
                <div style={{fontSize:10, color:'var(--ink-3)', marginTop:4}}>{b.type.toUpperCase()}</div>
              </div>
              <div>
                <div className="title" style={{fontSize: 19, fontFamily:'var(--font-serif)', fontWeight: 400, letterSpacing:'-0.01em'}}>{b.title}</div>
                <div className="stage" style={{fontSize: 12, color:'var(--ink-3)', marginTop: 4, fontFamily:'var(--font-mono)', letterSpacing:'0.03em'}}>CURRENT STAGE · {b.stage} · {new Date(b.date).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}</div>
                <div style={{marginTop: 12, display:'flex', gap: 2, height: 6, borderRadius: 3, overflow:'hidden', background:'var(--paper-3)'}}>
                  {STAGES.map((s, i) => (
                    <div key={s} style={{flex:1, background: i < b.stageIdx ? 'var(--forest)' : i === b.stageIdx ? 'var(--teal)' : 'transparent'}}/>
                  ))}
                </div>
                <div style={{marginTop: 6, display:'flex', justifyContent:'space-between', fontSize:10, fontFamily:'var(--font-mono)', color:'var(--ink-3)', letterSpacing:'0.04em'}}>
                  <span>INTRO</span><span>ROYAL ASSENT</span>
                </div>
              </div>
              <div style={{textAlign:'right', display:'flex', flexDirection:'column', gap: 6, alignItems:'flex-end'}}>
                <span className={`pill ${b.status==='completed' ? (b.passed?'pass':'fail') : b.status==='scheduled' ? 'accent' : 'neutral'}`}>
                  {b.status === 'completed' ? (b.passed ? 'Passed' : 'Failed') : b.status === 'scheduled' ? 'Scheduled' : 'Active'}
                </span>
                <div style={{fontSize:11, color:'var(--ink-3)', fontFamily:'var(--font-mono)'}}>{Math.round(progress)}% complete</div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
window.BillsPage = BillsPage;

function BillDetail({ goto }) {
  const b = BILLS[0]; // Mental Capacity bill
  return (
    <div className="container" style={{paddingBottom: 80}}>
      <nav style={{fontSize:12, color:'var(--ink-3)', marginTop: 32, marginBottom: 20, fontFamily:'var(--font-mono)', letterSpacing:'0.05em'}}>
        <a href="#" onClick={(e)=>{e.preventDefault(); goto('bills');}} style={{color:'var(--ink-3)'}}>LEGISLATION</a> › <span style={{color:'var(--ink)'}}>{b.num}</span>
      </nav>
      <header style={{paddingBottom: 32, borderBottom: '1px solid var(--rule)', marginBottom: 40}}>
        <div style={{display:'flex', gap: 10, alignItems:'center', marginBottom: 16}}>
          <span className="tag" style={{fontFamily:'var(--font-mono)'}}>BILL {b.num}</span>
          <span className="tag">{b.type}</span>
          <span className="pill accent">{b.stage}</span>
        </div>
        <h1 style={{fontFamily:'var(--font-serif)', fontWeight: 400, fontSize: 'clamp(36px, 5vw, 60px)', letterSpacing:'-0.025em', lineHeight: 1, maxWidth:'22ch'}}>{b.title}</h1>
        <p className="lede" style={{fontSize: 18, color:'var(--ink-2)', maxWidth:'60ch', marginTop: 16, lineHeight: 1.55}}>
          A Bill to amend the Mental Capacity Act (Northern Ireland) 2016; to make provision about deprivation of liberty safeguards; and for connected purposes.
        </p>
      </header>

      <section style={{marginBottom: 48}}>
        <h3 className="serif" style={{fontSize: 24, marginBottom: 16}}>Progress</h3>
        <div className="stages">
          {STAGES.map((s, i) => (
            <div key={s} className={`stage ${i < b.stageIdx ? 'done' : i === b.stageIdx ? 'current' : ''}`}>
              {s}
              <span className="d">{i < b.stageIdx ? ['4 Feb', '18 Feb', '3 Mar', '17 Mar'][i] || '—' : i === b.stageIdx ? 'Now' : '—'}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="twocol" style={{gap: 48}}>
        <section>
          <h3 className="serif" style={{fontSize: 24, marginBottom: 12}}>Summary</h3>
          <div className="prose">
            <p>The Bill updates the 2016 Act to bring Northern Ireland law into line with recent European jurisprudence on the deprivation of liberty in care settings.</p>
            <p>Key provisions include a new streamlined authorisation process for hospitals and supported-living arrangements, independent advocacy rights for patients lacking capacity, and revised Tribunal powers of review.</p>
            <p><a href="#">Read the official summary →</a></p>
          </div>

          <h3 className="serif" style={{fontSize: 24, marginTop: 40, marginBottom: 12}}>Sponsor</h3>
          <div className="dept-grid" style={{gridTemplateColumns:'1fr'}}>
            <div className="dept-item" style={{borderRight:0, borderBottom:0}}>
              <div className="photo" style={{background:'var(--paper-3)', display:'grid', placeItems:'center', color:'var(--ink-3)', fontFamily:'var(--font-mono)', fontSize:11}}>DoH</div>
              <div>
                <div className="dept">Minister of Health</div>
                <h5>Mike Nesbitt MLA</h5>
                <div className="party">Ulster Unionist Party · Strangford</div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h3 className="serif" style={{fontSize: 24, marginBottom: 12}}>Recent activity</h3>
          <div>
            {[
              { date:'14 Apr 2026', title:'Referred to Committee for Health', sub:'Committee stage begins; written evidence open until 30 May.' },
              { date:'2 Apr 2026', title:'Second Stage debate concluded', sub:'Agreed without division after 3h 14m debate.' },
              { date:'18 Mar 2026', title:'Introduced to the Assembly', sub:'Read the first time; printed and ordered to be read a second time.' },
            ].map((e, i) => (
              <div key={i} style={{display:'grid', gridTemplateColumns:'90px 1fr', gap: 16, padding:'16px 0', borderTop:'1px solid var(--rule)'}}>
                <div style={{fontFamily:'var(--font-mono)', fontSize: 11, color:'var(--ink-3)', letterSpacing:'0.04em'}}>{e.date}</div>
                <div>
                  <div style={{fontWeight: 500, fontSize: 15}}>{e.title}</div>
                  <div style={{fontSize: 13, color:'var(--ink-3)', marginTop: 2}}>{e.sub}</div>
                </div>
              </div>
            ))}
          </div>

          <h3 className="serif" style={{fontSize: 24, marginTop: 40, marginBottom: 12}}>Division history</h3>
          {DIVISIONS.slice(1, 3).map(d => (
            <div key={d.id} className="div-row" onClick={()=>goto('vote')} style={{cursor:'pointer'}}>
              <div className="date"><strong>{new Date(d.date).toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}</strong></div>
              <div><div className="title">{d.title}</div><div className="sub">{d.sub}</div></div>
              <div style={{textAlign:'right'}}>
                <div style={{fontFamily:'var(--font-mono)', fontSize:12}}><span style={{color:'var(--forest)'}}>{d.ay}</span> · <span style={{color:'var(--crimson)'}}>{d.na}</span> · {d.ab}</div>
                <span className={`pill ${d.passed?'pass':'fail'}`}>{d.passed?'Passed':'Rejected'}</span>
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
window.BillDetail = BillDetail;
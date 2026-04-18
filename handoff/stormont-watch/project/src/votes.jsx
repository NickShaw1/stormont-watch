const { DIVISIONS, ALL_MLAS, PARTIES } = window.SW;
const { partyColor, partyAbbr, partyPillStyle } = window.SW_UI;

function VotesPage({ goto }) {
  const [filter, setFilter] = React.useState('all');
  return (
    <div className="container" style={{paddingBottom: 80}}>
      <header className="page-header">
        <span className="eyebrow">The vote record</span>
        <h1>Divisions</h1>
        <p className="lede">Every recorded division in the Assembly since May 2022 — including cross-community votes, opposition motions, and bill stages. Click any division to see the full roll-call.</p>
        <div className="meta-bar">
          <span><span className="k">Total</span><span className="v">412</span></span>
          <span><span className="k">2026</span><span className="v">87</span></span>
          <span><span className="k">Cross-community</span><span className="v">24</span></span>
          <span><span className="k">Overturned</span><span className="v">2</span></span>
        </div>
      </header>

      <div className="filters">
        <div className="segments">
          {[['all','All'],['passed','Passed'],['rejected','Rejected'],['xc','Cross-community']].map(([k,l]) => (
            <button key={k} className={filter===k?'active':''} onClick={()=>setFilter(k)}>{l}</button>
          ))}
        </div>
        <div style={{flex: 1}}/>
        <div className="chip">Sort · Most recent ▾</div>
        <div className="chip">Download CSV ↓</div>
      </div>

      <div style={{marginTop: 16}}>
        {DIVISIONS.map(d => (
          <article key={d.id} className="div-row" onClick={()=>goto('vote')} style={{gridTemplateColumns:'88px 1fr 240px auto', padding:'20px 0', cursor:'pointer'}}>
            <div className="date">
              <strong style={{fontSize: 20, fontFamily:'var(--font-serif)', fontWeight: 400}}>{new Date(d.date).getDate()}</strong>
              <div style={{color:'var(--ink-3)'}}>{new Date(d.date).toLocaleString('en',{month:'short'})} · {new Date(d.date).getFullYear()}</div>
            </div>
            <div>
              <div className="title" style={{fontSize: 17, fontFamily:'var(--font-serif)', fontWeight: 400, letterSpacing:'-0.01em'}}>{d.title}</div>
              <div className="sub" style={{marginTop: 4}}>
                {d.sub}
                {d.type === 'cross-community' && <span className="tag" style={{marginLeft:8, color:'var(--ochre)', borderColor:'var(--ochre)'}}>Cross-community</span>}
              </div>
            </div>
            <div style={{paddingRight: 12}}>
              <div style={{display:'flex', height: 8, borderRadius: 2, overflow:'hidden'}}>
                <div style={{flex: d.ay, background:'var(--forest)'}}/>
                <div style={{flex: d.na, background:'var(--crimson)'}}/>
                <div style={{flex: d.ab, background:'var(--ink-4)'}}/>
              </div>
              <div style={{marginTop: 6, display:'flex', gap: 12, fontSize:11, fontFamily:'var(--font-mono)', color:'var(--ink-3)', letterSpacing:'0.04em'}}>
                <span style={{color:'var(--forest)'}}>AYE {d.ay}</span>
                <span style={{color:'var(--crimson)'}}>NO {d.na}</span>
                <span>AB {d.ab}</span>
              </div>
            </div>
            <span className={`pill ${d.passed?'pass':'fail'}`} style={{alignSelf:'center'}}>{d.passed?'Passed':'Rejected'}</span>
          </article>
        ))}
      </div>
    </div>
  );
}
window.VotesPage = VotesPage;

function VoteDetail({ goto }) {
  const d = DIVISIONS[0]; // Programme for Government
  // Synthesize MLA votes — distribute party lines
  const votes = ALL_MLAS.map((m, i) => {
    const partyFor = { 'Sinn Féin': 'ay', 'SDLP': 'ay', 'Alliance': 'ay', 'DUP': 'na', 'UUP': 'ay', 'TUV': 'na', 'PBP': 'ab', 'Independent': 'ay' }[m.party] || 'ay';
    // add slight rebellion
    const v = (i % 31 === 0) ? 'ab' : partyFor;
    return { ...m, vote: v };
  });
  const byVote = { ay: votes.filter(v => v.vote==='ay'), na: votes.filter(v => v.vote==='na'), ab: votes.filter(v => v.vote==='ab') };

  return (
    <div className="container" style={{paddingBottom: 80}}>
      <nav style={{fontSize:12, color:'var(--ink-3)', marginTop: 32, marginBottom: 20, fontFamily:'var(--font-mono)', letterSpacing:'0.05em'}}>
        <a href="#" onClick={(e)=>{e.preventDefault(); goto('votes');}} style={{color:'var(--ink-3)'}}>DIVISIONS</a> › <span style={{color:'var(--ink)'}}>{d.id.toUpperCase()}</span>
      </nav>

      <header style={{paddingBottom: 32, borderBottom: '1px solid var(--rule)', marginBottom: 40}}>
        <div style={{display:'flex', gap: 10, alignItems:'center', marginBottom: 12}}>
          <span className="tag" style={{fontFamily:'var(--font-mono)'}}>DIVISION {d.id.toUpperCase()}</span>
          <span className={`pill ${d.passed?'pass':'fail'}`}>{d.passed?'Passed':'Rejected'}</span>
          <span className="tag">{new Date(d.date).toLocaleDateString('en-GB',{weekday:'long', day:'numeric', month:'long', year:'numeric'})}</span>
        </div>
        <h1 style={{fontFamily:'var(--font-serif)', fontWeight: 400, fontSize: 'clamp(32px, 4.5vw, 54px)', letterSpacing:'-0.025em', lineHeight: 1.05, maxWidth:'22ch'}}>{d.title}</h1>
      </header>

      <div className="vote-summary">
        <div>
          <div className="eyebrow">The motion</div>
          <p className="motion" style={{marginTop: 8, marginBottom: 32}}>
            "That this Assembly approves the Programme for Government 2026–2028 as laid before the Assembly on 8 April 2026, noting its emphasis on housing, the Health Service transformation, and climate action."
          </p>
          <div style={{display:'flex', gap: 24, fontSize:13, color:'var(--ink-2)'}}>
            <span><span className="k">PROPOSED BY</span><br/><b style={{color:'var(--ink)'}}>First Minister O'Neill</b></span>
            <span><span className="k">DEBATE</span><br/><b style={{color:'var(--ink)'}}>2h 51m · 24 speakers</b></span>
            <span><span className="k">AMENDMENTS</span><br/><b style={{color:'var(--ink)'}}>4 moved, 1 carried</b></span>
          </div>
        </div>

        <div className="tally-viz">
          <div className="row ay">
            <span className="lbl">Aye</span>
            <div className="bar"><i style={{width: (d.ay / 90 * 100) + '%'}}/></div>
            <span className="val">{d.ay}</span>
          </div>
          <div className="row na">
            <span className="lbl">No</span>
            <div className="bar"><i style={{width: (d.na / 90 * 100) + '%'}}/></div>
            <span className="val">{d.na}</span>
          </div>
          <div className="row ab">
            <span className="lbl">Abs</span>
            <div className="bar"><i style={{width: (d.ab / 90 * 100) + '%'}}/></div>
            <span className="val">{d.ab}</span>
          </div>
          <div className="bloc">
            <div><span>Nationalist</span><b>35 Aye · 0 No</b></div>
            <div><span>Unionist</span><b>9 Aye · 26 No</b></div>
            <div><span>Other</span><b>10 Aye · 6 No · 2 Abs</b></div>
            <div><span>Threshold</span><b>Simple majority</b></div>
          </div>
        </div>
      </div>

      {/* Roll call */}
      <section style={{marginTop: 64}}>
        <div className="section-head">
          <div>
            <span className="eyebrow">Roll call · 89 of 90 present</span>
            <h2>How they voted</h2>
          </div>
          <div style={{display:'flex', gap: 8}}>
            <div className="chip">All</div>
            <div className="chip">By party</div>
            <div className="chip">Rebels only</div>
          </div>
        </div>

        {['ay','na','ab'].map(v => {
          const label = v === 'ay' ? `Aye · ${byVote.ay.length}` : v === 'na' ? `No · ${byVote.na.length}` : `Abstain / Absent · ${byVote.ab.length}`;
          const color = v === 'ay' ? 'var(--forest)' : v === 'na' ? 'var(--crimson)' : 'var(--ink-4)';
          return (
            <div key={v} style={{marginBottom: 32}}>
              <h4 style={{fontFamily:'var(--font-serif)', fontSize: 20, fontWeight:400, marginBottom: 12, color: color}}>{label}</h4>
              <div className="rollcall">
                {byVote[v].map(m => (
                  <div key={m.id} className="rc-cell">
                    <img src={m.img} alt="" onError={(e)=>{e.target.style.visibility='hidden';}}/>
                    <div>
                      <div className="name">{m.name}</div>
                      <div className="p"><span style={{display:'inline-block', width:8, height:8, background: partyColor(m.party), marginRight: 4, borderRadius: 2, verticalAlign:'middle'}}/>{partyAbbr(m.party)} · {m.cons}</div>
                    </div>
                    <span className={`v ${v}`}>{v==='ay'?'Aye':v==='na'?'No':'Abs'}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
window.VoteDetail = VoteDetail;
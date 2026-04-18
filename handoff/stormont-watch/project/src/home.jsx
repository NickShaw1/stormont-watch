const { Sparkline, Bars, Ribbon, partyColor, partyAbbr, partyPillStyle } = window.SW_UI;
const { BILLS, DIVISIONS, ALL_MLAS, PARTIES, DIV_MONTHLY, AGREEMENT_MONTHLY, CONSTITUENCIES } = window.SW;

function KFig({ label, value, sub, accent, series }) {
  return (
    <div className="kfig">
      <div className="lbl">{label}</div>
      <div className={`num ${accent||''}`}>{value}</div>
      <div className="sub">{sub}</div>
      {series && <Sparkline values={series} stroke={accent==='pass' ? 'var(--forest)' : accent==='fail' ? 'var(--crimson)' : accent==='warn' ? 'var(--ochre)' : 'var(--teal)'} />}
    </div>
  );
}

function NiMapPlaceholder() {
  // Simple stylized map of NI constituencies — 18 regions as abstract cells
  const cons = CONSTITUENCIES;
  return (
    <svg viewBox="0 0 400 300" style={{width:'100%', height:'100%'}}>
      <defs>
        <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="var(--rule)" strokeWidth="1"/>
        </pattern>
      </defs>
      {/* Abstract NI-shaped silhouette */}
      <path d="M 60 90 Q 70 60 110 55 Q 150 40 200 50 Q 260 55 310 70 Q 350 85 345 130 Q 355 180 320 220 Q 290 250 240 255 Q 180 265 130 250 Q 85 240 65 200 Q 50 150 60 90 Z"
            fill="var(--paper)" stroke="var(--rule-strong)" strokeWidth="1.5"/>
      {/* Constituency dots */}
      {cons.map((c, i) => {
        const angle = (i / cons.length) * Math.PI * 2;
        const r = 85 + (i % 3) * 15;
        const cx = 200 + Math.cos(angle) * r;
        const cy = 150 + Math.sin(angle) * r * 0.7;
        const colors = ['var(--p-sf)', 'var(--p-dup)', 'var(--p-alliance)', 'var(--p-uup)', 'var(--p-sdlp)'];
        return (
          <g key={c}>
            <circle cx={cx} cy={cy} r="7" fill={colors[i % colors.length]} opacity="0.85"/>
            <circle cx={cx} cy={cy} r="7" fill="none" stroke="var(--paper)" strokeWidth="1.5"/>
          </g>
        );
      })}
      {/* Belfast label */}
      <circle cx="260" cy="150" r="16" fill="var(--teal)" opacity="0.15"/>
      <text x="260" y="155" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="var(--ink-2)" letterSpacing="0.05em">BELFAST</text>
    </svg>
  );
}

function Home({ goto }) {
  const recentDivs = DIVISIONS.slice(0, 5);
  const recentBills = BILLS.slice(0, 5);
  const watched = ALL_MLAS.slice(0, 4);
  return (
    <div>
      <Ribbon />
      <main className="container" style={{paddingBlock: '28px 80px'}}>
        {/* HERO */}
        <section className="hero">
          <img src="assets/stormont.jpg" alt="Parliament Buildings, Stormont"/>
          <div className="hero-overlay" />
          <div className="hero-inner">
            <div className="hero-top">
              <div>
                <span className="eyebrow">Mandate 2022 — 2027 · Day 1,431</span>
              </div>
              <div style={{display:'flex', gap: 12, color:'oklch(88% 0.02 190)', fontSize: 11, fontFamily:'var(--font-mono)', letterSpacing:'0.1em'}}>
                <span>LIVE · SITTING</span>
              </div>
            </div>
            <div>
              <h1>Every vote. Every bill. <em>On record.</em></h1>
              <p className="hero-sub">Independent, plain-language tracking of the Northern Ireland Assembly. Browse 90 MLAs, live legislation, committee votes and Executive decisions — all from the public record, updated daily.</p>
            </div>
            <div className="hero-bottom">
              <div style={{display:'flex', gap: 40, flexWrap:'wrap'}}>
                <div className="kstat"><span className="num">412</span><span><div className="lbl">Divisions</div><div style={{fontSize:11, fontFamily:'var(--font-mono)', marginTop:2}}>since May 2022</div></span></div>
                <div className="kstat"><span className="num">14</span><span><div className="lbl">Bills active</div><div style={{fontSize:11, fontFamily:'var(--font-mono)', marginTop:2}}>in progress</div></span></div>
                <div className="kstat"><span className="num">91.4<span style={{fontSize:22, color:'var(--ochre)'}}>%</span></span><span><div className="lbl">Attendance</div><div style={{fontSize:11, fontFamily:'var(--font-mono)', marginTop:2}}>2026 avg.</div></span></div>
              </div>
              <div style={{display:'flex', gap: 8}}>
                <button className="btn" style={{background:'var(--paper)', color:'var(--ink)'}} onClick={()=>goto('votes')}>Browse all votes →</button>
              </div>
            </div>
          </div>
          <div className="credit">PHOTO · PARLIAMENT BUILDINGS</div>
        </section>

        {/* KEY FIGURES STRIP */}
        <div className="kfigs">
          <KFig label="Divisions this month" value="14" sub="↑ 3 vs. March" series={DIV_MONTHLY.slice(-12)} />
          <KFig label="Cross-community votes" value="3" sub="of 14 this month" accent="warn" series={[2,1,0,3,2,4,2,1,3,2,1,3]} />
          <KFig label="Bills at Royal Assent" value="7" sub="completed 2026" accent="pass" series={[1,0,2,1,3,2,4,3,5,4,6,7]} />
          <KFig label="MLAs sanctioned" value="0" sub="no sanctions on record" series={[0,0,0,0,0,0,0,0,0,0,0,0]} />
        </div>

        {/* RECENT DIVISIONS + ACTIVE BILLS */}
        <div className="twocol" style={{marginTop: 80}}>
          <section>
            <div className="section-head">
              <div>
                <span className="eyebrow">Plenary floor</span>
                <h2>Recent divisions</h2>
              </div>
              <a className="view-all" href="#" onClick={(e)=>{e.preventDefault(); goto('votes');}}>All 412 divisions →</a>
            </div>
            <div>
              {recentDivs.map(d => (
                <button key={d.id} className="div-row" onClick={()=>goto('vote')} style={{textAlign:'left', width:'100%', cursor:'pointer', background:'transparent', border:0, borderTop:'1px solid var(--rule)'}}>
                  <div className="date"><strong>{new Date(d.date).getDate()} {new Date(d.date).toLocaleString('en',{month:'short'})}</strong>{new Date(d.date).getFullYear()}</div>
                  <div>
                    <div className="title">{d.title}</div>
                    <div className="sub">{d.sub}{d.type === 'cross-community' && <span className="tag" style={{marginLeft:8, color:'var(--ochre)', borderColor:'var(--ochre)'}}>Cross-community</span>}</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div className="tally"><span className="ay">{d.ay}</span><span>·</span><span className="na">{d.na}</span><span>·</span><span>{d.ab}</span></div>
                    <span className={`pill ${d.passed?'pass':'fail'}`} style={{marginTop:6}}>{d.passed?'Passed':'Rejected'}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="section-head">
              <div>
                <span className="eyebrow">Legislation</span>
                <h2>Bills in progress</h2>
              </div>
              <a className="view-all" href="#" onClick={(e)=>{e.preventDefault(); goto('bills');}}>All bills →</a>
            </div>
            <div>
              {recentBills.map(b => (
                <button key={b.id} className="bill-row" onClick={()=>goto('bill')} style={{textAlign:'left', width:'100%', cursor:'pointer', background:'transparent', border:0, borderTop:'1px solid var(--rule)'}}>
                  <div className="num"><strong>{b.num}</strong>{b.type}</div>
                  <div>
                    <div className="title">{b.title}</div>
                    <div className="stage" style={{marginTop:3}}>{b.stage}</div>
                  </div>
                  <div className="date">{new Date(b.date).toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}</div>
                  <span className={`pill ${b.status==='completed' ? (b.passed?'pass':'fail') : 'accent'}`}>
                    {b.status === 'completed' ? (b.passed ? 'Passed' : 'Failed') : b.status === 'scheduled' ? 'Scheduled' : 'In progress'}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* THIS WEEK STRIP */}
        <section style={{marginTop: 80}}>
          <div className="section-head">
            <div>
              <span className="eyebrow">Week ending 18 April</span>
              <h2>This week at Stormont</h2>
            </div>
          </div>
          <div className="tw-strip">
            <div className="tw-cell"><div className="lbl">Sittings</div><div className="val">3</div><div className="delta up">↑ 1</div></div>
            <div className="tw-cell"><div className="lbl">Divisions</div><div className="val">6</div><div className="delta down">↓ 2</div></div>
            <div className="tw-cell"><div className="lbl">Ministerial statements</div><div className="val">4</div><div className="delta up">↑ 1</div></div>
            <div className="tw-cell"><div className="lbl">Questions tabled</div><div className="val">142</div><div className="delta up">↑ 18</div></div>
            <div className="tw-cell"><div className="lbl">Speaking time · hrs</div><div className="val">28.4</div><div className="delta down">↓ 1.2</div></div>
          </div>
        </section>

        {/* FIND YOUR MLA */}
        <section style={{marginTop: 80}}>
          <div className="section-head">
            <div>
              <span className="eyebrow">Your representatives</span>
              <h2>Find your MLA</h2>
            </div>
          </div>
          <div className="picker">
            <div className="map-wrap">
              <NiMapPlaceholder />
              <div className="legend">
                <span><i className="party-dot" style={{background:'var(--p-sf)'}}/> SF</span>
                <span><i className="party-dot" style={{background:'var(--p-dup)'}}/> DUP</span>
                <span><i className="party-dot" style={{background:'var(--p-alliance)'}}/> APNI</span>
                <span><i className="party-dot" style={{background:'var(--p-uup)'}}/> UUP</span>
                <span><i className="party-dot" style={{background:'var(--p-sdlp)'}}/> SDLP</span>
              </div>
            </div>
            <div className="search">
              <h3 style={{fontSize: 32, fontWeight: 400, letterSpacing:'-0.035em', lineHeight: 1.05}}>Enter a <em className="serif" style={{color:'var(--teal)'}}>postcode</em> or constituency.</h3>
              <p>Every postcode in Northern Ireland returns five MLAs — one Speaker's list, one per vote.</p>
              <input type="text" placeholder="BT9 5AG or 'Belfast South'"/>
              <div className="or">or</div>
              <div className="popular">
                {CONSTITUENCIES.slice(0, 8).map(c => <a href="#" key={c}>{c}</a>)}
                <a href="#" style={{color:'var(--teal)', borderColor:'var(--teal)'}}>All 18 →</a>
              </div>
            </div>
          </div>
        </section>

        {/* WATCHED MLAs */}
        <section style={{marginTop: 80}}>
          <div className="section-head">
            <div>
              <span className="eyebrow">Most viewed</span>
              <h2>MLAs this week</h2>
            </div>
            <a className="view-all" href="#" onClick={(e)=>{e.preventDefault(); goto('mlas');}}>All 90 MLAs →</a>
          </div>
          <div className="mla-grid">
            {watched.map(m => {
              const c = partyColor(m.party);
              return (
                <button key={m.id} className="mla-card" style={{'--party-c': c, textAlign:'left', cursor:'pointer'}} onClick={()=>goto('mla')}>
                  {m.role && <span className="role">{m.role.split(' ').slice(-2).join(' ')}</span>}
                  <div className="photo"><img src={m.img} alt={m.name} onError={(e)=>{e.target.style.display='none';}}/></div>
                  <div>
                    <h4>{m.name}</h4>
                    <div className="cons">{m.cons}</div>
                  </div>
                  <div className="foot">
                    <span className="att">Att. <strong>{m.att}%</strong></span>
                    <span className="party-pill" style={{...partyPillStyle(m.party), fontSize: 10, padding:'2px 7px', borderRadius: 3, fontWeight:600}}>{partyAbbr(m.party)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* FACT */}
        <section style={{marginTop: 80}}>
          <div className="factbar">
            <div className="fnum">412</div>
            <div className="ftxt">
              <div className="eyebrow" style={{marginBottom:6}}>Did you know</div>
              Since the Assembly was restored on 3 February 2024, MLAs have voted in <strong style={{color:'var(--ink)'}}>412 recorded divisions</strong> — averaging a division every 48 hours of sitting time.
            </div>
            <div className="fctrl">
              <button>‹</button>
              <button>›</button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
window.Home = Home;
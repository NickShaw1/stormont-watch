const { PARTIES, ALL_MLAS } = window.SW;
const { partyColor, partyAbbr, partyPillStyle } = window.SW_UI;

function StructurePage({ goto }) {
  const firstMin = ALL_MLAS.find(m => m.role === 'First Minister');
  const depFM = ALL_MLAS.find(m => m.role === 'Deputy First Minister');
  const ministers = ALL_MLAS.filter(m => m.role && m.role.includes('Minister') && !['First Minister', 'Deputy First Minister'].includes(m.role));

  return (
    <div className="container" style={{paddingBottom: 80}}>
      <header className="page-header">
        <span className="eyebrow">How the Assembly works</span>
        <h1>The Executive & Assembly</h1>
        <p className="lede">Northern Ireland is governed by a power-sharing Executive drawn from parties using the d'Hondt method. The Assembly holds that Executive to account through 90 MLAs across 18 constituencies.</p>
      </header>

      <section style={{marginBottom: 64}}>
        <div className="section-head">
          <div>
            <span className="eyebrow">Joint Office</span>
            <h2>First Minister & deputy First Minister</h2>
          </div>
        </div>
        <div className="exec-top">
          {[firstMin, depFM].map(m => m && (
            <div key={m.id} className="exec-card highlight" style={{'--party-c': partyColor(m.party)}}>
              <div className="photo"><img src={m.img} alt="" onError={(e)=>{e.target.style.visibility='hidden';}}/></div>
              <div>
                <div className="ministry">{m.role}</div>
                <h4>{m.name}</h4>
                <div className="role" style={{marginTop: 4}}><span className="party-pill" style={{...partyPillStyle(m.party), fontSize: 11, padding:'2px 8px', borderRadius: 3}}>{partyAbbr(m.party)}</span> · {m.cons}</div>
                <p style={{fontSize: 13, color:'var(--ink-2)', marginTop: 12, lineHeight: 1.5}}>The joint office holds equal executive authority; one cannot act without the other on cross-cutting matters.</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{marginBottom: 64}}>
        <div className="section-head">
          <div>
            <span className="eyebrow">Nine departments</span>
            <h2>The Executive</h2>
          </div>
          <div style={{fontSize: 12, color:'var(--ink-3)', fontFamily:'var(--font-mono)'}}>ALLOCATED BY D'HONDT, FEBRUARY 2024</div>
        </div>
        <div className="dept-grid">
          {ministers.map(m => (
            <button key={m.id} className="dept-item" onClick={()=>goto('mla')} style={{cursor:'pointer', textAlign:'left', background:'transparent', border:0, borderBottom:'1px solid var(--rule)', borderRight:'1px solid var(--rule)'}}>
              <div className="photo"><img src={m.img} alt="" onError={(e)=>{e.target.style.visibility='hidden';}}/></div>
              <div>
                <div className="dept">{m.role.replace('Minister of ','').replace('Minister for ','').replace(' Minister','')}</div>
                <h5>{m.name}</h5>
                <div className="party" style={{display:'flex', gap:6, alignItems:'center'}}><span className="party-dot" style={{background: partyColor(m.party)}}/>{m.party}</div>
              </div>
              <span className="ext">→</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="section-head">
          <div>
            <span className="eyebrow">The 90 seats</span>
            <h2>Party composition</h2>
          </div>
        </div>
        <div className="card" style={{padding: 32}}>
          {/* Seat rows */}
          <div style={{display:'flex', flexWrap:'wrap', gap: 3, marginBottom: 24}}>
            {Object.keys(PARTIES).flatMap(p => Array.from({length: PARTIES[p].count}).map((_, i) => (
              <span key={p+i} style={{width: 18, height: 18, borderRadius: 3, background: PARTIES[p].color}}/>
            )))}
          </div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 16}}>
            {Object.entries(PARTIES).map(([p, v]) => (
              <div key={p} style={{display:'flex', alignItems:'center', gap: 8, padding:'8px 0', borderTop:'1px solid var(--rule)'}}>
                <span style={{width: 12, height: 12, background: v.color, borderRadius: 2, flexShrink: 0}}/>
                <div style={{flex: 1, fontSize: 13}}>
                  <div style={{fontWeight: 500}}>{p}</div>
                  <div style={{fontSize: 11, color:'var(--ink-3)'}}>{v.bloc}</div>
                </div>
                <div style={{fontFamily:'var(--font-serif)', fontSize: 22, fontVariantNumeric:'tabular-nums'}}>{v.count}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
window.StructurePage = StructurePage;
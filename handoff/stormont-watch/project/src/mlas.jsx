const { partyColor, partyAbbr, partyPillStyle } = window.SW_UI;

function MlasPage({ goto }) {
  const [sort, setSort] = React.useState('party');
  const [filter, setFilter] = React.useState('all');
  const { ALL_MLAS, PARTIES, CONSTITUENCIES } = window.SW;

  const groupedByParty = {};
  ALL_MLAS.forEach(m => {
    if (!groupedByParty[m.party]) groupedByParty[m.party] = [];
    groupedByParty[m.party].push(m);
  });
  const partyOrder = Object.keys(PARTIES).filter(p => groupedByParty[p]);

  return (
    <div>
      <div className="container">
        <header className="page-header">
          <span className="eyebrow">The Assembly</span>
          <h1>All 90 MLAs</h1>
          <p className="lede">Every Member of the Legislative Assembly elected to the 2022–2027 mandate. Filter by party, search by constituency, or compare attendance and voting records.</p>
          <div className="meta-bar">
            <span><span className="k">Total</span><span className="v">90</span></span>
            <span><span className="k">Parties</span><span className="v">8</span></span>
            <span><span className="k">Constituencies</span><span className="v">18</span></span>
            <span><span className="k">Updated</span><span className="v">14:02 BST</span></span>
          </div>
        </header>

        <div className="filters">
          <div className="segments">
            <button className={sort==='party'?'active':''} onClick={()=>setSort('party')}>By party</button>
            <button className={sort==='alpha'?'active':''} onClick={()=>setSort('alpha')}>Alphabetical</button>
            <button className={sort==='constituency'?'active':''} onClick={()=>setSort('constituency')}>By constituency</button>
            <button className={sort==='attendance'?'active':''} onClick={()=>setSort('attendance')}>By attendance</button>
          </div>
          <div style={{flex: 1}}></div>
          <div className="chip" data-active={filter==='ministers'} onClick={()=>setFilter(filter==='ministers'?'all':'ministers')} style={{cursor:'pointer'}}>Ministers only</div>
          <div className="chip" data-active={filter==='women'} onClick={()=>setFilter(filter==='women'?'all':'women')} style={{cursor:'pointer'}}>Women MLAs <span className="count">34</span></div>
          <div className="chip" style={{cursor:'pointer'}}>Download CSV ↓</div>
        </div>

        {sort === 'party' ? partyOrder.map(p => (
          <div key={p} className="party-band">
            <div className="phead">
              <h3><span className="swatch" style={{background: PARTIES[p].color}}/>{p} <span className="cnt">{groupedByParty[p].length} MLA{groupedByParty[p].length>1?'s':''} · {PARTIES[p].bloc}</span></h3>
              <p>{PARTIES[p].bloc === 'Nationalist' ? 'Designates as Nationalist.' : PARTIES[p].bloc === 'Unionist' ? 'Designates as Unionist.' : 'Designates as Other.'}</p>
            </div>
            <div className="mla-grid">
              {groupedByParty[p].map(m => {
                const c = partyColor(m.party);
                return (
                  <button key={m.id} className="mla-card" style={{'--party-c': c, textAlign:'left', cursor:'pointer'}} onClick={()=>goto('mla')}>
                    {m.role && <span className="role">{m.role.includes('Minister') || m.role.includes('First') ? 'Minister' : 'Leader'}</span>}
                    <div className="photo"><img src={m.img} alt={m.name} onError={(e)=>{e.target.style.visibility='hidden';}}/></div>
                    <div>
                      <h4>{m.name}</h4>
                      <div className="cons">{m.cons}</div>
                    </div>
                    <div className="foot">
                      <span className="att">Att. <strong>{m.att}%</strong></span>
                      <span className="party-pill" style={{...partyPillStyle(m.party), fontSize:10, padding:'2px 7px', borderRadius: 3, fontWeight: 600}}>{partyAbbr(m.party)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )) : (
          <div className="mla-grid" style={{marginTop: 24}}>
            {[...ALL_MLAS].sort((a,b) => sort==='alpha' ? a.name.localeCompare(b.name) : sort==='attendance' ? b.att - a.att : a.cons.localeCompare(b.cons)).map(m => {
              const c = partyColor(m.party);
              return (
                <button key={m.id} className="mla-card" style={{'--party-c': c, textAlign:'left', cursor:'pointer'}} onClick={()=>goto('mla')}>
                  {m.role && <span className="role">{m.role.includes('Minister')?'Minister':'Leader'}</span>}
                  <div className="photo"><img src={m.img} alt={m.name} onError={(e)=>{e.target.style.visibility='hidden';}}/></div>
                  <div>
                    <h4>{m.name}</h4>
                    <div className="cons">{m.cons}</div>
                  </div>
                  <div className="foot">
                    <span className="att">Att. <strong>{m.att}%</strong></span>
                    <span className="party-pill" style={{...partyPillStyle(m.party), fontSize:10, padding:'2px 7px', borderRadius: 3, fontWeight: 600}}>{partyAbbr(m.party)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
window.MlasPage = MlasPage;
const { partyColor, partyAbbr, partyPillStyle, Sparkline, LineChart } = window.SW_UI;

function MlaProfile({ goto }) {
  const { ALL_MLAS, DIVISIONS } = window.SW;
  const m = ALL_MLAS.find(x => x.name === "Michelle O'Neill") || ALL_MLAS[0];
  const c = partyColor(m.party);
  const [tab, setTab] = React.useState('overview');
  // synthesize 180 votes
  const trail = Array.from({length: 180}, (_, i) => {
    const r = (Math.sin(i * 2.3) + Math.cos(i * 0.7)) / 2;
    return r > 0.4 ? 'ay' : r < -0.4 ? 'na' : r > -0.2 ? 'ay' : 'ab';
  });

  return (
    <div className="container" style={{paddingBlock:'48px 80px'}}>
      <nav style={{fontSize:12, color:'var(--ink-3)', marginBottom: 20, fontFamily:'var(--font-mono)', letterSpacing:'0.05em'}}>
        <a href="#" onClick={(e)=>{e.preventDefault(); goto('mlas');}} style={{color:'var(--ink-3)'}}>MLAs</a> ›  <a href="#" onClick={(e)=>{e.preventDefault(); goto('mlas');}} style={{color:'var(--ink-3)'}}>{m.party}</a> › <span style={{color:'var(--ink)'}}>{m.name}</span>
      </nav>

      <section className="mla-hero">
        <div className="photo"><img src={m.img} alt={m.name} onError={(e)=>{e.target.style.visibility='hidden';}}/></div>
        <div>
          <span className="eyebrow" style={{color: c}}>{m.role || 'Member of the Legislative Assembly'}</span>
          <h1 style={{marginTop: 8}}>{m.name}</h1>
          <div className="role-line">
            <span className="party-pill" style={partyPillStyle(m.party)}>{m.party}</span>
            <span>·</span>
            <span>{m.cons}</span>
            <span>·</span>
            <span>Elected 5 May 2022</span>
            <span>·</span>
            <span>Re-elected 2 Feb 2024</span>
          </div>
          <p className="blurb">First elected in 2007, {m.name.split(' ')[0]} leads {m.party} in the Assembly and serves as First Minister of Northern Ireland since the restoration of devolved government in February 2024.</p>
        </div>
        <div className="actions">
          <button className="btn">☆ Watch MLA</button>
          <button className="btn ghost">Share profile</button>
          <button className="btn ghost">Contact details</button>
        </div>
      </section>

      <div className="profile-stats">
        <div className="cell"><div className="lbl">Attendance</div><div className="val">{m.att}%</div><div className="sub">Above 90th percentile</div></div>
        <div className="cell"><div className="lbl">Divisions voted</div><div className="val">398<span style={{fontSize:16, color:'var(--ink-3)'}}>/412</span></div><div className="sub">96.6% participation</div></div>
        <div className="cell"><div className="lbl">Speeches in chamber</div><div className="val">217</div><div className="sub">Ranked 3rd in party</div></div>
        <div className="cell"><div className="lbl">Party loyalty</div><div className="val">99.1%</div><div className="sub">Voted with {m.party} on all but 4 divisions</div></div>
      </div>

      <div className="tabs">
        {['overview','voting','speeches','committees','questions','interests'].map(t => (
          <button key={t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{t[0].toUpperCase()+t.slice(1)}</button>
        ))}
      </div>

      <div className="twocol" style={{gap: 48}}>
        <section>
          <h3 className="serif" style={{fontSize:24, fontWeight:400, marginBottom: 12}}>Voting pattern</h3>
          <p style={{color:'var(--ink-2)', fontSize:14, maxWidth:'50ch', marginBottom: 16}}>Each mark below represents a recorded division, newest on the right. Hover for motion.</p>
          <div className="vote-trail">
            {trail.map((v, i) => <span key={i} className={v}/>)}
          </div>
          <div className="vote-trail-legend">
            <span><i style={{background:'var(--forest)'}}/> Aye · 261</span>
            <span><i style={{background:'var(--crimson)'}}/> No · 118</span>
            <span><i style={{background:'var(--ink-4)'}}/> Abstain · 19</span>
            <span><i style={{background:'var(--paper-3)', border:'1px solid var(--rule)'}}/> Absent · 14</span>
          </div>

          <div className="chart" style={{marginTop: 32}}>
            <h4>Attendance — rolling 12 month</h4>
            <div className="csub">Percentage of sittings attended, smoothed over a month</div>
            <LineChart data={[
              {label:'May', v:89},{label:'Jul', v:92},{label:'Sep', v:94},{label:'Nov', v:91},
              {label:'Jan', v:95},{label:'Mar', v:93},{label:'Apr', v:94}
            ]} />
          </div>
        </section>

        <section>
          <h3 className="serif" style={{fontSize: 24, fontWeight: 400, marginBottom: 12}}>Recent notable votes</h3>
          <div style={{display:'flex', flexDirection:'column'}}>
            {DIVISIONS.slice(0, 5).map(d => (
              <div key={d.id} className="div-row" style={{gridTemplateColumns: '1fr auto'}}>
                <div>
                  <div className="title">{d.title}</div>
                  <div className="sub">{new Date(d.date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})} · {d.sub}</div>
                </div>
                <span className={`pill ${['pass','pass','fail','pass','fail'][DIVISIONS.indexOf(d) % 5]==='pass'?'pass':'fail'}`}>Voted {['Aye','Aye','No','Aye','No'][DIVISIONS.indexOf(d) % 5]}</span>
              </div>
            ))}
          </div>

          <h3 className="serif" style={{fontSize: 24, fontWeight: 400, marginTop: 40, marginBottom: 12}}>Committee service</h3>
          <div className="dept-grid" style={{gridTemplateColumns:'1fr'}}>
            <div className="dept-item" style={{borderRight:0}}>
              <div className="photo" style={{background:'var(--teal-wash)', display:'grid', placeItems:'center', color:'var(--teal)', fontFamily:'var(--font-mono)', fontSize:11}}>EO</div>
              <div>
                <div className="dept">Executive Office</div>
                <h5>Committee for the Executive Office</h5>
                <div className="party">Member · since Feb 2024</div>
              </div>
              <span className="pill accent">Chair</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
window.MlaProfile = MlaProfile;
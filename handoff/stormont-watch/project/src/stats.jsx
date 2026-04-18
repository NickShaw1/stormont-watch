const { PARTIES, PARTY_COHESION, DIV_MONTHLY, AGREEMENT_MONTHLY, PASS_RATE_YEAR } = window.SW;
const { LineChart, Bars } = window.SW_UI;

function StatsPage() {
  return (
    <div className="container" style={{paddingBottom: 80}}>
      <header className="page-header">
        <span className="eyebrow">Statistics</span>
        <h1>Patterns in the Chamber</h1>
        <p className="lede">Analysis drawn from 412 divisions, 4,218 speeches and 12,904 written questions since the mandate began. Click any number for the underlying data.</p>
      </header>

      <div className="stat-grid">
        <div className="stat-block">
          <span className="eyebrow">Cohesion</span>
          <h4>Party loyalty</h4>
          <div className="csub" style={{fontSize:12, color:'var(--ink-3)'}}>Share of divisions where all MLAs voted together</div>
          <div className="bar-list">
            {PARTY_COHESION.sort((a,b)=>b.pct-a.pct).map(r => (
              <div key={r.party} className="bar-row">
                <span className="lbl"><span className="party-dot" style={{background: PARTIES[r.party].color}}/> {r.party}</span>
                <div className="track"><i style={{width: r.pct + '%', background: PARTIES[r.party].color}}/></div>
                <span className="val">{r.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="stat-block">
          <span className="eyebrow">Throughput</span>
          <h4>Divisions / month</h4>
          <div className="csub" style={{fontSize:12, color:'var(--ink-3)'}}>Since the Assembly returned, Feb 2024</div>
          <Bars data={DIV_MONTHLY.slice(-20).map((v,i) => ({ v, label: i%3===0?(i+1).toString():'', highlight: i === 19 }))} height={140}/>
          <div className="note">Peak: 24 divisions in Jun 2024 (Budget).</div>
        </div>

        <div className="stat-block">
          <span className="eyebrow">Cross-community</span>
          <h4>Agreement index</h4>
          <div className="csub" style={{fontSize:12, color:'var(--ink-3)'}}>% of divisions with majority from both designations</div>
          <div className="big">48<span style={{fontSize: 22, color:'var(--ochre)'}}>%</span></div>
          <LineChart data={AGREEMENT_MONTHLY.slice(-12).map((v,i)=>({v, label: ['M','J','J','A','S','O','N','D','J','F','M','A'][i]}))} height={100}/>
        </div>

        <div className="stat-block">
          <span className="eyebrow">Legislation</span>
          <h4>Pass rate by year</h4>
          <Bars data={PASS_RATE_YEAR.map(r => ({ v: r.v, label: String(r.y), highlight: r.y === 2026 }))} height={140}/>
          <div className="note">Percentage of introduced bills that reach Royal Assent.</div>
        </div>

        <div className="stat-block">
          <span className="eyebrow">Participation</span>
          <h4>Attendance</h4>
          <div className="big">91.4<span style={{fontSize: 22, color:'var(--ochre)'}}>%</span></div>
          <div className="note">Assembly-wide attendance across plenary sittings in 2026.</div>
          <div className="bar-list">
            <div className="bar-row"><span className="lbl">Ministers</span><div className="track"><i style={{width:'94%', background:'var(--teal)'}}/></div><span className="val">94%</span></div>
            <div className="bar-row"><span className="lbl">Back-bench</span><div className="track"><i style={{width:'91%', background:'var(--teal)'}}/></div><span className="val">91%</span></div>
            <div className="bar-row"><span className="lbl">Opposition</span><div className="track"><i style={{width:'95%', background:'var(--teal)'}}/></div><span className="val">95%</span></div>
          </div>
        </div>

        <div className="stat-block">
          <span className="eyebrow">Chamber time</span>
          <h4>Who speaks most</h4>
          <div className="bar-list">
            {[
              {n:'Matthew O\'Toole',p:'SDLP', v:312},
              {n:'Jim Allister',p:'TUV', v:298},
              {n:'Mike Nesbitt',p:'UUP', v:247},
              {n:'Naomi Long',p:'Alliance', v:221},
              {n:'Paul Givan',p:'DUP', v:214},
              {n:'Michelle O\'Neill',p:'Sinn Féin', v:187},
            ].map(r => (
              <div key={r.n} className="bar-row" style={{gridTemplateColumns:'140px 1fr auto'}}>
                <span className="lbl" style={{fontSize: 12}}>{r.n}</span>
                <div className="track"><i style={{width: (r.v/320*100) + '%', background: PARTIES[r.p].color}}/></div>
                <span className="val">{r.v}</span>
              </div>
            ))}
          </div>
          <div className="note">Number of speeches delivered in the main chamber, mandate to date.</div>
        </div>

        <div className="stat-block">
          <span className="eyebrow">Scrutiny</span>
          <h4>Written questions</h4>
          <div className="big">12,904</div>
          <div className="note">Tabled since May 2022 · 2,147 so far in 2026.</div>
          <div className="bar-list">
            <div className="bar-row"><span className="lbl">Health</span><div className="track"><i style={{width:'82%', background:'var(--teal)'}}/></div><span className="val">3,121</span></div>
            <div className="bar-row"><span className="lbl">Education</span><div className="track"><i style={{width:'61%', background:'var(--teal)'}}/></div><span className="val">2,318</span></div>
            <div className="bar-row"><span className="lbl">Economy</span><div className="track"><i style={{width:'47%', background:'var(--teal)'}}/></div><span className="val">1,782</span></div>
            <div className="bar-row"><span className="lbl">Justice</span><div className="track"><i style={{width:'38%', background:'var(--teal)'}}/></div><span className="val">1,442</span></div>
          </div>
        </div>

        <div className="stat-block">
          <span className="eyebrow">Dissent</span>
          <h4>Rebellion count</h4>
          <div className="csub" style={{fontSize:12, color:'var(--ink-3)'}}>Votes cast against own party's majority line</div>
          <div className="bar-list">
            <div className="bar-row"><span className="lbl">UUP</span><div className="track"><i style={{width:'100%', background: PARTIES.UUP.color}}/></div><span className="val">14</span></div>
            <div className="bar-row"><span className="lbl">SDLP</span><div className="track"><i style={{width:'57%', background: PARTIES.SDLP.color}}/></div><span className="val">8</span></div>
            <div className="bar-row"><span className="lbl">Alliance</span><div className="track"><i style={{width:'43%', background: PARTIES.Alliance.color}}/></div><span className="val">6</span></div>
            <div className="bar-row"><span className="lbl">DUP</span><div className="track"><i style={{width:'29%', background: PARTIES.DUP.color}}/></div><span className="val">4</span></div>
            <div className="bar-row"><span className="lbl">Sinn Féin</span><div className="track"><i style={{width:'14%', background: PARTIES['Sinn Féin'].color}}/></div><span className="val">2</span></div>
          </div>
          <div className="note">Mandate to date; TUV & PBP excluded (single-member).</div>
        </div>

        <div className="stat-block">
          <span className="eyebrow">Committees</span>
          <h4>Committee attendance</h4>
          <div className="big">88.2<span style={{fontSize:22, color:'var(--ochre)'}}>%</span></div>
          <div className="note">Across 13 statutory committees · 1,842 sittings since Feb 2024.</div>
          <div className="bar-list">
            <div className="bar-row"><span className="lbl">Health</span><div className="track"><i style={{width:'94%', background:'var(--teal)'}}/></div><span className="val">94%</span></div>
            <div className="bar-row"><span className="lbl">Finance</span><div className="track"><i style={{width:'89%', background:'var(--teal)'}}/></div><span className="val">89%</span></div>
            <div className="bar-row"><span className="lbl">Education</span><div className="track"><i style={{width:'86%', background:'var(--teal)'}}/></div><span className="val">86%</span></div>
            <div className="bar-row"><span className="lbl">Justice</span><div className="track"><i style={{width:'82%', background:'var(--teal)'}}/></div><span className="val">82%</span></div>
          </div>
        </div>

        <div className="stat-block">
          <span className="eyebrow">Gender</span>
          <h4>Women in the Chamber</h4>
          <div className="big">37.8<span style={{fontSize:22, color:'var(--ochre)'}}>%</span></div>
          <div className="note">34 of 90 MLAs · highest in Assembly history.</div>
          <div style={{display:'flex', gap: 2, marginTop: 8, flexWrap:'wrap'}}>
            {Array.from({length: 90}).map((_, i) => (
              <span key={i} style={{width: 10, height: 18, background: i < 34 ? 'var(--teal)' : 'var(--paper-3)', borderRadius: 2}}/>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
window.StatsPage = StatsPage;
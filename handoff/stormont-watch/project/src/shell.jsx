const { useState, useEffect } = React;

const P = window.SW.PARTIES;
const partyColor = (name) => (P[name] && P[name].color) || '#888';
const partyAbbr = (name) => (P[name] && P[name].abbr) || name;

function partyPillStyle(name) {
  const c = partyColor(name);
  return { background: c, color: ['Alliance'].includes(name) ? '#1a1a1a' : '#fff' };
}

function EyeMark({ size = 28 }) {
  return (
    <div className="mark" style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" width={size*0.6} height={size*0.6} fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M2 12C2 12 5.5 5 12 5C18.5 5 22 12 22 12C22 12 18.5 19 12 19C5.5 19 2 12 2 12Z" strokeLinejoin="round"/>
        <circle cx="12" cy="12" r="4"/>
        <circle cx="12" cy="12" r="2" fill="currentColor"/>
      </svg>
    </div>
  );
}

function SiteNav({ currentPage, goto, vp }) {
  const [open, setOpen] = useState(false);
  const links = [
    ['structure', 'Assembly'],
    ['mlas', 'MLAs'],
    ['bills', 'Legislation'],
    ['votes', 'Votes'],
    ['stats', 'Stats'],
    ['expenses', 'Expenses'],
  ];
  const onLink = (k) => { goto(k); setOpen(false); };
  return (
    <nav className="site-nav">
      <div className="container inner">
        <a href="#" onClick={(e)=>{e.preventDefault(); onLink('home');}} className="brand">
          <EyeMark size={28} />
          <span>Stormont <span className="watch">Watch</span></span>
        </a>
        <ul className="links">
          {links.slice(0,5).map(([k, label]) => (
            <li key={k}>
              <a href="#" className={currentPage === k ? 'active' : ''} onClick={(e)=>{e.preventDefault(); onLink(k);}}>{label}</a>
            </li>
          ))}
        </ul>
        <div className="nav-right">
          <button className="search-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
            <span>Search MLAs, bills, votes…</span>
            <kbd>⌘K</kbd>
          </button>
          <button className="hamburger" onClick={()=>setOpen(o=>!o)} aria-label="Menu" aria-expanded={open}>
            {open
              ? <svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none"><path d="M18 6 6 18M6 6l12 12"/></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none"><path d="M4 7h16M4 12h16M4 17h16"/></svg>}
          </button>
        </div>
      </div>
      {open && (
        <>
          <div className="mobile-drawer-backdrop" onClick={()=>setOpen(false)}/>
          <div className="mobile-drawer" role="dialog" aria-modal="true">
            <div className="mobile-search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
              <input placeholder="Search MLAs, bills, votes…" />
            </div>
            <ul className="mobile-links">
              {[['home','Home'], ...links].map(([k, label]) => (
                <li key={k}>
                  <a href="#" className={currentPage === k ? 'active' : ''} onClick={(e)=>{e.preventDefault(); onLink(k);}}>
                    <span>{label}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
                  </a>
                </li>
              ))}
            </ul>
            <div className="mobile-meta">
              <a href="#" onClick={(e)=>{e.preventDefault(); onLink('about');}}>About</a>
              <span>·</span>
              <a href="#" onClick={(e)=>{e.preventDefault(); onLink('privacy');}}>Privacy</a>
              <span>·</span>
              <a href="#" onClick={(e)=>{e.preventDefault(); onLink('terms');}}>Terms</a>
            </div>
          </div>
        </>
      )}
    </nav>
  );
}

function Ribbon() {
  return (
    <div className="ribbon">
      <div className="container inner">
        <span className="live"><span className="pulse"></span> Assembly sitting · Plenary</span>
        <span className="meta">Next division ~ 14:32 BST · Motion on Housing Executive Reform</span>
      </div>
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container inner">
        <div className="about">
          <div className="brand"><EyeMark size={24} /> Stormont Watch</div>
          <p>Every vote, every MLA, every bill in the Northern Ireland Assembly since May 2022. An independent public-interest project.</p>
          <div style={{display:'flex', gap:8}}>
            <span className="tag">2022–2027 mandate</span>
            <span className="tag">Updated daily</span>
          </div>
        </div>
        <div>
          <h4>Explore</h4>
          <a href="#">Assembly</a><a href="#">MLAs</a><a href="#">Legislation</a><a href="#">Votes</a><a href="#">Statistics</a>
        </div>
        <div>
          <h4>Data</h4>
          <a href="#">Methodology</a><a href="#">Source: NI Assembly API</a><a href="#">Download CSV</a><a href="#">API access</a>
        </div>
        <div>
          <h4>About</h4>
          <a href="#">About the project</a><a href="#">Privacy</a><a href="#">Terms</a><a href="#">Contact</a>
        </div>
        <div className="colophon">
          <span>© 2026 Stormont Watch. Parliamentary information under the <a href="#" style={{color:'var(--teal)'}}>Open Government Licence v3.0</a>.</span>
          <span className="mono">v4.0 · LAST SYNC 14:02 BST</span>
        </div>
      </div>
    </footer>
  );
}

// Tiny sparkline
function Sparkline({ values, stroke = 'var(--teal)', fill = true, height = 32 }) {
  if (!values || !values.length) return null;
  const w = 120, h = height, pad = 2;
  const max = Math.max(...values), min = Math.min(...values);
  const xs = values.map((_, i) => pad + (i * (w - pad*2)) / (values.length - 1));
  const ys = values.map(v => h - pad - ((v - min) / (max - min || 1)) * (h - pad*2));
  const d = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  const area = `M${xs[0]},${h} ${xs.map((x,i)=>`L${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')} L${xs[xs.length-1]},${h} Z`;
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      {fill && <path d={area} fill={stroke} opacity="0.12" />}
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// Simple bar chart
function Bars({ data, max, height = 180, color = 'var(--teal)' }) {
  const w = 600, gap = 2;
  const bw = (w - gap * (data.length - 1)) / data.length;
  const mx = max || Math.max(...data.map(d => d.v));
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{width:'100%', height: height + 'px', display:'block'}}>
      {data.map((d, i) => {
        const h = (d.v / mx) * (height - 18);
        return <g key={i}>
          <rect x={i * (bw + gap)} y={height - 16 - h} width={bw} height={h} fill={color} opacity={d.highlight ? 1 : 0.7} />
          {d.label && <text x={i * (bw + gap) + bw / 2} y={height - 4} fill="var(--ink-3)" fontSize="9" textAnchor="middle" fontFamily="var(--font-mono)">{d.label}</text>}
        </g>;
      })}
    </svg>
  );
}

// Line chart
function LineChart({ data, height = 220 }) {
  const w = 640, pad = 30;
  const max = Math.max(...data.map(d => d.v)) * 1.1;
  const xs = data.map((_, i) => pad + (i * (w - pad*2)) / (data.length - 1));
  const ys = data.map(d => height - pad - (d.v / max) * (height - pad * 2));
  const line = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${height}`} style={{width:'100%', height: height + 'px', display:'block'}}>
      {[0, 0.25, 0.5, 0.75, 1].map(p => <line key={p} x1={pad} x2={w - pad} y1={pad + p * (height - pad*2)} y2={pad + p * (height - pad*2)} stroke="var(--rule)" strokeDasharray="2,2" />)}
      <path d={line} fill="none" stroke="var(--teal)" strokeWidth="2"/>
      {data.map((d, i) => <circle key={i} cx={xs[i]} cy={ys[i]} r="3" fill="var(--teal)"/>)}
      {data.map((d, i) => <text key={'t'+i} x={xs[i]} y={height - 8} fill="var(--ink-3)" fontSize="10" textAnchor="middle" fontFamily="var(--font-mono)">{d.label}</text>)}
    </svg>
  );
}

window.SW_UI = { SiteNav, SiteFooter, Ribbon, Sparkline, Bars, LineChart, partyColor, partyAbbr, partyPillStyle, EyeMark };

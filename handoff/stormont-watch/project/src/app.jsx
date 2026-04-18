const { useState, useEffect } = React;
const { SiteNav, SiteFooter } = window.SW_UI;

const PAGES = [
  ['home', 'Home'],
  ['structure', 'Assembly structure'],
  ['mlas', 'MLAs (list)'],
  ['mla', 'MLA profile'],
  ['bills', 'Legislation'],
  ['bill', 'Bill detail'],
  ['votes', 'Votes'],
  ['vote', 'Division detail'],
  ['stats', 'Statistics'],
  ['expenses', 'Expenses'],
  ['about', 'About'],
  ['privacy', 'Privacy'],
  ['terms', 'Terms'],
];

const URL_MAP = {
  home: '/', structure: '/assembly', mlas: '/mlas', mla: '/mlas/michelle-oneill',
  bills: '/legislation', bill: '/legislation/nia-14-22-27', votes: '/votes',
  vote: '/votes/d-3421', stats: '/stats', expenses: '/expenses',
  about: '/about', privacy: '/privacy', terms: '/terms',
};

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "teal",
  "density": "standard",
  "showTweaks": false
}/*EDITMODE-END*/;

function App() {
  const [page, setPage] = useState(() => localStorage.getItem('sw-page') || 'home');
  const [vp, setVp] = useState(() => localStorage.getItem('sw-vp') || 'desktop');
  const [tweaks, setTweaks] = useState(TWEAK_DEFAULTS);
  const [tweaksOpen, setTweaksOpen] = useState(false);

  useEffect(() => { localStorage.setItem('sw-page', page); window.scrollTo(0, 0); }, [page]);
  useEffect(() => { localStorage.setItem('sw-vp', vp); }, [vp]);

  useEffect(() => {
    const handler = (e) => {
      if (!e.data || !e.data.type) return;
      if (e.data.type === '__activate_edit_mode') setTweaksOpen(true);
      if (e.data.type === '__deactivate_edit_mode') setTweaksOpen(false);
    };
    window.addEventListener('message', handler);
    window.parent.postMessage({type:'__edit_mode_available'}, '*');
    return () => window.removeEventListener('message', handler);
  }, []);

  const setTweak = (k, v) => {
    const next = {...tweaks, [k]: v};
    setTweaks(next);
    window.parent.postMessage({type: '__edit_mode_set_keys', edits: {[k]: v}}, '*');
  };

  const goto = (p) => setPage(p);

  let Page;
  switch (page) {
    case 'home':      Page = <window.Home goto={goto}/>; break;
    case 'mlas':      Page = <window.MlasPage goto={goto}/>; break;
    case 'mla':       Page = <window.MlaProfile goto={goto}/>; break;
    case 'bills':     Page = <window.BillsPage goto={goto}/>; break;
    case 'bill':      Page = <window.BillDetail goto={goto}/>; break;
    case 'votes':     Page = <window.VotesPage goto={goto}/>; break;
    case 'vote':      Page = <window.VoteDetail goto={goto}/>; break;
    case 'structure': Page = <window.StructurePage goto={goto}/>; break;
    case 'stats':     Page = <window.StatsPage />; break;
    case 'expenses':  Page = <window.ExpensesPage goto={goto}/>; break;
    case 'about':
    case 'privacy':
    case 'terms':     Page = <window.LegalPage which={page}/>; break;
    default:          Page = <window.Home goto={goto}/>;
  }

  // Map sub-pages to nav highlight
  const navKey = ['mla'].includes(page) ? 'mlas' : ['bill'].includes(page) ? 'bills' : ['vote'].includes(page) ? 'votes' : page;

  return (
    <div className="app" data-accent={tweaks.accent === 'teal' ? '' : tweaks.accent} data-density={tweaks.density === 'standard' ? '' : tweaks.density}>
      <div className="app-toolbar">
        <div className="brand"><span className="dot"/>Stormont Watch <span className="brand-meta">· REFINED PROTOTYPE</span></div>
        <div className="spacer"/>
        <select className="page-pick" value={page} onChange={e => setPage(e.target.value)}>
          {PAGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <div className="group" role="tablist" aria-label="Viewport">
          {[['desktop','Desktop','1440'],['tablet','Tablet','834'],['mobile','Mobile','390']].map(([k,l,w]) => (
            <button key={k} className={vp===k?'active':''} onClick={()=>setVp(k)}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {k === 'desktop' && <><rect x="2" y="4" width="20" height="14" rx="2"/><path d="M8 20h8M12 18v2"/></>}
                {k === 'tablet' && <rect x="4" y="3" width="16" height="18" rx="2"/>}
                {k === 'mobile' && <rect x="7" y="2" width="10" height="20" rx="2"/>}
              </svg>
              {l} <span style={{fontFamily:'var(--font-mono)', fontSize: 10, opacity: 0.7}}>{w}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="viewport-stage">
        <div className="viewport-frame" data-vp={vp}>
          <div className="vp-chrome">
            <div className="traffic"><i/><i/><i/></div>
            <div className="url">stormontwatch.org{URL_MAP[page] || '/'}</div>
            <div style={{width: 50}}/>
          </div>
          <div className="site-content" data-vp={vp}>
            <SiteNav currentPage={navKey} goto={goto} vp={vp}/>
            {Page}
            <SiteFooter/>
          </div>
        </div>
      </div>

      <div className={`tweaks-panel ${tweaksOpen ? 'open' : ''}`}>
        <h4>Tweaks</h4>
        <div className="field">
          <label>Accent</label>
          <div className="swatches">
            {[['teal','#1a5857'],['navy','#1a3658'],['ochre','#a67829'],['plum','#6b2c52'],['forest','#1f5c3b']].map(([k,c]) => (
              <button key={k} className={tweaks.accent===k?'active':''} style={{background: c}} onClick={()=>setTweak('accent', k)}/>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Density</label>
          <div className="choices">
            {['compact','standard','comfortable'].map(k => (
              <button key={k} className={tweaks.density===k?'active':''} onClick={()=>setTweak('density', k)}>{k}</button>
            ))}
          </div>
        </div>
        <div style={{fontSize: 11, color:'var(--ink-3)', marginTop: 12, paddingTop: 12, borderTop:'1px solid var(--rule)'}}>
          Switch pages & viewports in the top bar. Each change is saved.
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
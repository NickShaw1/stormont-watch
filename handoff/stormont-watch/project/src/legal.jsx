function LegalPage({ which }) {
  const pages = {
    about: {
      eyebrow: 'The project',
      title: 'About Stormont Watch',
      lede: 'An independent, non-partisan tracker of the Northern Ireland Assembly — because scrutiny only works when the public can see.',
      body: (
        <>
          <p>Stormont Watch was founded in 2024 after the restoration of the Assembly. It is run as a public-interest project with no party affiliation and no government funding.</p>
          <h2>Our sources</h2>
          <p>All data is drawn from the Northern Ireland Assembly's official API, Hansard, and the Assembly Commission's publications. Where we enrich the data — for example by translating procedural language into plain English — we label it clearly. <a href="#">See our methodology</a>.</p>
          <h2>Our standards</h2>
          <p>Every fact on this site links back to a primary source. We publish errata publicly. We do not take advertising, accept donations from political parties, or recommend how any person should vote.</p>
          <h2>Get in touch</h2>
          <p>For corrections, please email <a href="mailto:corrections@stormontwatch.org">corrections@stormontwatch.org</a>. For press or partnerships, <a href="mailto:press@stormontwatch.org">press@stormontwatch.org</a>.</p>
        </>
      ),
    },
    privacy: {
      eyebrow: 'Legal',
      title: 'Privacy',
      lede: 'We do not track you, sell your data, or set third-party cookies. Here is exactly what we do and don\'t do.',
      body: (
        <>
          <h2>What we collect</h2>
          <p>Nothing that identifies you personally. We collect aggregate, anonymised page-view counts via a self-hosted analytics instance that does not use cookies and does not record IP addresses.</p>
          <h2>Newsletter</h2>
          <p>If you sign up for the newsletter we store your email address with our transactional email provider for the sole purpose of sending you the newsletter. Unsubscribe any time from any email.</p>
          <h2>Your rights</h2>
          <p>Under UK GDPR, you can request deletion of any data we hold about you by emailing <a href="mailto:privacy@stormontwatch.org">privacy@stormontwatch.org</a>.</p>
        </>
      ),
    },
    terms: {
      eyebrow: 'Legal',
      title: 'Terms of Use',
      lede: 'Plain English: you may use, quote and link this site freely. Data is published under Open Government Licence v3.0.',
      body: (
        <>
          <h2>Data licence</h2>
          <p>Parliamentary information reproduced on this site is licensed under the <a href="#">Open Government Licence v3.0</a>. Our own editorial content, summaries and visualisations are licensed under <a href="#">CC BY 4.0</a> — please attribute "Stormont Watch" and link back.</p>
          <h2>Accuracy</h2>
          <p>We take accuracy seriously but cannot guarantee every figure. This site is not an official record of the Assembly; for that, consult <a href="#">niassembly.gov.uk</a>.</p>
          <h2>Liability</h2>
          <p>The site is provided as-is. We accept no liability for decisions taken based on information presented here. Always check the primary source before quoting for legal or journalistic purposes.</p>
        </>
      ),
    },
  };
  const p = pages[which];
  return (
    <div className="container" style={{paddingBottom: 80}}>
      <header className="page-header">
        <span className="eyebrow">{p.eyebrow}</span>
        <h1>{p.title}</h1>
        <p className="lede">{p.lede}</p>
      </header>
      <div className="prose">{p.body}</div>
    </div>
  );
}
window.LegalPage = LegalPage;
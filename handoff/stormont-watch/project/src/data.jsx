// Shared data for the Stormont Watch prototype.
// Approximated from the NI Assembly 2022-2027 mandate; numbers are illustrative.

const PARTIES = {
  'Sinn Féin':   { abbr: 'SF',       color: '#326760', count: 27, bloc: 'Nationalist' },
  'DUP':         { abbr: 'DUP',      color: '#C41E3A', count: 25, bloc: 'Unionist'    },
  'Alliance':    { abbr: 'APNI',     color: '#F6C135', count: 17, bloc: 'Other'       },
  'UUP':         { abbr: 'UUP',      color: '#5B8DD9', count: 9,  bloc: 'Unionist'    },
  'SDLP':        { abbr: 'SDLP',     color: '#2E8B57', count: 8,  bloc: 'Nationalist' },
  'TUV':         { abbr: 'TUV',      color: '#1a1a6e', count: 1,  bloc: 'Unionist'    },
  'PBP':         { abbr: 'PBP',      color: '#c0392b', count: 1,  bloc: 'Other'       },
  'Independent': { abbr: 'Ind',      color: '#7a7a7a', count: 2,  bloc: 'Other'       },
};

const MLA_IMG = (n) => `assets/mlas/${n}.jpg`;

const MLAS = [
  { id: 1,  name: 'Michelle O\'Neill',    party: 'Sinn Féin', cons: 'Mid Ulster',           role: 'First Minister',        img: MLA_IMG(1),   att: 94 },
  { id: 2,  name: 'Emma Little-Pengelly', party: 'DUP',       cons: 'Lagan Valley',         role: 'Deputy First Minister', img: MLA_IMG(2),   att: 92 },
  { id: 3,  name: 'Naomi Long',           party: 'Alliance',  cons: 'East Belfast',         role: 'Minister of Justice',   img: MLA_IMG(3),   att: 89 },
  { id: 4,  name: 'Caoimhe Archibald',    party: 'Sinn Féin', cons: 'East Londonderry',     role: 'Minister of Finance',   img: MLA_IMG(4),   att: 91 },
  { id: 5,  name: 'John O\'Dowd',         party: 'Sinn Féin', cons: 'Upper Bann',           role: 'Minister for Infrastructure', img: MLA_IMG(5), att: 88 },
  { id: 10, name: 'Paul Givan',           party: 'DUP',       cons: 'Lagan Valley',         role: 'Minister of Education', img: MLA_IMG(10),  att: 90 },
  { id: 20, name: 'Conor Murphy',         party: 'Sinn Féin', cons: 'Newry and Armagh',     role: 'Minister for the Economy', img: MLA_IMG(20), att: 86 },
  { id: 30, name: 'Andrew Muir',          party: 'Alliance',  cons: 'North Down',           role: 'Minister of Agriculture', img: MLA_IMG(30), att: 93 },
  { id: 40, name: 'Mike Nesbitt',         party: 'UUP',       cons: 'Strangford',           role: 'Minister of Health',    img: MLA_IMG(40),  att: 95 },
  { id: 50, name: 'Matthew O\'Toole',     party: 'SDLP',      cons: 'South Belfast',        role: 'Opposition Leader',     img: MLA_IMG(50),  att: 97 },
  { id: 100,name: 'Gordon Lyons',         party: 'DUP',       cons: 'East Antrim',          role: 'Minister for Communities', img: MLA_IMG(100), att: 88 },
  { id: 150,name: 'Liz Kimmins',          party: 'Sinn Féin', cons: 'Newry and Armagh',     role: null, img: MLA_IMG(150), att: 89 },
  { id: 200,name: 'Declan Kearney',       party: 'Sinn Féin', cons: 'South Antrim',         role: null, img: MLA_IMG(200), att: 82 },
  { id: 300,name: 'Stewart Dickson',      party: 'Alliance',  cons: 'East Antrim',          role: null, img: MLA_IMG(300), att: 87 },
  // synthetic fill for grid density
];

// synthesize enough cards to look realistic in grids
function padMlas() {
  const base = MLAS.slice();
  const names = [
    ['Órlaithí Flynn','Sinn Féin','West Belfast'],['Pat Sheehan','Sinn Féin','West Belfast'],['Colm Gildernew','Sinn Féin','Fermanagh and South Tyrone'],
    ['Nicola Brogan','Sinn Féin','West Tyrone'],['Gerry Kelly','Sinn Féin','North Belfast'],['Sinéad McLaughlin','SDLP','Foyle'],
    ['Cara Hunter','SDLP','East Londonderry'],['Colin McGrath','SDLP','South Down'],['Daniel McCrossan','SDLP','West Tyrone'],
    ['Gary Middleton','DUP','Foyle'],['Trevor Clarke','DUP','South Antrim'],['Deborah Erskine','DUP','Fermanagh and South Tyrone'],
    ['Phillip Brett','DUP','North Belfast'],['Peter Martin','DUP','North Down'],['Harry Harvey','DUP','Strangford'],
    ['Kellie Armstrong','Alliance','Strangford'],['Paula Bradshaw','Alliance','South Belfast'],['Connie Egan','Alliance','North Down'],
    ['Nuala McAllister','Alliance','North Belfast'],['Eóin Tennyson','Alliance','Upper Bann'],
    ['Robbie Butler','UUP','Lagan Valley'],['Steve Aiken','UUP','South Antrim'],['Robin Swann','UUP','North Antrim'],
    ['Jim Allister','TUV','North Antrim'],['Gerry Carroll','PBP','West Belfast'],
    ['Claire Sugden','Independent','East Londonderry'],['Alex Easton','Independent','North Down'],
  ];
  const existing = new Set(base.map(m => m.name));
  names.forEach((n, i) => {
    if (existing.has(n[0])) return;
    const id = 400 + i;
    const usableImg = [1,2,3,4,5,10,20,30,40,50,100,150,200,300][i % 14];
    base.push({
      id, name: n[0], party: n[1], cons: n[2], role: null,
      img: MLA_IMG(usableImg),
      att: 75 + Math.round(Math.sin(i * 2.1) * 10 + (i % 5) * 2),
    });
  });
  return base;
}
const ALL_MLAS = padMlas();

const BILLS = [
  { id: 'nia-14-22-27', num: '14/22-27', title: 'Mental Capacity (Amendment) Bill',                type: 'Executive',  stage: 'Committee Stage',        stageIdx: 3, date: '2026-04-14', status: 'in-progress' },
  { id: 'nia-13-22-27', num: '13/22-27', title: 'Organ and Tissue Donation (Deemed Consent) Bill', type: 'Executive',  stage: 'Second Stage',           stageIdx: 2, date: '2026-04-10', status: 'in-progress' },
  { id: 'nia-12-22-27', num: '12/22-27', title: 'School Uniforms (Guidelines and Allowances) Bill',type: 'Private Member', stage: 'Consideration Stage',stageIdx: 4, date: '2026-04-02', status: 'in-progress' },
  { id: 'nia-11-22-27', num: '11/22-27', title: 'Climate Change (No. 2) Bill',                     type: 'Executive',  stage: 'Final Stage',            stageIdx: 6, date: '2026-03-18', status: 'completed', passed: true },
  { id: 'nia-10-22-27', num: '10/22-27', title: 'Safe Access Zones Bill',                          type: 'Executive',  stage: 'Royal Assent',           stageIdx: 7, date: '2026-03-04', status: 'completed', passed: true },
  { id: 'nia-09-22-27', num: '09/22-27', title: 'Public Service Ombudsperson Bill',                type: 'Executive',  stage: 'Further Consideration',  stageIdx: 5, date: '2026-04-22', status: 'scheduled' },
  { id: 'nia-08-22-27', num: '08/22-27', title: 'Hunting with Dogs Bill',                          type: 'Private Member', stage: 'Final Stage',         stageIdx: 6, date: '2026-02-11', status: 'completed', passed: false },
  { id: 'nia-07-22-27', num: '07/22-27', title: 'Charities (Amendment) Bill',                      type: 'Executive',  stage: 'Royal Assent',           stageIdx: 7, date: '2026-01-28', status: 'completed', passed: true },
];

const STAGES = ['Introduced', 'First Stage', 'Second Stage', 'Committee Stage', 'Consideration', 'Further Consideration', 'Final Stage', 'Royal Assent'];

const DIVISIONS = [
  { id: 'd-3421', title: 'Programme for Government 2026-2028 — Motion to Approve', sub: 'Ministerial motion · Executive Office',   date: '2026-04-16', ay: 54, na: 32, ab: 2, passed: true,  type: 'standard' },
  { id: 'd-3420', title: 'Mental Capacity (Amendment) Bill — Second Stage',        sub: 'Committee-referred bill',                  date: '2026-04-14', ay: 71, na: 18, ab: 1, passed: true,  type: 'standard' },
  { id: 'd-3419', title: 'Legacy Act — Legislative Consent Motion',                sub: 'LCM · cross-community consent required',   date: '2026-04-09', ay: 42, na: 43, ab: 5, passed: false, type: 'cross-community' },
  { id: 'd-3418', title: 'School Uniforms Bill — Amendment No. 4 (Clause 3)',      sub: 'PMB · Education Committee',                date: '2026-04-02', ay: 61, na: 22, ab: 7, passed: true,  type: 'standard' },
  { id: 'd-3417', title: 'NHS Waiting Lists — Opposition Motion',                  sub: 'Opposition debate',                        date: '2026-03-25', ay: 38, na: 46, ab: 6, passed: false, type: 'standard' },
  { id: 'd-3416', title: 'Housing Executive Reform — Motion',                      sub: 'Executive motion',                         date: '2026-03-19', ay: 58, na: 28, ab: 4, passed: true,  type: 'standard' },
];

const CONSTITUENCIES = [
  'Belfast East','Belfast North','Belfast South','Belfast West',
  'East Antrim','East Londonderry','Fermanagh and South Tyrone','Foyle',
  'Lagan Valley','Mid Ulster','Newry and Armagh','North Antrim',
  'North Down','South Antrim','South Down','Strangford',
  'Upper Bann','West Tyrone'
];

// Time series for sparklines / charts
const DIV_MONTHLY = [0,0,0,0,2,1,0,0,0,2,0,1, 4,11,8,15,12,22,19,14,18,16,11,17, 24,22,18,19,24,21,16,14];
const AGREEMENT_MONTHLY = [0,0,0,0,38,42,0,0,0,31,0,44, 52,48,51,44,49,55,47,51,43,38,41,45, 49,52,46,50,47,44,48,50];
const PASS_RATE_YEAR = [{y:2022, v:100}, {y:2023, v:89}, {y:2024, v:78}, {y:2025, v:74}, {y:2026, v:76}];

const PARTY_COHESION = [
  { party: 'DUP', pct: 98.2, members: 25 },
  { party: 'Sinn Féin', pct: 99.1, members: 27 },
  { party: 'SDLP', pct: 96.7, members: 8 },
  { party: 'UUP', pct: 93.1, members: 9 },
  { party: 'Alliance', pct: 97.4, members: 17 },
  { party: 'TUV', pct: 100,  members: 1 },
  { party: 'PBP', pct: 100,  members: 1 },
];

const EXPENSES_TOP = [
  { id: 100, name: 'Gordon Lyons',      party: 'DUP',       total: 168420 },
  { id: 1,   name: 'Michelle O\'Neill', party: 'Sinn Féin', total: 162110 },
  { id: 40,  name: 'Mike Nesbitt',      party: 'UUP',       total: 158930 },
  { id: 50,  name: 'Matthew O\'Toole',  party: 'SDLP',      total: 154002 },
  { id: 30,  name: 'Andrew Muir',       party: 'Alliance',  total: 150886 },
  { id: 10,  name: 'Paul Givan',        party: 'DUP',       total: 149220 },
  { id: 20,  name: 'Conor Murphy',      party: 'Sinn Féin', total: 146701 },
  { id: 200, name: 'Declan Kearney',    party: 'Sinn Féin', total: 141520 },
  { id: 300, name: 'Stewart Dickson',   party: 'Alliance',  total: 138910 },
  { id: 150, name: 'Liz Kimmins',       party: 'Sinn Féin', total: 134220 },
];

window.SW = {
  PARTIES, ALL_MLAS, MLAS, BILLS, STAGES, DIVISIONS, CONSTITUENCIES,
  DIV_MONTHLY, AGREEMENT_MONTHLY, PASS_RATE_YEAR, PARTY_COHESION, EXPENSES_TOP
};

import type { Metadata } from 'next'
import { Accessibility, ListChecks, Mail, FlaskConical } from 'lucide-react'
import LegalPage from '../components/LegalPage'

const DESCRIPTION = 'How accessible Stormont Watch is, what has been tested, known limitations, and how to report an accessibility problem.'

export const metadata: Metadata = {
  title: 'Accessibility statement',
  description: DESCRIPTION,
  alternates: { canonical: 'https://www.stormontwatch.com/accessibility' },
  openGraph: { title: 'Accessibility statement - Stormont Watch', description: DESCRIPTION },
}

export default function AccessibilityPage() {
  return (
    <LegalPage
      eyebrow="Last reviewed: 23 October 2026"
      title="Accessibility statement"
      layout="single"
      intro="This statement applies to Stormont Watch at www.stormontwatch.com, which aims to be usable by as many people as possible. To the best of the site owner's knowledge, it meets the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA."
      sections={[
        {
          id: 'use',
          label: 'Using this site',
          title: 'What you should be able to do',
          Icon: Accessibility,
          children: (
            <ul>
              <li>Zoom in up to 400% and use the site at a width of 320 CSS pixels without scrolling sideways.</li>
              <li>Use the site in light or dark mode, following your device setting or the toggle in the header.</li>
              <li>Move around the whole site with a keyboard, with a visible focus indicator on links, buttons and search fields.</li>
              <li>Skip straight to the main content with the &quot;Skip to main content&quot; link, which is the first thing you reach by keyboard on every page.</li>
              <li>Open and close the menu and the filter pickers by keyboard. Focus stays inside while they are open, Escape closes them, and focus returns to where you were.</li>
              <li>Pick your constituency from a list as well as from the map on the homepage.</li>
              <li>Use the site with less movement if your device is set to reduce motion.</li>
            </ul>
          ),
        },
        {
          id: 'status',
          label: 'Features',
          title: 'What is built in',
          Icon: ListChecks,
          children: (
            <ul>
              <li>Every page has one main heading, headings in order, and its language set to British English.</li>
              <li>Page regions are labelled, so screen reader users can jump between navigation, main content and footer.</li>
              <li>Every search box and filter has a label.</li>
              <li>MLA photographs have an empty text alternative because the MLA&apos;s name is always written next to them. The photograph of Parliament Buildings has a description.</li>
              <li>Charts carry a text description of what they show. The charts on party pages also include a data table for screen readers.</li>
              <li>Votes, outcomes and parties are written out in words as well as shown in colour, for example Aye, No, Passed and Failed.</li>
              <li>Buttons and links are at least 24 by 24 CSS pixels, as WCAG 2.2 requires.</li>
              <li>Links that open in a new tab say so to screen readers.</li>
              <li>When you move to a new page, its title is announced to screen readers.</li>
            </ul>
          ),
        },
        {
          id: 'testing',
          label: 'Testing',
          title: 'How this site was tested',
          Icon: FlaskConical,
          children: (
            <>
              <p>The site was last tested on 23 October 2026. Testing included:</p>
              <ul>
                <li>Automated checks with axe-core against the WCAG 2.0, 2.1 and 2.2 A and AA rules, plus its best-practice rules. These cover colour contrast, headings, page regions, form labels and image alternatives. They ran on every type of page, in light and dark mode, at widths of 1280, 820 and 390 CSS pixels, in a Chromium browser.</li>
                <li>Checks for sideways scrolling and clipped content on every type of page at 320 and 640 CSS pixels wide, which match 400% and 200% zoom.</li>
                <li>Keyboard checks of the skip link on every page, of visible focus on the main page types, and of how the menu and pickers open, trap focus and close.</li>
              </ul>
              <p>This statement will be reviewed whenever the site changes significantly.</p>
            </>
          ),
        },
        {
          id: 'feedback',
          label: 'Feedback and contact',
          title: 'Report a problem',
          Icon: Mail,
          children: (
            <>
              <p>
                If you have difficulty using this site, need information in a different format, or want
                to report an accessibility problem, email{' '}
                <a href="mailto:hello@stormontwatch.com">hello@stormontwatch.com</a>.
              </p>
              <p>
                Please include the page address, what you were trying to do, and the device, browser and
                any assistive technology used. Accessibility problems are treated as faults to be fixed.
              </p>
            </>
          ),
        },
      ]}
    />
  )
}

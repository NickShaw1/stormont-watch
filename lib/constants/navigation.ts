import {
  Home, Users, Users2, Scale, Vote, BarChart3, Building2,
  Receipt, Wallet, MessageCircleQuestion, CalendarDays, MapPin,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  footerLabel?: string
  footerOrder?: number
}

export const HOME_LINK: NavItem = { href: '/', label: 'Home', icon: Home }

export const PRIMARY_LINKS: NavItem[] = [
  { href: '/assembly/mlas', label: 'MLAs', icon: Users, footerLabel: 'MLAs', footerOrder: 1 },
  { href: '/assembly/parties', label: 'Parties', icon: Users2, footerLabel: 'Parties', footerOrder: 2 },
  { href: '/assembly/constituencies', label: 'Constituencies', icon: MapPin },
  { href: '/assembly/bills', label: 'Legislation', icon: Scale, footerLabel: 'Bills', footerOrder: 4 },
  { href: '/assembly/votes', label: 'Votes', icon: Vote, footerLabel: 'Divisions', footerOrder: 3 },
  { href: '/assembly/stats', label: 'Stats', icon: BarChart3 },
  { href: '/assembly/structure', label: 'Assembly', icon: Building2 },
]

export const ACCOUNTABILITY_LINKS: NavItem[] = [
  { href: '/assembly/expenses', label: 'Expenses', icon: Receipt },
  { href: '/assembly/salaries', label: 'Salaries', icon: Wallet },
  { href: '/assembly/questions', label: 'Questions', icon: MessageCircleQuestion },
  { href: '/assembly/sittings', label: 'Sittings', icon: CalendarDays },
]

export const ABOUT_LINKS = [
  { href: '/about', label: 'Methodology' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/accessibility', label: 'Accessibility' },
]

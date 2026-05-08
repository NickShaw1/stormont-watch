import Link from 'next/link'

interface Props {
  label: string
}

export default function StatsBreadcrumb({ label }: Props) {
  return (
    <nav aria-label="Breadcrumb" className="breadcrumb">
      <ol>
        <li><Link href="/assembly/stats">Statistics</Link></li>
        <li aria-current="page">{label}</li>
      </ol>
    </nav>
  )
}

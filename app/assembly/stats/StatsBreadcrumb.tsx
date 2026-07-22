import Link from 'next/link'

interface Props {
  label: string
  basePath?: string
}

export default function StatsBreadcrumb({ label, basePath = '' }: Props) {
  return (
    <nav aria-label="Breadcrumb" className="breadcrumb">
      <ol>
        <li><Link href={`${basePath}/assembly/stats`}>Statistics</Link></li>
        <li aria-current="page">{label}</li>
      </ol>
    </nav>
  )
}

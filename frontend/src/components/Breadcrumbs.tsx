import React from "react"
import { Link } from "react-router-dom"
import { ChevronRight } from "./icons"

export interface Crumb {
  label: string
  to?: string
}

export const Breadcrumbs = ({ items }: { items: Crumb[] }) => {
  if (!items || items.length === 0) return null
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-gray-500">
        {items.map((item, i) => {
          const isLast = i === items.length - 1
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1">
              {item.to && !isLast ? (
                <Link to={item.to} className="hover:text-blue-600 hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={isLast ? "page" : undefined} className={isLast ? "font-medium text-gray-900" : ""}>
                  {item.label}
                </span>
              )}
              {!isLast && <ChevronRight className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export default Breadcrumbs

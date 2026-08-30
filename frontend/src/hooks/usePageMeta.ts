import React from "react"

const SITE_NAME = "Project Labs"

interface PageMeta {
  title?: string
  description?: string
  /** Absolute or site-root canonical path (e.g. "/solutions") */
  canonical?: string
  ogTitle?: string
  ogDescription?: string
}

function setMeta(name: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (!tag) {
    tag = document.createElement("meta")
    tag.setAttribute("name", name)
    document.head.appendChild(tag)
  }
  tag.setAttribute("content", content)
}

function setProperty(property: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[property="${property}"]`)
  if (!tag) {
    tag = document.createElement("meta")
    tag.setAttribute("property", property)
    document.head.appendChild(tag)
  }
  tag.setAttribute("content", content)
}

function removeMetaByProperty(property: string) {
  document.head.querySelectorAll<HTMLMetaElement>(`meta[property="${property}"]`).forEach((n) => n.remove())
}

/**
 * Lightweight per-route SEO/metadata manager (no external dependency).
 * Sets the document title plus description / Open Graph / Twitter /
 * canonical tags, and restores sensible defaults on unmount.
 */
export function usePageMeta(meta: PageMeta = {}) {
  const { title, description, canonical, ogTitle, ogDescription } = meta

  React.useLayoutEffect(() => {
    const baseTitle = title ? `${title} · ${SITE_NAME}` : SITE_NAME
    document.title = baseTitle
    setMeta("description", description || "")

    // Open Graph
    if (ogTitle || title) setProperty("og:title", ogTitle || title || "")
    if (ogDescription || description) setProperty("og:description", ogDescription || description || "")
    setProperty("og:site_name", SITE_NAME)
    setProperty("og:type", "website")
    if (canonical) setProperty("og:url", canonical)

    // Twitter
    setMeta("twitter:card", "summary")
    if (ogTitle || title) setMeta("twitter:title", ogTitle || title || "")
    if (ogDescription || description) setMeta("twitter:description", ogDescription || description || "")

    // Canonical link
    let canonicalLink = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonicalLink) {
      canonicalLink = document.createElement("link")
      canonicalLink.setAttribute("rel", "canonical")
      document.head.appendChild(canonicalLink)
    }
    canonicalLink.setAttribute("href", canonical || window.location.origin + window.location.pathname)

    return () => {
      // No teardown required; next route overwrites. Kept for parity/clarity.
    }
  }, [title, description, canonical, ogTitle, ogDescription])
}

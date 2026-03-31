'use client'

import { useState, useMemo } from 'react'
import { Copy, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { useTheme } from '@/lib/theme'

export interface SharedPrompt {
  id: string
  prompt_title: string
  prompt_content: string
  prompt_description: string | null
  tags: string[]
  compatible_models: string[]
  shared_by_name: string | null
  creator_name: string | null
  view_count: number
  created_at: string
}

function extractVariables(content: string): string[] {
  const matches = content.match(/\{\{(\w+)\}\}/g) ?? []
  const seen = new Set<string>()
  return matches
    .map((m) => m.slice(2, -2))
    .filter((v) => {
      if (seen.has(v)) return false
      seen.add(v)
      return true
    })
}

function applyVariables(content: string, values: Record<string, string>): string {
  return content.replace(/\{\{(\w+)\}\}/g, (_, name) => values[name] ?? `{{${name}}}`)
}

/**
 * Renders prompt content with {{variable}} tokens highlighted.
 * Tokenizes against the original template so filled values are also highlighted.
 */
function renderHighlighted(
  originalContent: string,
  values: Record<string, string>,
  dark: boolean
): React.ReactNode[] {
  const tokenPattern = /(\{\{\w+\}\})/g
  const parts = originalContent.split(tokenPattern)
  return parts.map((part, i) => {
    if (/^\{\{\w+\}\}$/.test(part)) {
      const varName = part.slice(2, -2)
      const filled = values[varName]
      const display = filled || part
      return (
        <span
          key={i}
          style={{
            color: '#a78bfa',
            background: dark ? 'rgba(167,139,250,0.12)' : 'rgba(98,95,255,0.10)',
            borderRadius: '4px',
            padding: '1px 4px',
            fontWeight: filled ? 500 : 600,
          }}
        >
          {display}
        </span>
      )
    }
    return part
  })
}

function getAttribution(creator: string | null, sharer: string | null): string {
  const creatorLabel = creator ?? '---'
  const sharerLabel = sharer ?? '---'
  if (creator === 'Browser Hub') {
    return `Created by Browser Hub · Shared by ${sharerLabel}`
  }
  if (creator === sharer || (!creator && !sharer)) {
    return `Created and Shared by ${creatorLabel}`
  }
  if (!creator) return `Shared by ${sharerLabel}`
  return `Created by ${creatorLabel} · Shared by ${sharerLabel}`
}

const PRIMARY = '#625fff'
const PRIMARY_HOVER = '#7c6fff'
const PRIMARY_LIGHT = '#a78bfa'

export default function SharedPromptClient({ prompt }: { prompt: SharedPrompt }) {
  const { resolvedTheme } = useTheme()
  const dark = resolvedTheme === 'dark'

  const variables = useMemo(() => extractVariables(prompt.prompt_content), [prompt.prompt_content])
  const hasVariables = variables.length > 0

  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(variables.map((v) => [v, '']))
  )
  const [copied, setCopied] = useState(false)
  const [showRaw, setShowRaw] = useState(false)
  const [copyBtnHovered, setCopyBtnHovered] = useState(false)
  const [rawToggleHovered, setRawToggleHovered] = useState(false)
  const [footerLinkHovered, setFooterLinkHovered] = useState(false)

  const finalContent = useMemo(
    () => applyVariables(prompt.prompt_content, values),
    [prompt.prompt_content, values]
  )

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formattedDate = new Date(prompt.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  // Theme-dependent style values
  const cardStyle = dark
    ? {
        background: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 0 80px rgba(98,95,255,0.15), 0 24px 64px rgba(0,0,0,0.4)',
      }
    : {
        background: '#ffffff',
        border: '1px solid rgba(0,0,0,0.07)',
        boxShadow: '0 4px 32px rgba(98,95,255,0.10), 0 1px 8px rgba(0,0,0,0.05)',
      }

  const titleColor = dark ? '#ffffff' : '#1c1917'
  const descColor = dark ? 'rgba(255,255,255,0.55)' : '#57534e'
  const dividerColor = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'
  const sectionLabelColor = dark ? 'rgba(255,255,255,0.35)' : '#78716c'
  const tagBg = dark ? 'rgba(255,255,255,0.07)' : '#f5f5f4'
  const tagColor = dark ? 'rgba(255,255,255,0.5)' : '#78716c'
  const dateColor = dark ? 'rgba(255,255,255,0.3)' : '#a8a29e'
  const inputStyle = dark
    ? { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }
    : { background: '#fafaf9', border: '1px solid rgba(0,0,0,0.1)', color: '#1c1917' }
  const codeBlockStyle = dark
    ? { background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.75)' }
    : { background: '#fafaf9', border: '1px solid rgba(0,0,0,0.07)', color: '#292524' }
  const footerBg = dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
  const viewCountColor = dark ? 'rgba(255,255,255,0.28)' : '#a8a29e'
  const rawToggleColor = rawToggleHovered
    ? (dark ? 'rgba(255,255,255,0.55)' : '#57534e')
    : (dark ? 'rgba(255,255,255,0.28)' : '#c0bbb7')

  const hasAttribution = !!(prompt.creator_name || prompt.shared_by_name)

  return (
    <div className="rounded-3xl overflow-hidden" style={cardStyle}>
      {/* Header */}
      <div className="px-6 pt-7 pb-5">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-3xl font-bold leading-tight" style={{ color: titleColor }}>
            {prompt.prompt_title}
          </h1>
          {!hasVariables && (
            <button
              onClick={() => handleCopy(prompt.prompt_content)}
              onMouseEnter={() => setCopyBtnHovered(true)}
              onMouseLeave={() => setCopyBtnHovered(false)}
              className="shrink-0 flex items-center gap-1.5 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
              style={{ background: copyBtnHovered ? PRIMARY_HOVER : PRIMARY }}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          )}
        </div>

        {prompt.prompt_description && (
          <p className="mt-2.5 text-sm leading-relaxed" style={{ color: descColor }}>
            {prompt.prompt_description}
          </p>
        )}

        {/* Meta row */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {prompt.compatible_models.map((model) => (
            <span
              key={model}
              className="text-xs px-2.5 py-0.5 rounded-full font-medium"
              style={{
                background: 'rgba(98,95,255,0.15)',
                color: PRIMARY_LIGHT,
                border: '1px solid rgba(98,95,255,0.25)',
              }}
            >
              {model}
            </span>
          ))}
          {prompt.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs px-2.5 py-0.5 rounded-full"
              style={{ background: tagBg, color: tagColor }}
            >
              #{tag}
            </span>
          ))}
          <span className="text-xs ml-auto" style={{ color: dateColor }}>
            {formattedDate}
          </span>
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${dividerColor}` }} />

      {hasVariables ? (
        /* Interactive variable fill-in mode */
        <div className="p-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left: variable inputs */}
            <div className="lg:w-1/3 shrink-0">
              <h2
                className="text-[10px] font-semibold uppercase tracking-widest mb-3"
                style={{ color: sectionLabelColor }}
              >
                Fill in variables
              </h2>
              <div className="flex flex-col gap-3">
                {variables.map((variable) => (
                  <div key={variable}>
                    <label
                      className="block text-xs font-mono mb-1.5"
                      style={{ color: PRIMARY_LIGHT }}
                    >
                      {variable}
                    </label>
                    <input
                      type="text"
                      value={values[variable] ?? ''}
                      onChange={(e) =>
                        setValues((prev) => ({ ...prev, [variable]: e.target.value }))
                      }
                      placeholder={`Enter ${variable}…`}
                      className="w-full text-sm rounded-xl px-3 py-2 outline-none transition-all"
                      style={{
                        ...inputStyle,
                        caretColor: PRIMARY,
                      }}
                      onFocus={(e) => {
                        e.target.style.border = `1px solid ${PRIMARY}`
                        e.target.style.boxShadow = `0 0 0 3px rgba(98,95,255,0.15)`
                      }}
                      onBlur={(e) => {
                        e.target.style.border = inputStyle.border
                        e.target.style.boxShadow = 'none'
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Right: live preview */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-3">
                <h2
                  className="text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: sectionLabelColor }}
                >
                  Preview
                </h2>
                <CopyButton
                  onClick={() => handleCopy(finalContent)}
                  copied={copied}
                  label="Copy Result"
                  primary={PRIMARY}
                  primaryHover={PRIMARY_HOVER}
                />
              </div>
              <div
                className="rounded-2xl p-4 text-sm whitespace-pre-wrap leading-relaxed min-h-[120px] font-mono"
                style={codeBlockStyle}
              >
                {renderHighlighted(prompt.prompt_content, values, dark)}
              </div>
            </div>
          </div>

          {/* Raw prompt toggle */}
          <div className="mt-5">
            <button
              onClick={() => setShowRaw((v) => !v)}
              onMouseEnter={() => setRawToggleHovered(true)}
              onMouseLeave={() => setRawToggleHovered(false)}
              className="flex items-center gap-1 text-xs transition-colors"
              style={{ color: rawToggleColor }}
            >
              {showRaw ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {showRaw ? 'Hide raw prompt' : 'Show raw prompt'}
            </button>
            {showRaw && (
              <div
                className="mt-2 rounded-2xl p-4 text-xs whitespace-pre-wrap font-mono"
                style={{
                  ...codeBlockStyle,
                  color: dark ? 'rgba(255,255,255,0.4)' : '#a8a29e',
                }}
              >
                {renderHighlighted(prompt.prompt_content, {}, dark)}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Plain content mode */
        <div className="p-6">
          <div
            className="rounded-2xl p-4 text-sm whitespace-pre-wrap leading-relaxed font-mono"
            style={codeBlockStyle}
          >
            {renderHighlighted(prompt.prompt_content, {}, dark)}
          </div>
        </div>
      )}

      {/* Footer */}
      <div
        className="px-6 py-3.5 flex items-center justify-between gap-4"
        style={{ borderTop: `1px solid ${dividerColor}`, background: footerBg }}
      >
        <div className="flex items-center gap-3 text-xs min-w-0" style={{ color: viewCountColor }}>
          <span className="flex items-center gap-1 shrink-0">
            <span>👁</span>
            <span>
              {prompt.view_count.toLocaleString()} view{prompt.view_count !== 1 ? 's' : ''}
            </span>
          </span>
          {hasAttribution && (
            <>
              <span className="opacity-40">·</span>
              <span className="truncate">
                {getAttribution(prompt.creator_name, prompt.shared_by_name)}
              </span>
            </>
          )}
        </div>
        <a
          href="/"
          onMouseEnter={() => setFooterLinkHovered(true)}
          onMouseLeave={() => setFooterLinkHovered(false)}
          className="text-xs font-medium transition-colors shrink-0"
          style={{ color: footerLinkHovered ? '#c4b5fd' : PRIMARY_LIGHT }}
        >
          Made with Browser Hub ✨
        </a>
      </div>
    </div>
  )
}

function CopyButton({
  onClick,
  copied,
  label,
  primary,
  primaryHover,
}: {
  onClick: () => void
  copied: boolean
  label: string
  primary: string
  primaryHover: string
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center gap-1.5 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
      style={{ background: hovered ? primaryHover : primary }}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? 'Copied!' : label}
    </button>
  )
}

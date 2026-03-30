'use client'

import { useState, useMemo } from 'react'
import { Copy, Check, ChevronDown, ChevronUp } from 'lucide-react'

interface SharedPrompt {
  id: string
  prompt_title: string
  prompt_content: string
  prompt_description: string | null
  tags: string[]
  compatible_models: string[]
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

const PRIMARY = '#625fff'
const PRIMARY_HOVER = '#7c6fff'
const PRIMARY_LIGHT = '#a78bfa'

export default function SharedPromptClient({ prompt }: { prompt: SharedPrompt }) {
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

  return (
    <div
      className="rounded-3xl overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 0 80px rgba(98, 95, 255, 0.15), 0 24px 64px rgba(0,0,0,0.4)',
      }}
    >
      {/* Header */}
      <div className="px-6 pt-7 pb-5">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-3xl font-bold text-white leading-tight">
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
          <p className="mt-2.5 text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
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
                background: 'rgba(98, 95, 255, 0.18)',
                color: PRIMARY_LIGHT,
                border: '1px solid rgba(98, 95, 255, 0.3)',
              }}
            >
              {model}
            </span>
          ))}
          {prompt.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs px-2.5 py-0.5 rounded-full"
              style={{
                background: 'rgba(255,255,255,0.07)',
                color: 'rgba(255,255,255,0.5)',
              }}
            >
              #{tag}
            </span>
          ))}
          <span className="text-xs ml-auto" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {formattedDate}
          </span>
        </div>
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }} />

      {hasVariables ? (
        /* Interactive variable fill-in mode */
        <div className="p-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left: variable inputs */}
            <div className="lg:w-1/3 shrink-0">
              <h2
                className="text-[10px] font-semibold uppercase tracking-widest mb-3"
                style={{ color: 'rgba(255,255,255,0.4)' }}
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
                      className="w-full text-sm rounded-xl px-3 py-2 text-white placeholder-white/20 outline-none transition-all"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                      }}
                      onFocus={(e) => {
                        e.target.style.border = `1px solid ${PRIMARY}`
                        e.target.style.boxShadow = `0 0 0 3px rgba(98, 95, 255, 0.15)`
                      }}
                      onBlur={(e) => {
                        e.target.style.border = '1px solid rgba(255,255,255,0.1)'
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
                  style={{ color: 'rgba(255,255,255,0.4)' }}
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
                style={{
                  background: 'rgba(0,0,0,0.25)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  color: 'rgba(255,255,255,0.75)',
                }}
              >
                {finalContent}
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
              style={{ color: rawToggleHovered ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.28)' }}
            >
              {showRaw ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {showRaw ? 'Hide raw prompt' : 'Show raw prompt'}
            </button>
            {showRaw && (
              <div
                className="mt-2 rounded-2xl p-4 text-xs whitespace-pre-wrap font-mono"
                style={{
                  background: 'rgba(0,0,0,0.25)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  color: 'rgba(255,255,255,0.45)',
                }}
              >
                {prompt.prompt_content}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Plain content mode */
        <div className="p-6">
          <div
            className="rounded-2xl p-4 text-sm whitespace-pre-wrap leading-relaxed font-mono"
            style={{
              background: 'rgba(0,0,0,0.25)',
              border: '1px solid rgba(255,255,255,0.07)',
              color: 'rgba(255,255,255,0.75)',
            }}
          >
            {prompt.prompt_content}
          </div>
        </div>
      )}

      {/* Footer */}
      <div
        className="px-6 py-3.5 flex items-center justify-between"
        style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>
          <span>👁</span>
          <span>
            {prompt.view_count.toLocaleString()} view{prompt.view_count !== 1 ? 's' : ''}
          </span>
        </div>
        <a
          href="/"
          onMouseEnter={() => setFooterLinkHovered(true)}
          onMouseLeave={() => setFooterLinkHovered(false)}
          className="text-xs font-medium transition-colors"
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

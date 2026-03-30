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

export default function SharedPromptClient({ prompt }: { prompt: SharedPrompt }) {
  const variables = useMemo(() => extractVariables(prompt.prompt_content), [prompt.prompt_content])
  const hasVariables = variables.length > 0

  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(variables.map((v) => [v, '']))
  )
  const [copied, setCopied] = useState(false)
  const [showRaw, setShowRaw] = useState(false)

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
    <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-sm border border-stone-200 dark:border-stone-700 overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 leading-tight">
            {prompt.prompt_title}
          </h1>
          {!hasVariables && (
            <button
              onClick={() => handleCopy(prompt.prompt_content)}
              className="shrink-0 flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          )}
        </div>

        {prompt.prompt_description && (
          <p className="mt-2 text-stone-600 dark:text-stone-400 text-sm leading-relaxed">
            {prompt.prompt_description}
          </p>
        )}

        {/* Meta row */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {prompt.compatible_models.map((model) => (
            <span
              key={model}
              className="text-xs bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full font-medium"
            >
              {model}
            </span>
          ))}
          {prompt.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-400 px-2 py-0.5 rounded-full"
            >
              #{tag}
            </span>
          ))}
          <span className="text-xs text-stone-400 ml-auto">{formattedDate}</span>
        </div>
      </div>

      <div className="border-t border-stone-200 dark:border-stone-700" />

      {hasVariables ? (
        /* Interactive variable fill-in mode */
        <div className="p-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left: variable inputs */}
            <div className="lg:w-1/3 shrink-0">
              <h2 className="text-sm font-semibold text-stone-700 dark:text-stone-300 mb-3 uppercase tracking-wide">
                Fill in variables
              </h2>
              <div className="flex flex-col gap-3">
                {variables.map((variable) => (
                  <div key={variable}>
                    <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">
                      {variable}
                    </label>
                    <input
                      type="text"
                      value={values[variable] ?? ''}
                      onChange={(e) =>
                        setValues((prev) => ({ ...prev, [variable]: e.target.value }))
                      }
                      placeholder={`Enter ${variable}…`}
                      className="w-full text-sm border border-stone-200 dark:border-stone-600 rounded-lg px-3 py-2 bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Right: live preview */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wide">
                  Preview
                </h2>
                <button
                  onClick={() => handleCopy(finalContent)}
                  className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copied!' : 'Copy Result'}
                </button>
              </div>
              <div className="bg-stone-50 dark:bg-stone-900 rounded-xl p-4 text-sm text-stone-800 dark:text-stone-200 whitespace-pre-wrap leading-relaxed min-h-[120px] font-mono border border-stone-200 dark:border-stone-700">
                {finalContent}
              </div>
            </div>
          </div>

          {/* Raw prompt toggle */}
          <div className="mt-4">
            <button
              onClick={() => setShowRaw((v) => !v)}
              className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
            >
              {showRaw ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {showRaw ? 'Hide raw prompt' : 'Show raw prompt'}
            </button>
            {showRaw && (
              <div className="mt-2 bg-stone-50 dark:bg-stone-900 rounded-xl p-4 text-xs text-stone-500 dark:text-stone-400 whitespace-pre-wrap font-mono border border-stone-200 dark:border-stone-700">
                {prompt.prompt_content}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Plain content mode */
        <div className="p-6">
          <div className="bg-stone-50 dark:bg-stone-900 rounded-xl p-4 text-sm text-stone-800 dark:text-stone-200 whitespace-pre-wrap leading-relaxed font-mono border border-stone-200 dark:border-stone-700">
            {prompt.prompt_content}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-stone-200 dark:border-stone-700 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-stone-400">
          <span>👁</span>
          <span>{prompt.view_count.toLocaleString()} view{prompt.view_count !== 1 ? 's' : ''}</span>
        </div>
        <a
          href="/"
          className="text-xs text-amber-500 hover:text-amber-600 font-medium transition-colors"
        >
          Made with Browser Hub ✨
        </a>
      </div>
    </div>
  )
}

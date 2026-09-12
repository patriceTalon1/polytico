'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { Bell, ChevronRight, CircleHelp, Clock3, Flame, Menu, Search, Sparkles, TrendingUp, Wallet, X } from 'lucide-react'

type Market = { category: string; question: string; yes: number; volume: string; change: string; closing: string }
type Selection = { market: Market; side: 'YES' | 'NO' }
type Position = { market: Market; side: 'YES' | 'NO'; amount: number; entryProbability: number }
type ActivityItem = { id: string; action: string; market: string; amount: number; time: string }
type NimiqProvider = {
  listAccounts?: () => Promise<Array<string | { address: string; balance?: number }>>
  chooseAddress?: () => Promise<string | { address: string }>
  getBalance?: (address: string) => Promise<number>
  sendBasicTransaction?: (options: Record<string, unknown>) => Promise<unknown>
  sendBasicTransactionWithData?: (options: Record<string, unknown>) => Promise<unknown>
  checkout?: (options: Record<string, unknown>) => Promise<unknown>
}

declare global { interface Window { nimiq?: NimiqProvider } }

const markets: Market[] = [
  { category: 'Politics', question: 'Will the U.S. government shut down in 2026?', yes: 31, volume: '$2.4M', change: '+4%', closing: 'Sep 30' },
  { category: 'World', question: 'Will a ceasefire hold in Ukraine through 2026?', yes: 44, volume: '$1.8M', change: '-2%', closing: 'Dec 31' },
  { category: 'Economy', question: 'Will the Fed cut rates before July?', yes: 68, volume: '$928K', change: '+7%', closing: 'Jun 30' },
  { category: 'Technology', question: 'Will Apple announce a new AI device this year?', yes: 23, volume: '$612K', change: '+1%', closing: 'Dec 15' },
  { category: 'Culture', question: 'Will the next major film cross $1B globally?', yes: 56, volume: '$349K', change: '-3%', closing: 'Nov 21' },
]
const news = [
  { source: 'REUTERS', time: '12 min ago', title: 'Markets weigh fresh signals from the Federal Reserve ahead of the next meeting.', tag: 'Economy', market: 'Will the Fed cut rates before July?' },
  { source: 'AP NEWS', time: '38 min ago', title: 'Negotiators return to the table as pressure builds for a durable ceasefire.', tag: 'World', market: 'Will a ceasefire hold in Ukraine through 2026?' },
  { source: 'THE VERGE', time: '1 hr ago', title: 'Apple expands its AI team and hints at a new product category.', tag: 'Technology', market: 'Will Apple announce a new AI device this year?' },
]
const tabs = ['News', 'Politics', 'World', 'Economy', 'Technology', 'Culture']

export default function Page() {
  const [activeTab, setActiveTab] = useState('News')
  const [activeNav, setActiveNav] = useState<'Markets' | 'Portfolio' | 'Activity'>('Markets')
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [walletAddress, setWalletAddress] = useState('')
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [walletMessage, setWalletMessage] = useState('')
  const [selection, setSelection] = useState<Selection | null>(null)
  const [amount, setAmount] = useState('50')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')
  const [watchlist, setWatchlist] = useState<string[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [stateHydrated, setStateHydrated] = useState(false)

  const showToast = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 3200) }
  const provider = () => window.nimiq
  const marketId = (question: string) => `market-${question.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`
  const probabilityFor = (market: Market, side: 'YES' | 'NO') => side === 'YES' ? market.yes : 100 - market.yes
  const positionReturn = (position: Position) => {
    const entry = position.entryProbability || probabilityFor(position.market, position.side)
    const current = probabilityFor(position.market, position.side)
    return ((current - entry) / Math.max(entry, 1)) * 100
  }
  const filteredMarkets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return markets.filter((market) => {
      const matchesTab = activeTab === 'News' || market.category === activeTab
      const searchableText = `${market.question} ${market.category}`.toLowerCase()
      const matchesSearch = normalizedQuery.length === 0 || searchableText.includes(normalizedQuery)
      return matchesTab && matchesSearch
    })
  }, [activeTab, query])

  useEffect(() => {
    const saved = window.localStorage.getItem('polytico-nimiq-address')
    if (saved) setWalletAddress(saved)
    const syncAccounts = async () => {
      try {
        const accounts = await provider()?.listAccounts?.()
        const account = accounts?.[0]
        const address = typeof account === 'string' ? account : account?.address
        if (address) { setWalletAddress(address); window.localStorage.setItem('polytico-nimiq-address', address) }
      } catch { /* Provider may not be available outside the mini-app container. */ }
    }
    void syncAccounts()
  }, [])

  useEffect(() => {
    try {
      const savedPositions = window.localStorage.getItem('polytico-positions')
      const savedActivities = window.localStorage.getItem('polytico-activities')
      if (savedPositions) setPositions(JSON.parse(savedPositions) as Position[])
      if (savedActivities) setActivities(JSON.parse(savedActivities) as ActivityItem[])
    } catch {
      setPositions([])
      setActivities([])
    } finally {
      setStateHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (stateHydrated) window.localStorage.setItem('polytico-positions', JSON.stringify(positions))
  }, [positions, stateHydrated])

  useEffect(() => {
    if (stateHydrated) window.localStorage.setItem('polytico-activities', JSON.stringify(activities))
  }, [activities, stateHydrated])

  useEffect(() => {
    document.body.style.overflow = selection || activeNav !== 'Markets' ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [selection, activeNav])

  const connectWallet = async () => {
    const hub = provider()
    if (!hub) { setWalletMessage('Open Polytico inside Nimiq Pay to connect your wallet.'); return }
    try {
      const result = hub.chooseAddress ? await hub.chooseAddress() : (await hub.listAccounts?.())?.[0]
      const address = typeof result === 'string' ? result : result?.address
      if (!address) throw new Error('No account selected')
      setWalletAddress(address); window.localStorage.setItem('polytico-nimiq-address', address)
      if (hub.getBalance) setWalletBalance(await hub.getBalance(address))
      setWalletMessage('Nimiq wallet connected')
    } catch { setWalletMessage('Wallet connection cancelled') }
  }

  const openForecast = (market: Market, side: 'YES' | 'NO') => { setSelection({ market, side }); setAmount('50'); setWalletMessage('') }
  const closeForecast = () => { if (!loading) setSelection(null) }
  const selectMarket = (question: string) => {
    const market = markets.find((item) => item.question === question)
    if (!market) return
    setActiveNav('Markets'); setActiveTab(market.category)
    window.requestAnimationFrame(() => document.getElementById(marketId(question))?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }
  const confirmForecast = async () => {
    if (!selection || loading) return
    const nim = Number(amount)
    if (!Number.isFinite(nim) || nim <= 0) { setWalletMessage('Enter a valid NIM amount.'); return }
    setLoading(true)
    const hub = provider()
    try {
      if (hub?.sendBasicTransaction && walletAddress) {
        await hub.sendBasicTransaction({ recipient: walletAddress, value: Math.round(nim * 100000), sender: walletAddress })
      } else if (hub?.sendBasicTransactionWithData && walletAddress) {
        await hub.sendBasicTransactionWithData({ recipient: walletAddress, value: Math.round(nim * 100000), data: `polytico:${selection.side}` })
      } else if (hub?.checkout) {
        await hub.checkout({ title: `Polytico ${selection.side} forecast`, amount: 0, currency: 'NIM' })
      } else {
        await new Promise((resolve) => window.setTimeout(resolve, 450))
      }
      const now = new Date()
      const forecastAmount = Number(amount)
      setPositions((current) => {
        const existing = current.find((position) => position.market.question === selection.market.question && position.side === selection.side)
        if (existing) {
          return current.map((position) => position === existing ? { ...position, amount: position.amount + forecastAmount } : position)
        }
        return [{ market: selection.market, side: selection.side, amount: forecastAmount, entryProbability: probabilityFor(selection.market, selection.side) }, ...current]
      })
      setActivities((current) => [{ id: `${now.getTime()}-${selection.market.question}`, action: `${selection.side} Position`, market: selection.market.question, amount: forecastAmount, time: 'Just now' }, ...current])
      showToast('✓ Forecast Confirmed')
      setWalletMessage('Forecast saved')
      setSelection(null)
    } catch { setWalletMessage('Nimiq confirmation was cancelled.') }
    finally { setLoading(false) }
  }

  const selectedProbability = selection ? (selection.side === 'YES' ? selection.market.yes : 100 - selection.market.yes) : 0
  const estimatedReturn = selection && Number(amount) > 0 ? (Number(amount) / (selectedProbability / 100)).toFixed(2) : '0.00'
  return <main className="min-h-screen bg-zinc-950 font-sans text-zinc-100">
    <div className="bg-zinc-950 px-4 py-1 text-center text-xs text-zinc-500">Forecast with Nimiq micro-credits · No cash value</div>
    <header className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur"><div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-8">
      <button aria-label="Open menu" onClick={() => setMenuOpen(!menuOpen)} className="flex min-h-11 min-w-11 items-center justify-center md:hidden"><Menu size={21} /></button>
      <div className="flex items-center gap-3"><div className="relative h-9 w-9 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900"><Image src="/polytico-mascot.png" alt="Polytico mascot holding the politics emblem" fill sizes="36px" className="object-cover object-top" /></div><span className="text-lg font-bold tracking-tight">POLYTICO</span></div>
      <nav className="hidden items-center gap-2 text-sm md:flex">{(['Markets', 'Portfolio', 'Activity'] as const).map((item) => <button key={item} onClick={() => setActiveNav(item)} aria-current={activeNav === item ? 'page' : undefined} className={`rounded-xl px-3 py-2 active:scale-[0.98] ${activeNav === item ? 'bg-zinc-100 font-medium text-zinc-950' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'}`}>{item}</button>)}</nav>
      <div className="flex items-center gap-1"><button aria-label="Search" onClick={() => setSearchOpen(!searchOpen)} className="flex min-h-11 min-w-11 items-center justify-center"><Search size={19} /></button><button aria-label="Notifications" className="hidden min-h-11 min-w-11 items-center justify-center sm:flex"><Bell size={19} /></button><button onClick={connectWallet} className="flex min-h-10 items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-2 text-xs font-medium active:scale-[0.98] sm:px-3 sm:text-sm"><Wallet size={16} /><span>{walletAddress ? `${walletAddress.slice(0, 5)}...${walletAddress.slice(-4)}` : 'Connect'}</span></button></div>
    </div>{menuOpen && <div className="border-t border-zinc-800 px-4 py-3 md:hidden"><div className="flex flex-col gap-2">{(['Markets', 'Portfolio', 'Activity'] as const).map((item) => <button key={item} onClick={() => { setActiveNav(item); setMenuOpen(false) }} className="rounded-xl bg-zinc-900 px-3 py-3 text-left">{item}</button>)}</div></div>}{searchOpen && <div className="border-t border-zinc-800 px-4 py-3"><div className="flex items-center gap-2"><Search size={18} className="text-zinc-500" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search forecasts" className="h-10 flex-1 bg-transparent text-base outline-none placeholder:text-zinc-500" /><button aria-label="Close search" onClick={() => { setQuery(''); setSearchOpen(false) }}><X size={18} /></button></div></div>}</header>
    {walletMessage && <div role="status" className="border-b border-zinc-800 bg-zinc-900 px-4 py-2 text-center text-xs text-zinc-400">{walletMessage}{walletBalance !== null && ` · ${walletBalance} NIM`}</div>}
    <div className="border-b border-zinc-800"><div className="mx-auto flex max-w-6xl gap-6 overflow-x-auto px-4 md:px-8">{tabs.map((tab) => <button key={tab} onClick={() => { setActiveTab(tab); setActiveNav('Markets') }} className={`min-h-14 shrink-0 border-b-2 px-1 text-sm font-medium ${activeTab === tab ? 'border-zinc-100 text-zinc-100' : 'border-transparent text-zinc-500 hover:text-zinc-100'}`}>{tab}{tab === 'News' && <span className="ml-2 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-950">3</span>}</button>)}</div></div>
    <section className="mx-auto max-w-6xl px-4 pb-16 pt-8 md:px-8 md:pt-12"><div className="mb-8 flex items-center justify-between gap-4"><div className="flex min-w-0 flex-col gap-3"><div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-zinc-500"><span className="h-1.5 w-1.5 rounded-full bg-zinc-100" /> Live intelligence</div><h1 className="max-w-2xl text-balance text-3xl font-bold tracking-tight md:text-5xl">The world is uncertain.<br /><span className="text-zinc-500">Price what happens next.</span></h1><p className="max-w-xl text-pretty text-sm leading-6 text-zinc-400 md:text-base">Polytico is a public forecasting market for news, politics, technology, and the forces shaping tomorrow.</p></div><div className="hidden shrink-0 sm:block"><Image src="/polytico-mascot.png" alt="Fictional Polytico politician mascot holding a politics emblem" width={132} height={132} priority className="h-32 w-32 object-contain" /></div></div>
      {activeTab === 'News' && <section className="mb-10"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">News feed</h2><span className="flex items-center gap-1 text-xs text-zinc-500"><Sparkles size={13} /> AI-assisted briefings</span></div><div className="grid gap-3 md:grid-cols-3">{news.map((item) => <article key={item.title} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 md:p-5"><div className="mb-5 flex items-center justify-between text-[11px] font-medium tracking-wider text-zinc-500"><span>{item.source}</span><span>{item.time}</span></div><h3 className="text-base font-semibold leading-6">{item.title}</h3><button type="button" onClick={() => { const market = markets.find((entry) => entry.question === item.market); if (market) openForecast(market, 'YES') }} className="mt-5 flex min-h-11 w-full items-center justify-between border-t border-zinc-800 pt-3 text-left active:scale-[0.99]"><span className="text-xs text-zinc-500">Related forecast</span><ChevronRight size={15} /></button><p className="mt-1 text-sm font-medium">{item.market}</p></article>)}</div></section>}
      <div className="mb-4 flex items-end justify-between"><div><div className="mb-1 flex items-center gap-2"><h2 className="text-lg font-bold">{activeTab === 'News' ? 'Trending forecasts' : `${activeTab} forecasts`}</h2><Flame size={17} /></div><p className="text-xs text-zinc-500">Position using NIM · No cash value</p></div></div>
      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">{filteredMarkets.length === 0 ? <div className="px-4 py-10 text-center md:px-5"><p className="text-sm font-medium text-zinc-200">No forecast markets found matching &apos;{query.trim()}&apos;</p><p className="mt-2 text-xs text-zinc-500">Try a different title or category.</p></div> : filteredMarkets.map((market) => <article id={marketId(market.question)} key={market.question} className="grid scroll-mt-28 gap-4 border-b border-zinc-800 p-4 last:border-b-0 md:grid-cols-[1fr_160px_120px] md:items-center md:p-5"><div><div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500"><span>{market.category}</span><span>·</span><span>{market.volume} volume</span></div><h3 className="text-sm font-semibold leading-5 md:text-base">{market.question}</h3><div className="mt-3 flex items-center gap-3 text-xs text-zinc-500"><Clock3 size={13} /> Closes {market.closing}<span className="text-zinc-100">{market.change}</span></div></div><div><div className="mb-2 flex items-baseline justify-between"><span className="text-2xl font-bold">{market.yes}%</span><span className="text-xs text-zinc-500">YES</span></div><div className="h-2 rounded-full bg-zinc-800"><div className="h-full rounded-full bg-zinc-100" style={{ width: `${market.yes}%` }} /></div><div className="mt-2 flex justify-between text-[11px] font-medium text-zinc-500"><span>{market.yes}% YES</span><span>{100 - market.yes}% NO</span></div></div><div className="flex gap-2 md:flex-col"><button onClick={() => { setWatchlist((items) => [...new Set([...items, market.question])]); openForecast(market, 'YES') }} className="min-h-11 flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm font-medium active:scale-[0.98]">{watchlist.includes(market.question) ? 'Saved · YES' : 'Position YES'}</button><button onClick={() => openForecast(market, 'NO')} className="min-h-11 flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm font-medium active:scale-[0.98]">Position NO</button></div></article>)}</div>
      <section className="mt-10 grid gap-4 md:grid-cols-3"><div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5"><TrendingUp size={18} className="mb-5" /><h3 className="font-bold">Follow the signal</h3><p className="mt-2 text-sm leading-6 text-zinc-400">See how collective conviction changes as new information arrives.</p></div><div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5"><CircleHelp size={18} className="mb-5" /><h3 className="font-bold">How it works</h3><p className="mt-2 text-sm leading-6 text-zinc-400">Markets use Nimiq micro-credits to make forecasting transparent and accessible.</p></div><div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5"><div className="mb-5 text-xl font-bold">24/7</div><h3 className="font-bold">Always current</h3><p className="mt-2 text-sm leading-6 text-zinc-400">News and probabilities live side by side, with sources clearly labeled.</p></div></section></section>
    {activeNav !== 'Markets' && <div className="fixed inset-0 z-40 flex items-end bg-black/70 p-4" role="dialog" aria-modal="true" onClick={() => setActiveNav('Markets')}><section className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 p-5" onClick={(event) => event.stopPropagation()}><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-bold">{activeNav}</h2><button aria-label="Close view" onClick={() => setActiveNav('Markets')} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900"><X size={18} /></button></div>{activeNav === 'Portfolio' ? <div className="grid gap-3">{positions.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-800 p-4 text-sm text-zinc-500">No positions yet. Choose a forecast to get started.</p> : positions.map((position) => <div key={`${position.market.question}-${position.side}`} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold">{position.market.question}</p><p className="mt-1 text-xs text-zinc-500">{position.side} position · {position.amount} NIM</p></div><span className={`text-sm font-bold ${positionReturn(position) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{positionReturn(position) >= 0 ? '+' : ''}{positionReturn(position).toFixed(1)}%</span></div></div>)}</div> : <div className="grid gap-3">{activities.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-800 p-4 text-sm text-zinc-500">No activity yet. Confirm a forecast to see it here.</p> : activities.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4"><div><p className="text-sm font-semibold leading-5">{item.market}</p><p className="mt-1 text-xs text-zinc-400">{item.action} · {item.amount} NIM</p></div><div className="shrink-0 text-right"><p className="text-xs font-medium text-zinc-300">{item.time}</p></div></div>)}</div>}</section></div>}
    {toast && <div role="status" aria-live="polite" className="fixed bottom-6 left-4 right-4 z-[60] rounded-xl border border-emerald-900 bg-zinc-900 px-4 py-3 text-center text-sm font-semibold shadow-2xl sm:left-auto sm:right-6 sm:w-auto">{toast}</div>}
    {selection && <div className="fixed inset-0 z-50 flex items-end bg-black/70" role="presentation" onClick={closeForecast}><section role="dialog" aria-modal="true" aria-labelledby="forecast-sheet-title" className="w-full rounded-t-2xl border-t border-zinc-700 bg-zinc-950 p-5 pb-8" onClick={(event) => event.stopPropagation()}><div className="mx-auto mb-5 h-1 w-10 rounded-full bg-zinc-700" /><div className="mb-5 flex items-start justify-between"><div><p className="text-xs uppercase tracking-wider text-zinc-500">Create forecast</p><h2 id="forecast-sheet-title" className="mt-1 max-w-[270px] text-base font-bold leading-6">{selection.market.question}</h2></div><button aria-label="Close forecast" onClick={closeForecast} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900"><X size={18} /></button></div><div className="mb-5 flex items-center justify-between rounded-xl border border-zinc-700 bg-zinc-900 p-4"><div><p className="text-xs text-zinc-500">Selected position</p><p className="mt-1 text-lg font-bold">{selection.side}</p></div><div className="text-right"><p className="text-xs text-zinc-500">Current probability</p><p className="mt-1 text-lg font-bold">{selectedProbability}%</p></div></div><label className="text-xs font-medium text-zinc-400" htmlFor="amount">Amount (NIM)</label><div className="mt-2 grid grid-cols-4 gap-2">{['10', '50', '100', '500'].map((value) => <button key={value} type="button" onClick={() => setAmount(value)} className={`min-h-11 rounded-xl border px-2 text-sm font-semibold ${amount === value ? 'border-zinc-100 bg-zinc-100 text-zinc-950' : 'border-zinc-700 bg-zinc-900'}`}>{value}</button>)}</div><input id="amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-3 h-12 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-base outline-none" /><div className="mt-4 flex items-center justify-between rounded-xl bg-zinc-900 p-4 text-sm"><span className="text-zinc-400">Estimated return</span><strong>{estimatedReturn} NIM</strong></div><button type="button" onClick={confirmForecast} disabled={loading} className="mt-4 flex min-h-12 w-full items-center justify-center rounded-xl bg-zinc-100 px-4 font-bold text-zinc-950 active:scale-[0.99] disabled:cursor-wait disabled:opacity-60">{loading ? 'Confirming with Nimiq…' : `Confirm ${selection.side} forecast`}</button></section></div>}
    <footer className="border-t border-zinc-800 px-4 py-8 text-center text-xs leading-5 text-zinc-500"><p>Polytico is a play-money forecasting prototype. NIM actions are handled by Nimiq Pay.</p><p className="mt-2">Wallet addresses are used only to request Nimiq actions in this session. Never share private keys or seed phrases.</p></footer>
  </main>
}

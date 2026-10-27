import { useEffect } from 'react'
import { duePayments, fmtMoney } from '@shared/money'
import { useStore } from './store'

/**
 * Records the payments of subscriptions that log themselves, a few seconds after start and when the
 * day changes. Each payment has a fixed id, so two devices doing it at once never add it twice.
 */
export function useSubscriptionPayments(today: string, ready: boolean): void {
  useEffect(() => {
    if (!ready) return
    const t = window.setTimeout(() => {
      const st = useStore.getState()
      const data = st.data
      if (!data) return
      const { txs, done } = duePayments(data, today)
      for (const tx of txs) st.dispatch({ type: 'tx.upsert', item: tx })
      for (const { sub, through } of done) st.dispatch({ type: 'sub.upsert', item: { ...sub, loggedThrough: through } })
      if (txs.length === 1) st.notify(`Registré el pago de ${txs[0]!.note}: ${fmtMoney(txs[0]!.cents, data.settings.currency)}.`)
      else if (txs.length > 1) st.notify(`Registré ${txs.length} pagos de suscripciones.`)
    }, 4500)
    return () => window.clearTimeout(t)
  }, [today, ready])
}

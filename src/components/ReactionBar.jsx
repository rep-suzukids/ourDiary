import { useEffect, useMemo, useRef, useState } from 'react'
import { REACTION_CATALOG, reactionByKey } from '../reactionCatalog.js'
import { getReactions, toggleReaction } from '../services/reactionApi.js'
import '../Reaction.css'

const LONG_PRESS_DELAY = 550

function ReactionBar({ familyId, targetType, targetId }) {
  const rootRef = useRef(null)
  const longPressTimerRef = useRef(null)
  const suppressClickRef = useRef(false)
  const tooltipTimerRef = useRef(null)
  const [reactions, setReactions] = useState([])
  const [recentReactionKeys, setRecentReactionKeys] = useState([])
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [openReactorsKey, setOpenReactorsKey] = useState('')
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    let isActive = true
    setStatus('loading')
    setError('')
    getReactions(familyId, targetType, targetId)
      .then((result) => {
        if (!isActive) return
        setReactions(result.reactions ?? [])
        setRecentReactionKeys(result.recentReactionKeys ?? [])
        setStatus('ready')
      })
      .catch((requestError) => {
        if (!isActive) return
        setError(requestError.message)
        setStatus('error')
      })
    return () => { isActive = false }
  }, [familyId, targetId, targetType])

  useEffect(() => {
    if (!isPickerOpen) return undefined
    const closeFromOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setIsPickerOpen(false)
    }
    document.addEventListener('pointerdown', closeFromOutside)
    return () => document.removeEventListener('pointerdown', closeFromOutside)
  }, [isPickerOpen])

  useEffect(() => {
    const syncRecentOrder = (event) => {
      if (Array.isArray(event.detail)) setRecentReactionKeys(event.detail)
    }
    window.addEventListener('reaction-usage-updated', syncRecentOrder)
    return () => window.removeEventListener('reaction-usage-updated', syncRecentOrder)
  }, [])

  useEffect(() => () => {
    window.clearTimeout(longPressTimerRef.current)
    window.clearTimeout(tooltipTimerRef.current)
  }, [])

  const pickerReactions = useMemo(() => {
    const recentOrder = new Map(recentReactionKeys.map((key, index) => [key, index]))
    return [...REACTION_CATALOG].sort((left, right) => {
      const leftPosition = recentOrder.get(left.key) ?? REACTION_CATALOG.length + REACTION_CATALOG.indexOf(left)
      const rightPosition = recentOrder.get(right.key) ?? REACTION_CATALOG.length + REACTION_CATALOG.indexOf(right)
      return leftPosition - rightPosition
    })
  }, [recentReactionKeys])

  const reactionState = useMemo(() => new Map(
    reactions.map((reaction) => [reaction.reactionKey, reaction]),
  ), [reactions])

  const applyReaction = async (reactionKey) => {
    if (status === 'saving') return
    setStatus('saving')
    setError('')
    try {
      const result = await toggleReaction(familyId, targetType, targetId, reactionKey)
      setReactions(result.reactions ?? [])
      const nextRecentReactionKeys = result.recentReactionKeys ?? []
      setRecentReactionKeys(nextRecentReactionKeys)
      window.dispatchEvent(new CustomEvent('reaction-usage-updated', { detail: nextRecentReactionKeys }))
      setStatus('ready')
    } catch (requestError) {
      setError(requestError.message)
      setStatus('error')
    }
  }

  const showReactors = (reactionKey) => {
    setOpenReactorsKey(reactionKey)
    window.clearTimeout(tooltipTimerRef.current)
    tooltipTimerRef.current = window.setTimeout(() => setOpenReactorsKey(''), 3000)
  }

  const startLongPress = (event, reactionKey) => {
    if (event.pointerType === 'mouse') return
    window.clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = window.setTimeout(() => {
      suppressClickRef.current = true
      showReactors(reactionKey)
    }, LONG_PRESS_DELAY)
  }

  const cancelLongPress = () => window.clearTimeout(longPressTimerRef.current)

  const handleExistingReactionClick = (reactionKey) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    applyReaction(reactionKey)
  }

  return (
    <div className="reaction-bar" ref={rootRef} onClick={(event) => event.stopPropagation()}>
      <div className="reaction-bar__items">
        {reactions.map((reaction) => {
          const catalogItem = reactionByKey(reaction.reactionKey)
          if (!catalogItem) return null
          const reactorNames = reaction.reactors.map((reactor) => reactor.name).join('、')
          const isTooltipOpen = openReactorsKey === reaction.reactionKey
          return (
            <span className="reaction-chip-wrap" key={reaction.reactionKey}>
              <button
                type="button"
                className={`reaction-chip${reaction.reactedByMe ? ' is-mine' : ''}`}
                aria-pressed={reaction.reactedByMe}
                aria-label={`${catalogItem.label} ${reaction.count}件。${reactorNames}`}
                title={reactorNames}
                disabled={status === 'saving'}
                onClick={() => handleExistingReactionClick(reaction.reactionKey)}
                onPointerDown={(event) => startLongPress(event, reaction.reactionKey)}
                onPointerUp={cancelLongPress}
                onPointerCancel={cancelLongPress}
                onPointerLeave={cancelLongPress}
                onContextMenu={(event) => {
                  event.preventDefault()
                  showReactors(reaction.reactionKey)
                }}
              >
                <img src={catalogItem.imageUrl} alt="" />
                <span>{reaction.count}</span>
              </button>
              <span className={`reaction-reactors${isTooltipOpen ? ' is-open' : ''}`} role="tooltip">
                {reactorNames}
              </span>
            </span>
          )
        })}

        <button
          type="button"
          className="reaction-add-button"
          aria-label="リアクションを追加"
          aria-expanded={isPickerOpen}
          onClick={() => setIsPickerOpen((current) => !current)}
          disabled={status === 'loading' || status === 'saving'}
        >
          ＋
        </button>
      </div>

      {isPickerOpen && (
        <div className="reaction-picker" aria-label="リアクションを選択">
          {pickerReactions.map((reaction) => {
            const isSelected = reactionState.get(reaction.key)?.reactedByMe ?? false
            return (
              <button
                type="button"
                className={isSelected ? 'is-selected' : ''}
                aria-label={reaction.label}
                aria-pressed={isSelected}
                title={reaction.label}
                key={reaction.key}
                onClick={() => applyReaction(reaction.key)}
                disabled={status === 'saving'}
              >
                <img src={reaction.imageUrl} alt="" />
              </button>
            )
          })}
        </div>
      )}

      {error && <span className="reaction-bar__error" role="alert">{error}</span>}
    </div>
  )
}

export default ReactionBar

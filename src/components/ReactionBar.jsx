import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { REACTION_CATALOG, reactionByKey } from '../reactionCatalog.js'
import { getReactions, toggleReaction } from '../services/reactionApi.js'
import '../Reaction.css'

const LONG_PRESS_DELAY = 550

function ReactionBar({ familyId, targetType, targetId }) {
  const rootRef = useRef(null)
  const addButtonRef = useRef(null)
  const pickerRef = useRef(null)
  const longPressTimerRef = useRef(null)
  const suppressClickRef = useRef(false)
  const tooltipTimerRef = useRef(null)
  const [reactions, setReactions] = useState([])
  const [recentReactionKeys, setRecentReactionKeys] = useState([])
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [pickerPosition, setPickerPosition] = useState({})
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
      if (!rootRef.current?.contains(event.target) && !pickerRef.current?.contains(event.target)) {
        setIsPickerOpen(false)
      }
    }
    document.addEventListener('pointerdown', closeFromOutside)
    return () => document.removeEventListener('pointerdown', closeFromOutside)
  }, [isPickerOpen])

  useLayoutEffect(() => {
    if (!isPickerOpen || !addButtonRef.current) return undefined

    const placePicker = () => {
      const isMobile = window.matchMedia('(max-width: 760px)').matches
      if (isMobile) {
        setPickerPosition({ top: 'auto', right: 12, bottom: 12, left: 12, width: 'auto' })
        return
      }

      const trigger = addButtonRef.current.getBoundingClientRect()
      const pickerWidth = Math.min(320, window.innerWidth - 24)
      const left = Math.min(
        Math.max(12, trigger.left),
        Math.max(12, window.innerWidth - pickerWidth - 12),
      )
      const hasRoomBelow = window.innerHeight - trigger.bottom >= 290
      setPickerPosition(hasRoomBelow
        ? { top: trigger.bottom + 8, right: 'auto', bottom: 'auto', left, width: pickerWidth }
        : { top: 'auto', right: 'auto', bottom: window.innerHeight - trigger.top + 8, left, width: pickerWidth })
    }

    placePicker()
    window.addEventListener('resize', placePicker)
    window.addEventListener('scroll', placePicker, true)
    return () => {
      window.removeEventListener('resize', placePicker)
      window.removeEventListener('scroll', placePicker, true)
    }
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
          ref={addButtonRef}
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

      {isPickerOpen && createPortal(
        <div
          className="reaction-picker"
          ref={pickerRef}
          style={pickerPosition}
          aria-label="リアクションを選択"
          onClick={(event) => event.stopPropagation()}
        >
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
        </div>,
        document.body,
      )}

      {error && <span className="reaction-bar__error" role="alert">{error}</span>}
    </div>
  )
}

export default ReactionBar

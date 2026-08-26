import { useState } from 'react'

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  )
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 20.2 4.7 13A4.8 4.8 0 0 1 11.5 6.2l.5.5.5-.5A4.8 4.8 0 0 1 19.3 13Z" />
    </svg>
  )
}

function UnknownDateIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3v3M17 3v3M4.5 9h15M6 5h12a2 2 0 0 1 2 2v12H4V7a2 2 0 0 1 2-2Z" />
      <path d="M10.4 13.2a1.8 1.8 0 1 1 2.4 1.7c-.8.3-.8.8-.8 1.1M12 17.8v.1" />
    </svg>
  )
}

function AlbumFilterPanel({
  filters,
  onChange,
  tags,
  tagStatus,
  tagError,
  resultCount,
  totalCount,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const dateFilterActive = Boolean(filters.from || filters.to)
  const activeCount = filters.tagIds.length
    + Number(Boolean(filters.favoriteOnly))
    + Number(Boolean(filters.from))
    + Number(Boolean(filters.to))
    + Number(dateFilterActive && Boolean(filters.includeUnknownCapturedDate))
  const invalidDateRange = filters.from && filters.to && filters.from > filters.to

  const toggleTag = (tagId) => {
    onChange({
      ...filters,
      tagIds: filters.tagIds.includes(tagId)
        ? filters.tagIds.filter((id) => id !== tagId)
        : [...filters.tagIds, tagId],
    })
  }

  const resetFilters = () => {
    onChange({
      tagIds: [],
      tagMode: 'or',
      favoriteOnly: false,
      from: '',
      to: '',
      includeUnknownCapturedDate: false,
    })
  }

  const updateDate = (key, value) => {
    const nextFilters = { ...filters, [key]: value }
    if (!nextFilters.from && !nextFilters.to) nextFilters.includeUnknownCapturedDate = false
    onChange(nextFilters)
  }

  return (
    <>
      <button
        type="button"
        className="album-filter-toggle"
        aria-expanded={isOpen}
        aria-controls="album-filter-panel"
        onClick={() => setIsOpen((current) => !current)}
      >
        <FilterIcon />
        <span>絞り込み</span>
        {activeCount > 0 && <strong aria-label={`${activeCount}個の条件を指定中`}>{activeCount}</strong>}
      </button>

      {isOpen && (
        <section
          id="album-filter-panel"
          className="album-filter-panel"
          aria-label="写真の絞り込み条件"
        >
          <header>
            <div>
              <p>Find memories</p>
              <h2>写真を絞り込む</h2>
            </div>
            <button type="button" onClick={() => setIsOpen(false)} aria-label="絞り込みを閉じる">×</button>
          </header>

          <fieldset className="album-filter-panel__tags">
            <legend>タグ</legend>
            {tagStatus === 'loading' && <p>タグを読み込んでいます…</p>}
            {tagStatus === 'error' && <p className="album-filter-panel__error">{tagError}</p>}
            {tagStatus === 'ready' && tags.length === 0 && <p>登録されているタグはありません。</p>}
            {tags.length > 0 && (
              <div className="album-filter-panel__tag-list">
                {tags.map((tag) => {
                  const selected = filters.tagIds.includes(tag.id)
                  return (
                    <button
                      type="button"
                      className={selected ? 'is-selected' : ''}
                      aria-pressed={selected}
                      key={tag.id}
                      onClick={() => toggleTag(tag.id)}
                    >
                      <span aria-hidden="true">#</span>
                      {tag.name}
                    </button>
                  )
                })}
              </div>
            )}
          </fieldset>

          {filters.tagIds.length > 1 && (
            <fieldset className="album-filter-panel__mode">
              <legend>複数タグの条件</legend>
              <label>
                <input
                  type="radio"
                  name="album-tag-mode"
                  value="or"
                  checked={filters.tagMode === 'or'}
                  onChange={() => onChange({ ...filters, tagMode: 'or' })}
                />
                <span>どれか1つ</span>
              </label>
              <label>
                <input
                  type="radio"
                  name="album-tag-mode"
                  value="and"
                  checked={filters.tagMode === 'and'}
                  onChange={() => onChange({ ...filters, tagMode: 'and' })}
                />
                <span>すべて</span>
              </label>
            </fieldset>
          )}

          <label className="album-filter-panel__favorite">
            <span className="album-filter-panel__favorite-icon"><HeartIcon /></span>
            <span className="album-filter-panel__favorite-copy">
              <strong>お気に入りのみ</strong>
              <small>自分がお気に入りにした写真を表示</small>
            </span>
            <input
              type="checkbox"
              checked={Boolean(filters.favoriteOnly)}
              onChange={(event) => onChange({ ...filters, favoriteOnly: event.target.checked })}
            />
            <span className="album-filter-panel__switch" aria-hidden="true" />
          </label>

          <fieldset className="album-filter-panel__dates">
            <legend>撮影日</legend>
            <label>
              <span>開始日（任意）</span>
              <input
                type="date"
                value={filters.from}
                max={filters.to || undefined}
                aria-describedby="album-captured-date-help"
                onChange={(event) => updateDate('from', event.target.value)}
              />
            </label>
            <span aria-hidden="true">〜</span>
            <label>
              <span>終了日（任意）</span>
              <input
                type="date"
                value={filters.to}
                min={filters.from || undefined}
                aria-describedby="album-captured-date-help"
                onChange={(event) => updateDate('to', event.target.value)}
              />
            </label>
          </fieldset>
          <label className={`album-filter-panel__favorite album-filter-panel__unknown-date${dateFilterActive ? '' : ' is-disabled'}`}>
            <span className="album-filter-panel__favorite-icon"><UnknownDateIcon /></span>
            <span className="album-filter-panel__favorite-copy">
              <strong>撮影日不明を表示対象に含める</strong>
              <small>撮影日を指定しているときだけ変更できます</small>
            </span>
            <input
              type="checkbox"
              checked={Boolean(filters.includeUnknownCapturedDate)}
              disabled={!dateFilterActive}
              onChange={(event) => onChange({
                ...filters,
                includeUnknownCapturedDate: event.target.checked,
              })}
            />
            <span className="album-filter-panel__switch" aria-hidden="true" />
          </label>
          <p id="album-captured-date-help" className="album-filter-panel__note">
            開始日だけならその日以降、終了日だけならその日以前に絞り込みます。片方だけでも指定できます。
          </p>
          {invalidDateRange && <p className="album-filter-panel__error">開始日は終了日以前にしてください。</p>}

          <footer>
            <p><strong>{invalidDateRange ? 0 : resultCount}</strong> / {totalCount}枚</p>
            <button type="button" onClick={resetFilters} disabled={activeCount === 0}>条件をクリア</button>
          </footer>
        </section>
      )}
    </>
  )
}

export default AlbumFilterPanel

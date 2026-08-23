import { useState } from 'react'

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 6h16M7 12h10M10 18h4" />
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
  const activeCount = filters.tagIds.length + Number(Boolean(filters.from)) + Number(Boolean(filters.to))
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
    onChange({ tagIds: [], tagMode: 'or', from: '', to: '' })
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

          <fieldset className="album-filter-panel__dates">
            <legend>撮影日</legend>
            <label>
              <span>開始日（任意）</span>
              <input
                type="date"
                value={filters.from}
                max={filters.to || undefined}
                aria-describedby="album-captured-date-help"
                onChange={(event) => onChange({ ...filters, from: event.target.value })}
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
                onChange={(event) => onChange({ ...filters, to: event.target.value })}
              />
            </label>
          </fieldset>
          <p id="album-captured-date-help" className="album-filter-panel__note">
            開始日だけならその日以降、終了日だけならその日以前に絞り込みます。片方だけでも指定できます。撮影日情報がない写真は、日付指定中のみ対象外です。
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

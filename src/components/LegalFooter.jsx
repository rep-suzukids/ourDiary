function LegalFooter({ onNavigate }) {
  const handleNavigation = (event, path) => {
    event.preventDefault()
    onNavigate(path)
  }

  return (
    <footer className="legal-footer" aria-label="サイト情報">
      <a
        href="/privacy-policy"
        onClick={(event) => handleNavigation(event, '/privacy-policy')}
      >
        プライバシーポリシー
      </a>
      <span aria-hidden="true">・</span>
      <a
        href="/terms-of-service"
        onClick={(event) => handleNavigation(event, '/terms-of-service')}
      >
        利用規約
      </a>
    </footer>
  )
}

export default LegalFooter

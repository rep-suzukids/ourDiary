import '../Legal.css'

const EFFECTIVE_DATE = '2026年8月23日'

function PrivacyPolicyPage({ onNavigate }) {
  const returnHome = (event) => {
    event.preventDefault()
    onNavigate('/')
  }

  return (
    <main className="legal-page">
      <header className="legal-page__header">
        <a href="/" onClick={returnHome} aria-label="Our Diaryのトップへ戻る">←</a>
        <div>
          <p>Our Diary</p>
          <h1>プライバシーポリシー</h1>
        </div>
      </header>

      <article className="legal-document">
        <p className="legal-document__lead">
          Our Diary（以下「本サービス」といいます。）は、家族の大切な記録を扱うサービスとして、
          利用者のプライバシーを尊重し、取得する情報を本ポリシーに従って取り扱います。
        </p>

        <section>
          <h2>1. 取得する情報</h2>
          <p>本サービスは、サービスの提供に必要な範囲で、次の情報を取得します。</p>
          <ul>
            <li>Googleアカウントの識別子、メールアドレス、表示名、プロフィール画像</li>
            <li>家族グループへの所属、権限および招待に関する情報</li>
            <li>日記の本文・日付・対象者、ミルク・搾乳・うんちなどの育児記録やメモ</li>
            <li>写真のファイル名、Google Drive上のファイル識別子、画像サイズ、タグなどの管理情報</li>
            <li>ログイン状態を維持するためのセッション情報、アクセス日時および操作記録</li>
          </ul>
        </section>

        <section>
          <h2>2. 利用目的</h2>
          <ul>
            <li>本人確認、招待された利用者の確認および権限管理</li>
            <li>写真、日記、育児記録の保存、整理および家族内での共有</li>
            <li>Google Driveとの連携および連携状態の維持</li>
            <li>不正利用の防止、障害調査、セキュリティの確保および本サービスの改善</li>
            <li>お問い合わせへの対応および重要なお知らせの案内</li>
          </ul>
        </section>

        <section>
          <h2>3. Googleユーザーデータの利用</h2>
          <p>
            本サービスは、Googleログインによる本人確認のほか、利用者が明示的にGoogle Drive連携を行った場合に、
            Our Diaryで作成または選択されたフォルダおよび写真を扱います。写真本体はGoogle Driveに保存され、
            本サービスは表示・アップロード・整理に必要な範囲でのみアクセスします。
          </p>
          <p>
            Googleから取得したデータを、広告配信、信用評価、販売その他本サービスの機能提供と無関係な目的には使用しません。
            Googleユーザーデータの利用は、Google API Services User Data Policy（Limited Use要件を含みます。）に従います。
          </p>
        </section>

        <section>
          <h2>4. Cookieおよびログイン状態</h2>
          <p>
            本サービスは、ログイン状態を安全に維持するため、必須Cookieを使用します。
            このCookieは広告や行動追跡には使用せず、ログアウトまたは有効期限の到来により無効になります。
          </p>
        </section>

        <section>
          <h2>5. 外部サービスおよび委託先</h2>
          <p>本サービスは、提供・運用にあたり次の外部サービスを利用します。</p>
          <ul>
            <li>Google：ログイン、Google Driveへの写真保存および取得</li>
            <li>Vercel：Webサイトおよびサーバー機能の提供</li>
            <li>Neon：データベースの提供</li>
          </ul>
          <p>
            これらの事業者には、サービス提供に必要な範囲で情報の取扱いを委託する場合があります。
            また、各事業者の設備が日本国外に置かれる場合があります。
          </p>
        </section>

        <section>
          <h2>6. 第三者提供</h2>
          <p>
            本サービスは、利用者の同意がある場合、法令に基づく場合、または生命・身体・財産の保護に必要な場合を除き、
            個人データを第三者へ提供しません。前項の委託先への提供は、サービス提供に必要な範囲に限ります。
          </p>
        </section>

        <section>
          <h2>7. 保存期間、削除および連携解除</h2>
          <p>
            情報は、本サービスの提供に必要な期間、または法令・安全管理上必要な期間保存します。
            登録情報の確認、訂正、利用停止または削除を希望する場合は、本サービスの管理者へご連絡ください。
            Google Drive連携はGoogleアカウントの権限管理画面から解除できます。
          </p>
          <p>
            Google Drive上の写真は、Our Diary側の登録や連携を解除しただけでは削除されない場合があります。
            写真本体の削除は、Google Driveの所有者または権限を持つ利用者がGoogle Drive上で行ってください。
          </p>
        </section>

        <section>
          <h2>8. 安全管理</h2>
          <p>
            本サービスは、アクセス権限の制御、通信の暗号化、認証情報の安全な保存など、
            取り扱う情報の漏えい、滅失または毀損を防止するために合理的な安全管理措置を講じます。
          </p>
        </section>

        <section>
          <h2>9. 子どもに関する情報</h2>
          <p>
            本サービスは、保護者および保護者から招待された家族が子どもの成長を記録するためのサービスです。
            子ども本人から直接個人情報を収集することを目的としていません。投稿者は、必要な同意と権限を得たうえで記録してください。
          </p>
        </section>

        <section>
          <h2>10. 本ポリシーの変更</h2>
          <p>
            法令や本サービスの内容に変更が生じた場合、本ポリシーを改定することがあります。
            重要な変更は、本サービス内その他適切な方法でお知らせします。
          </p>
        </section>

        <section>
          <h2>11. お問い合わせ</h2>
          <p>
            本ポリシーまたは情報の取扱いに関するお問い合わせは、招待時に案内された本サービスの管理者連絡先へご連絡ください。
          </p>
        </section>

        <p className="legal-document__date">制定日：{EFFECTIVE_DATE}</p>
      </article>
    </main>
  )
}

export default PrivacyPolicyPage

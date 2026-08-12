import React, { useState } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';

// 🔑 環境変数からクライアントIDを読み込む（ベタ書き排除）
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// 🔒 環境変数のカンマ区切り文字列を、配列に変換する
const ALLOWED_USERS = import.meta.env.VITE_ALLOWED_USERS 
  ? import.meta.env.VITE_ALLOWED_USERS.split(',') 
  : [];

function App() {
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");

  // Googleログインが成功した時の処理
  const handleSuccess = (credentialResponse) => {
    try {
      // 返ってきた暗号データをデコードしてユーザー情報を取得
      const decoded = jwtDecode(credentialResponse.credential);
      const userEmail = decoded.email;

      // 🚨 許可された2人のリストに含まれているか厳密にチェック
      if (ALLOWED_USERS.includes(userEmail)) {
        setUser(decoded); // ログイン成功、ユーザー情報を保存
        setError("");
      } else {
        // 外部の人がログインしようとした場合は即座に拒否
        setError("アクセス権限がありません。このアプリは限定されたユーザー専用です。");
        setUser(null);
      }
    } catch (err) {
      setError("認証エラーが発生しました。");
    }
  };

  const handleFailure = () => {
    setError("Googleログインに失敗しました。再試行してください。");
  };

  const handleLogout = () => {
    setUser(null);
    setError("");
  };

  // 1. ログイン成功後の画面（メイン画面の土台）
  if (user) {
    return (
      <div style={styles.container}>
        <h1 style={styles.title}>Our Diary ❤️</h1>
        <div style={styles.card}>
          <img src={user.picture} alt="プロフィール" style={styles.avatar} />
          <p style={styles.welcomeText}>ようこそ、{user.name} さん</p>
          <p style={styles.infoText}>お二人のプライベート空間に安全に接続されています。</p>
          
          {/* 今後ここにテキスト投稿や画像アップロードの部品を配置します */}
          <div style={styles.placeholderBox}>
            ここに次回の「日記投稿・閲覧機能」を作っていきます！
          </div>

          <button onClick={handleLogout} style={styles.logoutBtn}>ログアウト</button>
        </div>
      </div>
    );
  }

  // 2. ログイン前の画面（ロック画面）
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div style={styles.container}>
        <h1 style={styles.title}>Our Diary ❤️</h1>
        <p style={styles.subtitle}>2人だけのプライベート空間</p>
        
        <div style={styles.card}>
          <p style={{ fontWeight: 'bold', marginBottom: '1.5rem' }}>Googleアカウントでサインイン</p>
          
          <GoogleLogin 
            onSuccess={handleSuccess} 
            onError={handleFailure}
            useOneTap={false} // 身内限定なのでワンタップ自動ログインはオフにします
          />

          {error && (
            <div style={styles.errorBox}>
              ⚠️ {error}
            </div>
          )}
        </div>
      </div>
    </GoogleOAuthProvider>
  );
}

// 🎨 簡単な見た目の装飾（CSS）
const styles = {
  container: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', backgroundColor: '#f0f2f5' },
  title: { color: '#e91e63', fontSize: '3rem', marginBottom: '0.5rem', fontWeight: 'bold' },
  subtitle: { color: '#666', fontSize: '1.2rem', marginBottom: '2rem' },
  card: { padding: '2.5rem', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '320px' },
  avatar: { width: '70px', height: '70px', borderRadius: '50%', marginBottom: '1rem' },
  welcomeText: { fontSize: '1.3rem', fontWeight: 'bold', margin: '0 0 0.5rem 0' },
  infoText: { color: '#777', fontSize: '0.9rem', textAlign: 'center', margin: '0 0 1.5rem 0' },
  placeholderBox: { width: '100%', padding: '2rem 1rem', border: '2px dashed #ddd', borderRadius: '8px', textAlign: 'center', color: '#aaa', marginBottom: '1.5rem', boxSizing: 'border-box' },
  logoutBtn: { backgroundColor: '#f44336', color: 'white', border: 'none', padding: '0.6rem 1.5rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  errorBox: { marginTop: '1.5rem', padding: '0.8rem', backgroundColor: '#ffebee', color: '#c62828', borderRadius: '6px', fontSize: '0.9rem', textAlign: 'center', maxWidth: '280px', lineHeight: '1.4' }
};

export default App;
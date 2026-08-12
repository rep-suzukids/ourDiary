import React from 'react';

function App() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      fontFamily: 'sans-serif',
      backgroundColor: '#f0f2f5'
    }}>
      <h1 style={{ color: '#0070f3', fontSize: '3rem', marginBottom: '1rem' }}>
        Welcome to Our App! 👋
      </h1>
      <p style={{ color: '#666', fontSize: '1.2rem' }}>
        2人だけのプライベートWebアプリへようこそ。
      </p>
      <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <p style={{ margin: 0, fontWeight: 'bold' }}>次のステップ：</p>
        <p style={{ margin: '0.5rem 0 0 0', color: '#444' }}>ここにGoogleログインや画像投稿機能を作っていきます。</p>
      </div>
    </div>
  );
}

export default App;
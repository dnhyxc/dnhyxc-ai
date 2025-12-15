import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { useState } from 'react';
import reactLogo from './assets/react.svg';
import { invoke } from '@tauri-apps/api/core';
import './App.css';

function App() {
  const [greetMsg, setGreetMsg] = useState('');
  const [name, setName] = useState('');

  const openChildWindow = async () => {
    const webview = new WebviewWindow('child-window', {
      url: 'https://dnhyxc.cn',
      width: 1000,
      height: 690,
      resizable: true,
      decorations: true,
      title: 'Tauri + React',
      center: true
    });
    // since the webview window is created asynchronously,
    // Tauri emits the `tauri://created` and `tauri://error` to notify you of the creation response
    webview.once('tauri://created', function () {
      // webview window successfully created
      console.log('webview window successfully created');
    });
    webview.once('tauri://error', function (e: any) {
      // an error occurred during webview window creation
      console.log('webview window error', e);
    });
  };

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    setGreetMsg(await invoke('greet', { name }));
  }

  return (
    // data-tauri-drag-region: tauri 允许拖拽
    <main data-tauri-drag-region className="container">
      <h1>Welcome to Tauri + React</h1>

      <div className="row">
        <a href="https://vite.dev" target="_blank">
          <img src="/vite.svg" className="logo vite" alt="Vite logo" />
        </a>
        <a href="https://tauri.app" target="_blank">
          <img src="/tauri.svg" className="logo tauri" alt="Tauri logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <p>Click on the Tauri, Vite, and React logos to learn more.</p>

      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          greet();
        }}
      >
        <input id="greet-input" onChange={(e) => setName(e.currentTarget.value)} placeholder="Enter a name..." />
        <button type="submit">Greet</button>
      </form>
      <p>{greetMsg}</p>

      <button onClick={openChildWindow}>Open Child Window</button>
    </main>
  );
}

export default App;

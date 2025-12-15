import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import './index.css';

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
    <main data-tauri-drag-region className="w-full h-full flex flex-col justify-center items-center m-0">
      <h1 className="text-3xl font-bold mb-20 text-green-600">Welcome to dnhyxc-ai</h1>
      <form
        className=""
        onSubmit={(e) => {
          e.preventDefault();
          greet();
        }}
      >
        <div className="flex gap-2">
          <Input id="greet-input" onChange={(e) => setName(e.currentTarget.value)} placeholder="Enter a name..." />
          <Button className="cursor-pointer">Greet</Button>
        </div>
      </form>
      <p className="my-10 text-lg font-medium text-foreground">{greetMsg}</p>
      <Button variant="default" className="cursor-pointer" onClick={openChildWindow}>
        Open Child Window
      </Button>
    </main>
  );
}

export default App;

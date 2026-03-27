/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Chat from './components/Chat';

export default function App() {
  return (
    <div className="min-h-screen bg-[#F9F9F8] text-zinc-900 font-sans selection:bg-emerald-100 selection:text-emerald-900">
      <main className="container mx-auto px-4 py-8 h-screen flex flex-col">
        <div className="flex-1 min-h-0">
          <Chat />
        </div>
      </main>
    </div>
  );
}


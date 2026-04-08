"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UcitelLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password === "inj2025") {
      localStorage.setItem("ucitel-auth", "true");
      router.push("/ucitel/dashboard");
    } else {
      setError("Neplatné heslo");
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-background">
      <div className="flex flex-col items-center max-w-sm w-full">
        <h1 className="text-4xl font-bold mb-2">
          <span className="text-accent">Cesta inovátora</span>
        </h1>
        <p className="text-foreground/60 mb-10 text-sm">Učitelský portál</p>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-5">
          <div>
            <label htmlFor="password" className="block text-foreground/80 text-sm mb-1.5">
              Heslo
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full py-3 px-4 bg-background border-2 border-primary/50 focus:border-accent rounded-xl text-white outline-none transition-colors"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            className="w-full py-3.5 bg-primary hover:bg-primary/80 text-white font-semibold rounded-xl transition-colors"
          >
            Přihlásit se
          </button>
        </form>
      </div>
    </main>
  );
}

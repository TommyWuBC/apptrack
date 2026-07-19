import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../api/client.js";

export function AuthPage({ mode }: { mode: "setup" | "login" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      mode === "setup"
        ? api.setup(email, password)
        : api.login(email, password),
    onSuccess: () => {
      window.location.assign("/");
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-5">
      <section className="panel w-full p-6" data-testid={`${mode}-page`}>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-moss-600">
          self-hosted
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold">apptrack</h1>
        <h2 className="mt-6 font-display text-xl font-semibold">
          {mode === "setup" ? "Create the owner account" : "Sign in"}
        </h2>
        <p className="mt-1 text-sm text-ink-600">
          {mode === "setup"
            ? "First-run setup is available only while the users table is empty."
            : "Sessions expire after inactivity and rotate on every login."}
        </p>
        <form className="mt-5 space-y-4" onSubmit={submit}>
          <label className="block text-sm">
            Email
            <input
              className="mt-1 w-full rounded border border-ink-900/20 px-3 py-2"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="block text-sm">
            Password
            <input
              className="mt-1 w-full rounded border border-ink-900/20 px-3 py-2"
              type="password"
              autoComplete={
                mode === "setup" ? "new-password" : "current-password"
              }
              minLength={12}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {mutation.error ? (
            <p className="text-sm text-red-700">{mutation.error.message}</p>
          ) : null}
          <button
            type="submit"
            className="button-primary w-full"
            disabled={mutation.isPending}
          >
            {mutation.isPending
              ? "Working…"
              : mode === "setup"
                ? "Create owner"
                : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}

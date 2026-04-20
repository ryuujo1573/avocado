import {
  component$,
  getLocale,
  useSignal,
  useStore,
  $,
} from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import { useNavigate } from "@builder.io/qwik-city";
import { localize } from "compiled-i18n";
import { apiClient } from "~/lib/api";

export default component$(() => {
  const nav = useNavigate();

  const form = useStore({ email: "operator@avocado.local", password: "" });
  const error = useSignal("");
  const loading = useSignal(false);

  const submit$ = $(async () => {
    error.value = "";
    loading.value = true;
    try {
      const res = await apiClient.auth.login.$post({
        json: { email: form.email, password: form.password },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "unknown error" }));
        error.value = (body as { error?: string }).error ?? "login failed";
        return;
      }

      const { accessToken, refreshToken, userId, name } = await res.json();
      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", refreshToken);
      localStorage.setItem("userId", userId);
      localStorage.setItem("userName", name);

      // Redirect back to the locale root (fleet page)
      await nav(`/${getLocale("en")}/`);
    } catch (e) {
      error.value = "network error — is the server running?";
    } finally {
      loading.value = false;
    }
  });

  return (
    <div class="flex min-h-screen items-center justify-center bg-base-200">
      <div class="card w-full max-w-sm bg-base-100 shadow-xl">
        <div class="card-body">
          <div class="mb-4 flex items-center gap-3">
            <span class="mask mask-hexagon flex h-10 w-10 items-center justify-center bg-primary text-xl">
              🥑
            </span>
            <h1 class="text-2xl font-bold">{localize`Avocado`}</h1>
          </div>

          <h2 class="card-title mb-4">{localize`Sign in`}</h2>

          {error.value && (
            <div class="alert alert-error mb-4">
              <span>{error.value}</span>
            </div>
          )}

          <form preventdefault:submit onSubmit$={submit$} class="contents">
            <label class="form-control mb-3 w-full" for="login-email">
              <div class="label">
                <span class="label-text">{localize`Email`}</span>
              </div>
              <input
                id="login-email"
                name="email"
                type="email"
                autocomplete="email"
                class="input input-bordered w-full"
                placeholder="operator@avocado.local"
                value={form.email}
                onInput$={(e) => {
                  form.email = (e.target as HTMLInputElement).value;
                }}
              />
            </label>

            <label class="form-control mb-6 w-full" for="login-password">
              <div class="label">
                <span class="label-text">{localize`Password`}</span>
              </div>
              <input
                id="login-password"
                name="password"
                type="password"
                autocomplete="current-password"
                class="input input-bordered w-full"
                value={form.password}
                onInput$={(e) => {
                  form.password = (e.target as HTMLInputElement).value;
                }}
              />
            </label>

            <button
              type="submit"
              class={`btn btn-primary w-full ${loading.value ? "loading" : ""}`}
              disabled={loading.value}
            >
              {loading.value ? localize`Signing in…` : localize`Sign in`}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Sign in — Avocado",
};

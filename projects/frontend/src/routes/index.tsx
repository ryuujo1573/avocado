/// <reference no-default-lib="true" />
import { $, component$, useOnWindow } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import { logger } from "@avocado/core/qos";
import { IceServer } from "~/components/ice-server-select";

export default component$(() => {
  logger.d("hello %o from %o", { world: "!" }, ["node!"]);

  useOnWindow(
    "DOMContentLoaded",
    $((e) => {
      logger.d(
        "hello %o on %c%s%c!",
        { world: "!", e },
        "border: 1px solid cyan; border-radius: .2em; padding: .5ch",
        "Browser",
        "",
      );
    }),
  );

  return (
    <main class="m-8 flex flex-col gap-y-4">
      <h1>Hi 👋</h1>
      <IceServer />
    </main>
  );
});

export const head: DocumentHead = {
  title: "Welcome to Qwik",
  meta: [
    {
      name: "description",
      content: "Qwik site description",
    },
  ],
};

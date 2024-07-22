/// <reference no-default-lib="true" />
import type { Component } from "@builder.io/qwik";
import { component$, h, useSignal } from "@builder.io/qwik";
import { isDev } from "@builder.io/qwik/build";
import type { DocumentHead } from "@builder.io/qwik-city";
import { HiChevronLeftMini } from "@qwikest/icons/heroicons";
import { logger } from "@avocado/core/qos";
import { LocaleSelect } from "~/components/locale-select";
import { BsGlobe2, BsLightbulbFill } from "@qwikest/icons/bootstrap";
import { localize } from "compiled-i18n";

type PageModule = {
  pageMeta: PageMeta;
  default: Component;
};
const entries = isDev
  ? await Promise.all(
      Object.values(
        import.meta.glob<PageModule>("/src/pages/*.tsx", {
          eager: false,
        }),
      ).map((resolve) => resolve()),
    )
  : Object.values(
      import.meta.glob<PageModule>("/src/pages/*.tsx", {
        eager: true,
      }),
    );

export default component$(() => {
  const currTab = useSignal<string>("devices");

  return (
    <div class="flex h-screen w-screen" preventdefault:contextmenu>
      <div class="relative flex h-full flex-none flex-col p-4">
        <div class="absolute right-0 my-[10%] -mr-1 h-[95%] w-2 rounded-lg bg-transparent hover:bg-slate-300">
          <HiChevronLeftMini class="absolute top-1/2 -mr-1 inline w-max -translate-x-1/2 -translate-y-1/2 rounded-lg bg-base-300" />
        </div>
        <nav aria-label="navigate" class="mb-auto gap-4 bg-base-100">
          <div class="m-4 flex items-center gap-2">
            <span class="mask mask-hexagon flex h-8 w-8 items-center justify-center bg-primary">
              <span class="text-lg">🥑</span>
            </span>
            <h1 class="text-lg font-bold">{localize`Avocado Center`}</h1>
          </div>
          <ul
            role="radiogroup"
            class="menu flex w-52 flex-col gap-1"
            onClick$={(e) => {
              if (e.target instanceof HTMLDivElement) {
                currTab.value = e.target.getAttribute("aria-id") ?? "unknown";
                logger.i(currTab.value);
              }
            }}
          >
            {entries.map(({ pageMeta: { id, name, icon } }) => {
              const isCurrent = currTab.value == id;
              return (
                <li key={id}>
                  <div
                    role="radio"
                    aria-id={id}
                    aria-label={name}
                    aria-selected={isCurrent}
                    aria-disabled={isCurrent}
                    class={`${isCurrent ? "active" : ""}`}
                  >
                    {icon}
                    {name}
                  </div>
                </li>
              );
            })}
          </ul>
        </nav>
        <div class="flex max-w-xs flex-wrap items-center gap-1">
          <BsGlobe2 />
          <span class="select-none text-sm">{localize`Language`}</span>
          <LocaleSelect />
        </div>
        <div class="flex items-center gap-1">
          <BsLightbulbFill />
          <span
            class={`select-none text-sm before:inline before:content-[inherit]`}
            style={{ "--tw-content": `"${localize`Dark mode`}"` }}
          ></span>
        </div>
      </div>
      <main class="flex flex-auto flex-col overflow-hidden bg-base-300 p-4">
        {h(
          entries.find((mod) => mod.pageMeta.id == currTab.value)!.default,
          {},
        )}
      </main>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Avocado",
  meta: [
    {
      name: "description",
      content:
        "All-in-one solution to remote monitoring, IT management, and automation.",
    },
  ],
};

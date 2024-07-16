/// <reference lib="dom"/>
import { $, component$, useSignal, useStore } from "@builder.io/qwik";
import { LuX, LuPlus } from "@qwikest/icons/lucide";

const defaultEntry = {
  urls: "stun:stun.l.google.com:19302",
  selected: true,
};

export const IceServer = component$(() => {
  const store = useStore(
    {
      iceServers: [defaultEntry] as (RTCIceServer & { selected?: true })[],
    },
    { deep: false },
  );

  const isTURN = useSignal(false);
  const handleSubmit = $(
    (
      e: unknown,
      form: HTMLFormElement & {
        elements: {
          uri: HTMLInputElement;
          username: HTMLInputElement;
          credential: HTMLInputElement;
        };
      },
    ) => {
      if (e instanceof KeyboardEvent && e.key !== "Enter") {
        return;
      }

      const uri: string = form.elements["uri"].value.trim();
      const match = uri.match(/^(turn:|stun:)/);
      if (!match) {
        form.elements["uri"];
        return;
      }
      const username: string = form.elements["username"].value.trim();
      const credential: string = form.elements["credential"].value.trim();
      store.iceServers = [
        ...store.iceServers,
        {
          urls: uri,
          username,
          credential,
        },
      ];
      form.reset();
    },
  );

  return (
    <div class="card-compact card card-bordered w-fit max-w-xl bg-primary-content text-primary dark:bg-neutral">
      <div class="card-body">
        <div class="card-title">ICE Servers</div>
        <ul class="menu px-0">
          {store.iceServers.map((iceServer, _, arr) => (
            <li class="" key={iceServer.urls.toString()}>
              <div class="flex-1">
                {iceServer.urls}
                <div
                  role="button"
                  class="btn btn-square btn-ghost btn-xs ml-auto"
                  onClick$={() => {
                    store.iceServers = store.iceServers.filter(
                      (server) => server !== iceServer,
                    );
                  }}
                >
                  <LuX class="text-base hover:text-primary" />
                </div>
              </div>
            </li>
          ))}
        </ul>
        <form
          class="contents"
          preventdefault:submit
          onSubmit$={handleSubmit}
          onKeyDown$={handleSubmit}
        >
          <label class="input input-md flex items-center">
            <input
              name="uri"
              class="flex-1 pe-2 focus:placeholder:text-neutral-300 dark:focus:placeholder:text-neutral-600"
              placeholder="Type to add ICE server URI"
              oninput$={(e) => {
                if (e.target instanceof HTMLInputElement) {
                  const input = e.target.value.trim().toLowerCase();
                  if (isTURN.value !== input.startsWith("turn:")) {
                    isTURN.value = !isTURN.value;
                  }
                }
              }}
            />
            <LuPlus
              class="text-base group-empty:text-red-500 peer-empty:text-neutral-500 data-[hidden]:hidden"
              data-hidden={isTURN.value}
              role="button"
              type="submit"
            />
          </label>
          <input
            name="username"
            class="input input-md"
            autoComplete="off"
            placeholder="TURN username"
            hidden={!isTURN.value}
          />
          <input
            name="credential"
            type="text"
            class="input input-md"
            autoComplete="off"
            placeholder="TURN credential"
            hidden={!isTURN.value}
          />
          <div
            role="button"
            class="btn btn-ghost btn-sm data-[hidden]:hidden"
            data-hidden={!isTURN.value}
          >
            <LuPlus class="text-base" />
            Add server
          </div>
        </form>
      </div>
    </div>
  );
});

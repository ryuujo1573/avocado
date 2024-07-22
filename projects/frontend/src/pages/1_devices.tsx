import { logger } from "@avocado/core/qos";
import type { JSXOutput } from "@builder.io/qwik";
import { component$ } from "@builder.io/qwik";
import {
  BsApple,
  BsCircleFill,
  BsUbuntu,
  BsWindows,
} from "@qwikest/icons/bootstrap";
import { HiComputerDesktopSolid, HiUserMini } from "@qwikest/icons/heroicons";
import { LuGroup } from "@qwikest/icons/lucide";
import { localize } from "compiled-i18n";

export const pageMeta: PageMeta = {
  get name() {
    return localize`Devices`;
  },
  id: "devices",
  icon: <HiComputerDesktopSolid />,
};

const mockMesh = [
  {
    id: "default",
    devices: [
      {
        hostname: "DESKTOP-5TQZ3NK",
        status: 1,
        os: "windows",
        osVariant: "nt",
        osVersion: "10.0",
        ip: "10.148.31.109",
        user: "Administrator",
      },
      {
        hostname: "JohnDoe's MacBook Pro",
        status: 1,
        os: "macos",
        osVariant: "darwin",
        osVersion: "14.4.1",
        ip: "10.148.31.108",
        user: "johnDoe",
      },
      {
        hostname: "dev-container",
        status: 0,
        os: "ubuntu",
        osVariant: "linux",
        osVersion: "24.04",
        ip: "10.148.27.100",
        user: "ubuntu",
      },
    ],
  },
];

const osIconMap: Record<string, JSXOutput> = {
  windows: <BsWindows />,
  macos: <BsApple />,
  ubuntu: <BsUbuntu />,
};

export default component$(() => {
  return (
    <div class="flex max-w-full flex-col p-4" role="form">
      <h1 class="my-2 text-lg font-bold">{localize`List of devices`}</h1>
      {mockMesh.map((mesh) => {
        return (
          <div key={mesh.id} class="collapse-arrow collapse w-full bg-base-200">
            <input type="checkbox" name="accordion" checked></input>
            <div class="text-md collapse-title ">
              <span class="font-bold ">
                <LuGroup class="me-1 inline-block" />
                {localize`Mesh`}
              </span>
              <span class="ms-2 font-mono">{mesh.id}</span>
            </div>
            <div class="collapse-content flex w-full flex-wrap gap-2">
              {mesh.devices.map((device) => {
                return (
                  <div
                    key={device.hostname}
                    class={[
                      "card-compact card w-full max-w-xs flex-shrink cursor-default border border-base-content shadow-inner",
                      !device.status
                        ? "bg-base-100 bg-opacity-25"
                        : "text-base-content",
                    ]}
                    preventdefault:contextmenu
                    onContextMenu$={(e) => {
                      logger.d(e);
                    }}
                  >
                    <div class="card-body">
                      <h4 class="card-title text-ellipsis text-sm leading-none">
                        {osIconMap[device.os]} {device.hostname}{" "}
                        <span
                          class={[
                            "text-xs",
                            device.status
                              ? "text-green-700 dark:text-green-500"
                              : "text-neutral-700 dark:text-neutral-500",
                          ]}
                        >
                          <BsCircleFill />
                        </span>
                      </h4>

                      <div class="card-actions flex flex-nowrap justify-end text-xs">
                        <code class="flex items-center gap-1 break-keep">
                          <HiUserMini></HiUserMini>
                          {device.user}
                        </code>

                        <div class="flex items-center">
                          <span class="mr-1 font-bold">IP</span>
                          <code
                            class="tooltip tooltip-bottom tooltip-info select-none  hover:underline"
                            data-tip={localize`click to copy`}
                            onClick$={(_, el) => {
                              const ip = el.textContent;
                              ip && navigator.clipboard.writeText(ip);
                            }}
                          >
                            {device.ip}
                          </code>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
});
